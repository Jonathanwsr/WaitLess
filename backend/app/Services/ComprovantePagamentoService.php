<?php

namespace App\Services;

use App\Models\Pagamento;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Comprovante de pagamento (PDF) no formato de comprovante bancário: valor pago, forma, descrição,
 * dados do recebedor e do pagador (documentos mascarados), ID da transação, data e um código de
 * autenticação que qualquer pessoa confere em /comprovantes/verificar.
 *
 * Comprovante individual: cada pessoa recebe só a sua via.
 * - Quem pagou: "Comprovante do pagamento" (sem taxas internas).
 * - Quem recebeu (sócio/gerente do local, dono da reserva ou vendedor): "Comprovante de recebimento",
 *   com valor bruto, taxa da plataforma e valor líquido.
 * A via é decidida pelo papel de quem baixa, nunca por parâmetro; o admin escolhe a via.
 */
class ComprovantePagamentoService
{
    public const FUSO = 'America/Sao_Paulo';
    public const STATUS_COM_COMPROVANTE = ['pago', 'confirmado', 'estornado'];

    private const FORMAS = [
        'pix' => 'Pix',
        'cartao' => 'Cartão de crédito',
        'cartao_credito' => 'Cartão de crédito',
        'credit_card' => 'Cartão de crédito',
        'boleto' => 'Boleto',
        'presencial' => 'Pagamento no local',
        'local' => 'Pagamento no local',
        'dinheiro' => 'Dinheiro (no local)',
        'saldo' => 'Saldo da carteira',
    ];

    public function podeVer(User $user, Pagamento $pagamento): bool
    {
        return $this->viaDe($user, $pagamento) !== null;
    }

    /** Qual via esta pessoa recebe: 'pagador' ou 'recebedor' (null = não pode ver). */
    public function viaDe(User $user, Pagamento $pagamento, ?string $pedidaPeloAdmin = null): ?string
    {
        if ((int) $pagamento->usuario_id === (int) $user->id) {
            return 'pagador';
        }
        if (in_array((int) $user->id, $this->idsRecebedores($pagamento), true)) {
            return 'recebedor';
        }
        if (strtolower((string) $user->papel) === 'admin') {
            return $pedidaPeloAdmin === 'recebedor' ? 'recebedor' : 'pagador';
        }

        return null;
    }

    /** @return array dados para a view pdfs.comprovante_pagamento */
    public function dados(Pagamento $pagamento, User $quemBaixa, ?string $viaAdmin = null): array
    {
        abort_unless(in_array($pagamento->status, self::STATUS_COM_COMPROVANTE, true), 422, 'O comprovante fica disponível depois que o pagamento é confirmado.');

        $pagamento->loadMissing(['usuario', 'estabelecimento', 'agendamento.servico', 'aluguel.item', 'aluguel.proprietario', 'pedidoEntrega.vendedor', 'pedidoEntrega.produto']);

        $data = ($pagamento->data_pagamento ?? $pagamento->updated_at ?? $pagamento->created_at)->copy()->setTimezone(self::FUSO);
        $valor = $this->valorDe($pagamento);
        $taxa = $this->taxaDe($pagamento);
        $liquido = $this->liquidoDe($pagamento);
        $via = $this->viaDe($quemBaixa, $pagamento, $viaAdmin);
        abort_unless($via, 403, 'Este comprovante não é seu.');
        $ehRecebedor = $via === 'recebedor';

        return [
            'via' => $via,
            'titulo' => $ehRecebedor ? 'Comprovante de recebimento' : 'Comprovante do pagamento',
            'rotulo_valor' => $ehRecebedor ? 'Valor recebido' : 'Valor pago',
            'valor' => $valor,
            'forma' => self::FORMAS[strtolower((string) $pagamento->metodo_pagamento)] ?? ucfirst(str_replace('_', ' ', (string) $pagamento->metodo_pagamento ?: 'Online')),
            'descricao' => $this->descricao($pagamento),
            'recebedor' => $this->recebedor($pagamento),
            'pagador' => [
                'nome' => mb_strtoupper((string) ($pagamento->usuario?->name ?? 'Cliente')),
                'documento_rotulo' => strlen($this->digitos($pagamento->usuario?->cpf_cnpj)) === 14 ? 'CNPJ' : 'CPF',
                'documento' => $this->mascarar($pagamento->usuario?->cpf_cnpj),
            ],
            'processador' => $pagamento->gateway_pagamento && strtolower($pagamento->gateway_pagamento) !== 'presencial'
                ? 'Lokyva · pagamento processado por ' . $pagamento->gateway_pagamento
                : 'Lokyva · registrado pelo estabelecimento',
            'transacao' => $pagamento->id_transacao_gateway ?: 'LKY-' . str_pad((string) $pagamento->id, 10, '0', STR_PAD_LEFT),
            'data' => $data,
            'codigo' => $this->codigo($pagamento),
            'estornado' => $pagamento->status === 'estornado',
            'valor_estornado' => (float) ($pagamento->valor_estornado ?? 0),
            'data_estorno' => $pagamento->data_estorno ? Carbon::parse($pagamento->data_estorno)->setTimezone(self::FUSO) : null,
            'detalhe_recebedor' => $ehRecebedor ? ['taxa' => $taxa, 'liquido' => $liquido] : null,
            'url_verificacao' => route('comprovantes.verificar'),
            'emitido_em' => now(self::FUSO),
            'contato' => config('mail.from.address', 'suporte@lokyva.com'),
        ];
    }

    public function nomeArquivo(Pagamento $pagamento, string $via = 'pagador'): string
    {
        return ($via === 'recebedor' ? 'Comprovante_recebimento_' : 'Comprovante_pagamento_') . $pagamento->id . '.pdf';
    }

    /** Código de autenticação: LKY-{id}-{assinatura}. Muda se valor, transação ou data forem adulterados. */
    public function codigo(Pagamento $pagamento): string
    {
        $data = ($pagamento->data_pagamento ?? $pagamento->created_at)?->format('YmdHis');
        $base = implode('|', [$pagamento->id, number_format($this->valorDe($pagamento), 2, '.', ''), $pagamento->id_transacao_gateway, $data]);

        return 'LKY-' . $pagamento->id . '-' . strtoupper(substr(hash_hmac('sha256', $base, (string) config('app.key')), 0, 16));
    }

    /** Confere um código de autenticação. Devolve o resumo público do pagamento, ou null se não for válido. */
    public function verificar(string $codigo): ?array
    {
        $codigo = strtoupper(trim($codigo));
        if (!preg_match('/^LKY-(\d+)-[0-9A-F]{16}$/', $codigo, $m)) {
            return null;
        }

        $pagamento = Pagamento::find((int) $m[1]);
        if (!$pagamento || !in_array($pagamento->status, self::STATUS_COM_COMPROVANTE, true) || !hash_equals($this->codigo($pagamento), $codigo)) {
            return null;
        }

        $data = ($pagamento->data_pagamento ?? $pagamento->updated_at ?? $pagamento->created_at)->copy()->setTimezone(self::FUSO);

        return [
            'valor' => $this->valorDe($pagamento),
            'data' => $data->format('d/m/Y H:i:s'),
            'recebedor' => $this->recebedor($pagamento)['nome'],
            'situacao' => $pagamento->status === 'estornado' ? 'Pagamento estornado' : 'Pagamento confirmado',
        ];
    }

    /**
     * Pagamentos confirmados que esta pessoa recebeu num período (serviços, reservas e produtos),
     * agrupados por cliente, para baixar a via do recebedor de um, de alguns ou de todos.
     */
    public function recebidosPorCliente(User $user, string $de, string $ate, ?string $busca = null): array
    {
        $locais = DB::table('estabelecimento_usuario')
            ->where('usuario_id', $user->id)
            ->whereIn('tipo', ['socio', 'proprietario', 'gerente'])
            ->pluck('estabelecimento_id');

        $inicio = Carbon::parse($de, self::FUSO)->startOfDay()->setTimezone(config('app.timezone'));
        $fim = Carbon::parse($ate, self::FUSO)->endOfDay()->setTimezone(config('app.timezone'));

        return Pagamento::with(['usuario:id,name,email', 'agendamento.servico', 'aluguel.item', 'pedidoEntrega.produto'])
            ->whereIn('status', self::STATUS_COM_COMPROVANTE)
            ->where('usuario_id', '!=', $user->id)
            ->where(function ($q) use ($user, $locais) {
                $q->whereIn('estabelecimento_id', $locais)
                    ->orWhereIn('aluguel_id', DB::table('alugueis')->where('proprietario_id', $user->id)->select('id'))
                    ->orWhereIn('pedido_entrega_id', DB::table('pedidos_entrega')->where('vendedor_id', $user->id)->select('id'));
            })
            ->whereRaw('COALESCE(data_pagamento, created_at) BETWEEN ? AND ?', [$inicio->toDateTimeString(), $fim->toDateTimeString()])
            ->when($busca, fn ($q) => $q->whereHas('usuario', fn ($u) => $u->where(fn ($w) => $w
                ->where('name', 'ilike', '%' . $busca . '%')
                ->orWhere('email', 'ilike', '%' . $busca . '%'))))
            ->orderByDesc('id')
            ->limit(500)
            ->get()
            ->groupBy('usuario_id')
            ->map(fn ($lista) => [
                'cliente_id' => (int) $lista->first()->usuario_id,
                'cliente' => $lista->first()->usuario?->name ?? 'Cliente',
                'quantidade' => $lista->count(),
                'total' => round($lista->sum(fn (Pagamento $p) => $this->valorDe($p)), 2),
                'pagamentos' => $lista->map(fn (Pagamento $p) => [
                    'id' => $p->id,
                    'descricao' => $this->descricao($p),
                    'valor' => $this->valorDe($p),
                    'liquido' => $this->liquidoDe($p),
                    'forma' => self::FORMAS[strtolower((string) $p->metodo_pagamento)] ?? ucfirst((string) $p->metodo_pagamento),
                    'status' => $p->status,
                    'data' => ($p->data_pagamento ?? $p->created_at)?->toIso8601String(),
                ])->values()->all(),
            ])
            ->sortBy('cliente', SORT_NATURAL | SORT_FLAG_CASE)
            ->values()
            ->all();
    }

    // ------------------------------------------------------------------ apoio

    // Colunas novas (valor_total, taxa_plataforma, valor_prestador) podem estar vazias ou em 0 nos
    // pagamentos gravados só com as antigas (valor, taxa, valor_liquido): usa a primeira preenchida.
    private function valorDe(Pagamento $p): float
    {
        return (float) $p->valor_total > 0 ? (float) $p->valor_total : (float) $p->valor;
    }

    private function taxaDe(Pagamento $p): float
    {
        return (float) $p->taxa_plataforma > 0 ? (float) $p->taxa_plataforma : (float) $p->taxa;
    }

    private function liquidoDe(Pagamento $p): float
    {
        if ((float) $p->valor_prestador > 0) {
            return (float) $p->valor_prestador;
        }

        return (float) $p->valor_liquido > 0 ? (float) $p->valor_liquido : round($this->valorDe($p) - $this->taxaDe($p), 2);
    }

    /** users.id de quem recebe este pagamento (sócio/gerente do local, dono da reserva, vendedor). */
    private function idsRecebedores(Pagamento $pagamento): array
    {
        $ids = [];
        if ($pagamento->estabelecimento_id) {
            $ids = DB::table('estabelecimento_usuario')
                ->where('estabelecimento_id', $pagamento->estabelecimento_id)
                ->whereIn('tipo', ['socio', 'proprietario', 'gerente'])
                ->pluck('usuario_id')->map(fn ($id) => (int) $id)->all();
        }
        if ($pagamento->aluguel_id) {
            $ids[] = (int) DB::table('alugueis')->where('id', $pagamento->aluguel_id)->value('proprietario_id');
        }
        if ($pagamento->pedido_entrega_id) {
            $ids[] = (int) DB::table('pedidos_entrega')->where('id', $pagamento->pedido_entrega_id)->value('vendedor_id');
        }

        return array_values(array_unique(array_filter($ids)));
    }

    private function descricao(Pagamento $p): string
    {
        if ($p->agendamento) {
            return 'Serviço: ' . ($p->agendamento->servico?->nome ?? 'Agendamento') . ' · reserva #' . $p->agendamento->id;
        }
        if ($p->aluguel) {
            return 'Reserva ' . ($p->aluguel->codigo_reserva ?: '#' . $p->aluguel->id) . ': ' . ($p->aluguel->item?->nome ?? 'Locação');
        }
        if ($p->pedidoEntrega) {
            return 'Pedido ' . ($p->pedidoEntrega->codigo_pedido ?: '#' . $p->pedidoEntrega->id) . ': ' . ($p->pedidoEntrega->produto?->nome ?? 'Produto');
        }

        return 'Pagamento #' . $p->id;
    }

    /** Recebedor: o local (com CNPJ, se tiver) ou a pessoa dona da reserva/produto. */
    private function recebedor(Pagamento $p): array
    {
        $local = $p->estabelecimento;
        if ($local && !$p->aluguel_id && !$p->pedido_entrega_id) {
            $doc = $local->cnpj ?: $this->documentoDoDono($local->id);

            return $this->pessoa($local->razao_social ?: $local->nome, $doc, $local->nome);
        }

        $dono = $p->aluguel?->proprietario ?? $p->pedidoEntrega?->vendedor;
        if ($dono) {
            return $this->pessoa($dono->name, $dono->cpf_cnpj, $local?->nome);
        }

        return $this->pessoa($local?->nome ?? 'Estabelecimento', $local?->cnpj, null);
    }

    private function pessoa(?string $nome, ?string $documento, ?string $local): array
    {
        return [
            'nome' => mb_strtoupper((string) $nome),
            'local' => $local && mb_strtoupper($local) !== mb_strtoupper((string) $nome) ? $local : null,
            'documento_rotulo' => strlen($this->digitos($documento)) === 14 ? 'CNPJ' : 'CPF',
            'documento' => $this->mascarar($documento),
        ];
    }

    private function documentoDoDono(int $estabelecimentoId): ?string
    {
        return DB::table('estabelecimento_usuario')
            ->join('users', 'users.id', '=', 'estabelecimento_usuario.usuario_id')
            ->where('estabelecimento_usuario.estabelecimento_id', $estabelecimentoId)
            ->whereIn('estabelecimento_usuario.tipo', ['socio', 'proprietario'])
            ->value('users.cpf_cnpj');
    }

    /** CPF: ***.768.714-**  ·  CNPJ: 21.***.***∕****-25 (mesmo padrão dos comprovantes bancários). */
    public function mascarar(?string $documento): string
    {
        $n = $this->digitos($documento);
        if (strlen($n) === 11) {
            return '***.' . substr($n, 3, 3) . '.' . substr($n, 6, 3) . '-**';
        }
        if (strlen($n) === 14) {
            return substr($n, 0, 2) . '.***.***/****-' . substr($n, 12, 2);
        }

        return '—';
    }

    private function digitos(?string $v): string
    {
        return preg_replace('/\D/', '', (string) $v);
    }
}
