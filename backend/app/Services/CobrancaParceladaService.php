<?php

namespace App\Services;

use App\Models\Agendamento;
use App\Models\Cobranca;
use App\Models\CobrancaItem;
use App\Models\CobrancaParcela;
use App\Models\Estabelecimento;
use App\Models\Funcionario;
use App\Models\NotificacaoUsuario;
use App\Models\Provider;
use App\Models\Servico;
use App\Models\User;
use App\Support\Taxas;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Cobranças parceladas criadas por sócio premium para um cliente (serviços e/ou reserva).
 *
 * Fluxo: o sócio monta a cobrança (nada vai ao Asaas) → o cliente aceita ou recusa. Só ao aceitar,
 * no modo online, cada parcela vira uma cobrança no Asaas com split: a carteira do sócio recebe
 * 99,5% e a plataforma fica com 0,5%. No modo presencial o sócio marca cada parcela como paga.
 *
 * Taxa: 0,5% de toda parcela paga. Pela plataforma sai no split; recebida em mãos (baixa manual)
 * vira saldo devedor do local, descontado no próximo repasse (mesma regra das reservas presenciais).
 *
 * Sem custódia (escrow), de propósito: as parcelas vencem ao longo de meses e não existe um evento
 * único de "serviço entregue" que libere cada uma; a custódia do Asaas tem prazo e exigiria liberar
 * parcela por parcela. O cliente fica protegido por ver tudo e aceitar antes de qualquer cobrança,
 * e o recurso é exclusivo de sócio premium (identificado e com carteira verificada no Asaas).
 */
class CobrancaParceladaService
{
    public const FUSO = 'America/Sao_Paulo';

    public function __construct(private PagamentoService $pagamentos)
    {
    }

    /** Cobrança parcelada é recurso exclusivo de sócio com plano premium de sócio. */
    public function podeCriar(User $user): bool
    {
        return $user->podeGerenciarEquipeAvancada();
    }

    public function carteiraDoSocio(User $socio): ?string
    {
        return Provider::where('user_id', $socio->id)->whereNotNull('asaas_wallet_id')->value('asaas_wallet_id');
    }

    /** Estabelecimentos em que o usuário está vinculado (qualquer papel). */
    public function estabelecimentosDoSocio(User $socio)
    {
        return $socio->estabelecimentos()->select('estabelecimentos.id', 'estabelecimentos.nome')->get();
    }

    public function garantirDoSocio(User $socio, Estabelecimento $estabelecimento): void
    {
        $vinculado = DB::table('estabelecimento_usuario')
            ->where('usuario_id', $socio->id)
            ->where('estabelecimento_id', $estabelecimento->id)
            ->exists();

        abort_unless($vinculado, 403, 'Este local não é seu.');
    }

    /**
     * Dados para a tela de nova cobrança: serviços, reservas recentes e funcionários do local.
     */
    public function opcoes(User $socio, Estabelecimento $estabelecimento): array
    {
        $this->garantirDoSocio($socio, $estabelecimento);

        $servicos = Servico::where('estabelecimento_id', $estabelecimento->id)
            ->orderBy('nome')
            ->get(['id', 'nome', 'valor']);

        $reservas = Agendamento::with(['usuario:id,name,email', 'servico:id,nome', 'funcionario:id,nome'])
            ->where('estabelecimento_id', $estabelecimento->id)
            ->where('status', '!=', 'cancelado')
            ->where('data_agendamento', '>=', now(self::FUSO)->subDays(30)->toDateString())
            ->orderByDesc('data_agendamento')
            ->orderByDesc('hora_agendamento')
            ->limit(150)
            ->get()
            ->map(fn (Agendamento $a) => [
                'id' => $a->id,
                'cliente_id' => $a->usuario_id,
                'cliente_nome' => $a->usuario?->name,
                'servico_nome' => $a->servico?->nome,
                'data' => Carbon::parse($a->data_agendamento)->format('d/m/Y'),
                'hora' => substr((string) $a->hora_agendamento, 0, 5),
                'valor' => (float) $a->valor_final,
                'funcionario_id' => $a->funcionario_id,
                'funcionario_nome' => $a->funcionario?->nome,
                'status' => $a->status,
            ]);

        $funcionarios = Funcionario::where('estabelecimento_id', $estabelecimento->id)->orderBy('nome')->get(['id', 'nome']);

        return [
            'servicos' => $servicos,
            'reservas' => $reservas->values(),
            'funcionarios' => $funcionarios,
            'carteira_configurada' => (bool) $this->carteiraDoSocio($socio),
            'taxa_percentual' => Taxas::percentualCobrancas(),
            'parte_do_socio_percentual' => Taxas::parteDoSocioCobrancasPercentual(),
        ];
    }

    /**
     * Cria a cobrança em "aguardando aceite". Nenhuma chamada ao Asaas acontece aqui.
     *
     * @param array{cliente_id: int, modo: string, parcelas: int, primeiro_vencimento: string, descricao?: ?string,
     *              itens: array<int, array{tipo: string, id: int, valor?: ?float, funcionario_id?: ?int}>} $dados
     */
    public function criar(User $socio, Estabelecimento $estabelecimento, array $dados): Cobranca
    {
        $this->garantirDoSocio($socio, $estabelecimento);

        $cliente = User::findOrFail($dados['cliente_id']);
        if ($cliente->id === $socio->id) {
            throw ValidationException::withMessages(['cliente_id' => 'Você não pode cobrar a si mesmo.']);
        }

        $itens = $this->montarItens($estabelecimento, $cliente, $dados['itens']);
        $total = round(array_sum(array_column($itens, 'valor')), 2);
        if ($total <= 0) {
            throw ValidationException::withMessages(['itens' => 'O total da cobrança precisa ser maior que zero.']);
        }

        $modo = $dados['modo'];
        if ($modo === Cobranca::MODO_ONLINE && !$this->carteiraDoSocio($socio)) {
            throw ValidationException::withMessages(['modo' => 'Configure sua carteira Asaas antes de cobrar online.']);
        }

        $parcelas = (int) $dados['parcelas'];
        $maximo = $this->pagamentos->maximoParcelas($total);
        if ($parcelas < 1 || $parcelas > $maximo) {
            throw ValidationException::withMessages(['parcelas' => "Para este valor, o máximo é {$maximo}x."]);
        }

        $valores = $this->dividirParcelas($total, $parcelas);
        $primeiro = Carbon::parse($dados['primeiro_vencimento'], self::FUSO)->startOfDay();

        return DB::transaction(function () use ($socio, $estabelecimento, $cliente, $itens, $total, $modo, $valores, $primeiro, $dados) {
            $cobranca = Cobranca::create([
                'codigo' => 'COB-' . strtoupper(Str::random(8)),
                'estabelecimento_id' => $estabelecimento->id,
                'criado_por_usuario_id' => $socio->id,
                'cliente_id' => $cliente->id,
                'descricao' => $dados['descricao'] ?? null,
                'modo' => $modo,
                'valor_total' => $total,
                // Online: a taxa sai por split. Presencial: vira saldo devedor do local quando a parcela é paga.
                'taxa_percentual' => Taxas::percentualCobrancas(),
                'status' => Cobranca::STATUS_AGUARDANDO,
            ]);

            foreach ($itens as $item) {
                CobrancaItem::create(['cobranca_id' => $cobranca->id] + $item);
            }

            foreach ($valores as $indice => $valor) {
                CobrancaParcela::create([
                    'cobranca_id' => $cobranca->id,
                    'numero' => $indice + 1,
                    'valor' => $valor,
                    'vencimento' => $primeiro->copy()->addMonthsNoOverflow($indice)->toDateString(),
                    'status' => CobrancaParcela::PENDENTE,
                    'forma_pagamento' => $modo,
                ]);
            }

            $qtd = count($valores);
            NotificacaoUsuario::avisar(
                $cliente->id,
                'Nova cobrança para você',
                "{$socio->name} enviou uma cobrança de R$ " . number_format($total, 2, ',', '.') . " em {$qtd}x. Abra \"Minhas cobranças\" para ver os detalhes e aceitar."
            );

            return $cobranca->load(['itens', 'parcelas']);
        });
    }

    /** Cliente aceita. No modo online, cada parcela vira uma cobrança no Asaas agora. */
    public function aceitar(User $cliente, Cobranca $cobranca): Cobranca
    {
        abort_unless((int) $cobranca->cliente_id === (int) $cliente->id, 403, 'Esta cobrança não é sua.');
        $this->exigirStatus($cobranca, [Cobranca::STATUS_AGUARDANDO], 'Esta cobrança não está mais aguardando sua resposta.');

        if ($cobranca->modo === Cobranca::MODO_ONLINE) {
            $this->criarCobrancasNoAsaas($cliente, $cobranca);
        }

        $cobranca->update(['status' => Cobranca::STATUS_ACEITA, 'aceita_em' => now()]);

        NotificacaoUsuario::avisar(
            $cobranca->criado_por_usuario_id,
            'Cobrança aceita',
            "{$cliente->name} aceitou a cobrança {$cobranca->codigo} de R$ " . number_format((float) $cobranca->valor_total, 2, ',', '.') . '.'
        );

        return $cobranca->fresh(['itens', 'parcelas']);
    }

    public function recusar(User $cliente, Cobranca $cobranca): Cobranca
    {
        abort_unless((int) $cobranca->cliente_id === (int) $cliente->id, 403, 'Esta cobrança não é sua.');
        $this->exigirStatus($cobranca, [Cobranca::STATUS_AGUARDANDO], 'Esta cobrança não está mais aguardando sua resposta.');

        DB::transaction(function () use ($cobranca) {
            $cobranca->update(['status' => Cobranca::STATUS_RECUSADA, 'recusada_em' => now()]);
            $cobranca->parcelas()->update(['status' => CobrancaParcela::CANCELADO]);
        });

        NotificacaoUsuario::avisar(
            $cobranca->criado_por_usuario_id,
            'Cobrança recusada',
            "{$cliente->name} recusou a cobrança {$cobranca->codigo}."
        );

        return $cobranca->fresh(['itens', 'parcelas']);
    }

    /** Sócio cancela. Não cancela se já houver parcela paga; as parcelas em aberto são canceladas no Asaas. */
    public function cancelar(User $socio, Cobranca $cobranca): Cobranca
    {
        abort_unless((int) $cobranca->criado_por_usuario_id === (int) $socio->id, 403, 'Esta cobrança não é sua.');
        $this->exigirStatus($cobranca, [Cobranca::STATUS_AGUARDANDO, Cobranca::STATUS_ACEITA], 'Esta cobrança não pode mais ser cancelada.');

        $cobranca->load('parcelas');
        if ($cobranca->parcelas->contains(fn (CobrancaParcela $p) => $p->status === CobrancaParcela::PAGO)) {
            throw new \DomainException('Já há parcelas pagas. Só é possível cancelar cobranças sem pagamentos.');
        }

        foreach ($cobranca->parcelas as $parcela) {
            if ($parcela->asaas_payment_id && $parcela->emAberto()) {
                $this->pagamentos->cancelarCobrancaAsaas($parcela->asaas_payment_id);
            }
        }

        DB::transaction(function () use ($cobranca) {
            $cobranca->parcelas()->update(['status' => CobrancaParcela::CANCELADO]);
            $cobranca->update(['status' => Cobranca::STATUS_CANCELADA, 'cancelada_em' => now()]);
        });

        NotificacaoUsuario::avisar(
            $cobranca->cliente_id,
            'Cobrança cancelada',
            "A cobrança {$cobranca->codigo} foi cancelada pelo responsável. Não é preciso pagar as parcelas em aberto."
        );

        return $cobranca->fresh(['itens', 'parcelas']);
    }

    /**
     * Sócio marca a parcela como paga. Se ela existe no Asaas (online), registra o recebimento lá
     * também. Pagamentos presenciais são só registrados aqui.
     */
    public function darBaixa(User $socio, CobrancaParcela $parcela, ?string $dataPagamento = null): CobrancaParcela
    {
        $cobranca = $parcela->cobranca;
        abort_unless((int) $cobranca->criado_por_usuario_id === (int) $socio->id, 403, 'Esta cobrança não é sua.');
        $this->exigirStatus($cobranca, [Cobranca::STATUS_ACEITA], 'Só é possível dar baixa em cobranças aceitas.');

        if (!$parcela->emAberto()) {
            throw new \DomainException('Esta parcela já está paga ou cancelada.');
        }

        $data = $dataPagamento ? Carbon::parse($dataPagamento, self::FUSO) : now(self::FUSO);

        if ($parcela->asaas_payment_id) {
            $resposta = $this->asaas('post', "/payments/{$parcela->asaas_payment_id}/receiveInCash", [
                'paymentDate' => $data->toDateString(),
                'value' => (float) $parcela->valor,
            ]);

            if ($resposta->failed()) {
                // Pode ter sido paga online enquanto o sócio clicava: confere antes de falhar.
                if ($this->sincronizarParcela($parcela) === CobrancaParcela::PAGO) {
                    return $parcela->fresh();
                }
                Log::error('Falha ao registrar recebimento de parcela no Asaas', ['parcela' => $parcela->id, 'resposta' => $resposta->json()]);
                throw new \DomainException('Não foi possível registrar o recebimento no Asaas. Tente novamente.');
            }
        }

        // Dinheiro recebido fora do Asaas: não houve split, então a taxa da plataforma vira saldo devedor
        // do local (descontado no próximo repasse, como nas reservas presenciais). O UPDATE condicional
        // garante que dois cliques não lancem a taxa duas vezes.
        $taxa = $this->taxaDaParcela($cobranca, $parcela);
        $baixou = DB::transaction(function () use ($parcela, $cobranca, $data, $taxa) {
            $linhas = CobrancaParcela::whereKey($parcela->id)
                ->whereIn('status', [CobrancaParcela::PENDENTE, CobrancaParcela::ATRASADO])
                ->update(['status' => CobrancaParcela::PAGO, 'pago_em' => $data, 'baixa_manual' => true, 'taxa_plataforma' => $taxa]);

            if ($linhas === 1 && $taxa > 0) {
                DB::table('estabelecimentos')->where('id', $cobranca->estabelecimento_id)->increment('saldo_devedor', $taxa);
            }

            return $linhas === 1;
        });

        if (!$baixou) {
            throw new \DomainException('Esta parcela já está paga ou cancelada.');
        }

        $this->atualizarQuitacao($cobranca);

        return $parcela->fresh();
    }

    /** Puxa o status atual de uma parcela online direto do Asaas. Devolve o status resultante. */
    public function sincronizarParcela(CobrancaParcela $parcela): string
    {
        if (!$parcela->asaas_payment_id) {
            return $parcela->status;
        }

        $resposta = $this->asaas('get', "/payments/{$parcela->asaas_payment_id}");
        if ($resposta->failed()) {
            Log::warning('Não foi possível consultar parcela no Asaas', ['parcela' => $parcela->id]);
            return $parcela->status;
        }

        $this->aplicarStatusAsaas($parcela, $resposta->json('status'), $resposta->json('paymentDate'));

        return $parcela->fresh()->status;
    }

    /**
     * Aplica um evento do webhook do Asaas a uma parcela de cobrança parcelada.
     * Devolve false quando o pagamento não é de uma parcela (quem chama segue com o fluxo normal).
     */
    public function aplicarEventoAsaas(string $evento, string $paymentId, ?string $dataPagamento = null): bool
    {
        $parcela = CobrancaParcela::where('asaas_payment_id', $paymentId)->first();
        if (!$parcela) {
            return false;
        }

        $statusAsaas = match ($evento) {
            'PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED' => 'RECEIVED',
            'PAYMENT_OVERDUE' => 'OVERDUE',
            'PAYMENT_DELETED' => 'DELETED',
            'PAYMENT_REFUNDED' => 'REFUNDED',
            default => null,
        };

        if ($statusAsaas) {
            $this->aplicarStatusAsaas($parcela, $statusAsaas, $dataPagamento);
        }

        return true;
    }

    /** Texto da fatura do Asaas: diz o que é a cobrança (estabelecimento e o que foi combinado). */
    public function descricaoParaFatura(Cobranca $cobranca): string
    {
        $nomeLocal = $cobranca->estabelecimento?->nome ?? 'Estabelecimento';
        $itens = $cobranca->itens->pluck('descricao')->implode(', ');

        return "{$nomeLocal}: {$itens}";
    }

    /**
     * Dados do comprovante em PDF (sócio e cliente veem o mesmo documento).
     * Nunca inclui IDs de pagamento do Asaas nem códigos de acesso.
     */
    public function dadosComprovante(Cobranca $cobranca): array
    {
        $cobranca->load(['criador:id,name,email', 'cliente:id,name,email,cpf_cnpj', 'estabelecimento:id,nome,cnpj,razao_social,telefone', 'itens.funcionario:id,nome', 'parcelas']);

        $pagas = $cobranca->parcelas->where('status', CobrancaParcela::PAGO);
        $emAberto = $cobranca->parcelas->filter(fn (CobrancaParcela $p) => $p->emAberto());

        return [
            'cobranca' => $cobranca,
            'totalPago' => round((float) $pagas->sum('valor'), 2),
            'totalEmAberto' => round((float) $emAberto->sum('valor'), 2),
            'parcelasPagas' => $pagas->count(),
            'parteDoSocioPercentual' => \App\Support\Taxas::parteDoSocioCobrancasPercentual(),
            'emitidoEm' => now(self::FUSO),
        ];
    }

    /** Se o pedido faz parte de uma cobrança parcelada, resume as parcelas para a tela do cliente. */
    public function resumoDoPedido(string $coluna, int $id): ?array
    {
        $item = CobrancaItem::with('cobranca.parcelas')->where($coluna, $id)
            ->whereHas('cobranca', fn ($q) => $q->whereIn('status', ['aguardando_aceite', 'aceita', 'quitada']))
            ->latest('id')
            ->first();

        if (!$item) {
            return null;
        }

        $parcelas = $item->cobranca->parcelas;
        $proxima = $parcelas->first(fn ($p) => in_array($p->status, ['pendente', 'atrasado'], true));

        return [
            'codigo' => $item->cobranca->codigo,
            'status' => $item->cobranca->status,
            'total' => (float) $item->cobranca->valor_total,
            'parcelas' => $parcelas->count(),
            'pagas' => $parcelas->where('status', 'pago')->count(),
            'proxima' => $proxima ? ['numero' => $proxima->numero, 'valor' => (float) $proxima->valor, 'vencimento' => $proxima->vencimento?->toDateString()] : null,
        ];
    }

    /** Dados para a tela do sócio. */
    public function listarDoSocio(User $socio)
    {
        return Cobranca::with(['cliente:id,name,email', 'estabelecimento:id,nome', 'itens.funcionario:id,nome', 'parcelas'])
            ->where('criado_por_usuario_id', $socio->id)
            ->orderByDesc('created_at')
            ->limit(100)
            ->get();
    }

    /** Dados para a tela do cliente: quem cobra, quem faz o trabalho e as parcelas. */
    public function listarDoCliente(User $cliente)
    {
        return Cobranca::with([
            'criador:id,name',
            'estabelecimento:id,nome,foto_perfil,foto_banner,cidade,estado,telefone',
            'itens.servico:id,nome,fotos',
            'itens.funcionario:id,nome',
            'itens.agendamento:id,data_agendamento,hora_agendamento',
            'parcelas',
        ])
            ->where('cliente_id', $cliente->id)
            ->orderByDesc('created_at')
            ->limit(100)
            ->get();
    }

    /** Busca de clientes pelo sócio: nome ou e-mail, nunca o telefone/CPF. */
    public function buscarClientes(User $socio, string $termo)
    {
        $termo = trim($termo);
        if (mb_strlen($termo) < 3) {
            return collect();
        }

        return User::where('id', '!=', $socio->id)
            ->where(function ($q) use ($termo) {
                $q->where('name', 'ilike', "%{$termo}%")->orWhere('email', 'ilike', "%{$termo}%");
            })
            ->orderBy('name')
            ->limit(10)
            ->get(['id', 'name', 'email']);
    }

    // ------------------------------------------------------------------
    // Internos
    // ------------------------------------------------------------------

    /** @return array<int, array<string, mixed>> */
    private function montarItens(Estabelecimento $estabelecimento, User $cliente, array $itens): array
    {
        if (empty($itens)) {
            throw ValidationException::withMessages(['itens' => 'Escolha ao menos um serviço ou reserva.']);
        }

        $resultado = [];
        $reservasJaCobradas = CobrancaItem::whereNotNull('agendamento_id')
            ->whereHas('cobranca', fn ($q) => $q->whereIn('status', [Cobranca::STATUS_AGUARDANDO, Cobranca::STATUS_ACEITA]))
            ->pluck('agendamento_id')
            ->all();

        foreach ($itens as $indice => $item) {
            $funcionarioId = $this->funcionarioDoLocal($estabelecimento, $item['funcionario_id'] ?? null, "itens.{$indice}.funcionario_id");

            if ($item['tipo'] === 'servico') {
                $servico = Servico::where('estabelecimento_id', $estabelecimento->id)->find($item['id']);
                if (!$servico) {
                    throw ValidationException::withMessages(["itens.{$indice}.id" => 'Serviço não encontrado neste local.']);
                }

                $resultado[] = [
                    'servico_id' => $servico->id,
                    'agendamento_id' => null,
                    'funcionario_id' => $funcionarioId,
                    'descricao' => $servico->nome,
                    'valor' => round((float) ($item['valor'] ?? $servico->valor), 2),
                    'data_referencia' => null,
                ];
                continue;
            }

            $reserva = Agendamento::with('servico:id,nome')
                ->where('estabelecimento_id', $estabelecimento->id)
                ->where('status', '!=', 'cancelado')
                ->find($item['id']);

            if (!$reserva) {
                throw ValidationException::withMessages(["itens.{$indice}.id" => 'Reserva não encontrada neste local.']);
            }
            if ((int) $reserva->usuario_id !== (int) $cliente->id) {
                throw ValidationException::withMessages(["itens.{$indice}.id" => 'Esta reserva não é do cliente escolhido.']);
            }
            if (in_array($reserva->id, $reservasJaCobradas, true)) {
                throw ValidationException::withMessages(["itens.{$indice}.id" => 'Esta reserva já está em outra cobrança.']);
            }

            $data = Carbon::parse($reserva->data_agendamento)->format('d/m/Y');
            $hora = substr((string) $reserva->hora_agendamento, 0, 5);

            $resultado[] = [
                'servico_id' => $reserva->servico_id,
                'agendamento_id' => $reserva->id,
                'funcionario_id' => $funcionarioId ?? $reserva->funcionario_id,
                'descricao' => 'Reserva: ' . ($reserva->servico?->nome ?? 'Atendimento') . " em {$data} às {$hora}",
                'valor' => round((float) ($item['valor'] ?? $reserva->valor_final), 2),
                'data_referencia' => Carbon::parse(Carbon::parse($reserva->data_agendamento)->format('Y-m-d') . ' ' . $reserva->hora_agendamento, self::FUSO),
            ];
        }

        return $resultado;
    }

    private function funcionarioDoLocal(Estabelecimento $estabelecimento, ?int $funcionarioId, string $campo): ?int
    {
        if (!$funcionarioId) {
            return null;
        }

        $existe = Funcionario::where('estabelecimento_id', $estabelecimento->id)->whereKey($funcionarioId)->exists();
        if (!$existe) {
            throw ValidationException::withMessages([$campo => 'Este funcionário não pertence ao local.']);
        }

        return $funcionarioId;
    }

    /**
     * Divide o total em n parcelas em centavos. A última absorve a diferença de arredondamento,
     * para a soma das parcelas ser exatamente o total.
     *
     * @return float[]
     */
    public function dividirParcelas(float $total, int $parcelas): array
    {
        $base = floor(($total / $parcelas) * 100) / 100;
        $valores = array_fill(0, $parcelas, $base);
        $valores[$parcelas - 1] = round($total - $base * ($parcelas - 1), 2);

        return $valores;
    }

    private function criarCobrancasNoAsaas(User $cliente, Cobranca $cobranca): void
    {
        $socio = $cobranca->criador;
        $carteira = $this->carteiraDoSocio($socio);
        if (!$carteira) {
            throw new \DomainException('O responsável por esta cobrança ainda não configurou a carteira Asaas.');
        }

        $clienteAsaas = $this->pagamentos->garantirClienteAsaas($cliente);
        $parcelas = $cobranca->parcelas()->orderBy('numero')->get();
        $total = $parcelas->count();
        $oQueE = $this->descricaoParaFatura($cobranca);
        $criadas = [];

        try {
            foreach ($parcelas as $parcela) {
                $resposta = $this->asaas('post', '/payments', [
                    'customer' => $clienteAsaas,
                    'billingType' => 'UNDEFINED', // o cliente escolhe PIX, boleto ou cartão na fatura
                    'dueDate' => $parcela->vencimento->toDateString(),
                    'value' => (float) $parcela->valor,
                    'description' => mb_substr("{$oQueE} · Parcela {$parcela->numero}/{$total} · Ref. {$cobranca->codigo}", 0, 500),
                    'externalReference' => "cobranca_parcela:{$parcela->id}",
                    'split' => [[
                        'walletId' => $carteira,
                        'percentualValue' => Taxas::parteDoSocioCobrancasPercentual(),
                    ]],
                ]);

                if ($resposta->failed() || !$resposta->json('id')) {
                    Log::error('Falha ao criar parcela de cobrança no Asaas', ['cobranca' => $cobranca->id, 'parcela' => $parcela->id, 'resposta' => $resposta->json()]);
                    throw new \RuntimeException('falha');
                }

                $criadas[] = [$parcela->id, $resposta->json('id'), $resposta->json('invoiceUrl')];
            }
        } catch (\Throwable $e) {
            // Não deixa pagamentos órfãos no Asaas quando uma parcela falha no meio.
            foreach ($criadas as [, $asaasId]) {
                $this->pagamentos->cancelarCobrancaAsaas($asaasId);
            }

            throw new \DomainException('Não foi possível preparar os pagamentos agora. Tente aceitar novamente em instantes.');
        }

        DB::transaction(function () use ($criadas) {
            foreach ($criadas as [$parcelaId, $asaasId, $linkFatura]) {
                CobrancaParcela::whereKey($parcelaId)->update([
                    'asaas_payment_id' => $asaasId,
                    'invoice_url' => $linkFatura,
                ]);
            }
        });
    }

    private function aplicarStatusAsaas(CobrancaParcela $parcela, ?string $statusAsaas, ?string $dataPagamento = null): void
    {
        $novo = match ($statusAsaas) {
            'RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH' => CobrancaParcela::PAGO,
            'OVERDUE' => CobrancaParcela::ATRASADO,
            'PENDING' => CobrancaParcela::PENDENTE,
            'REFUNDED' => CobrancaParcela::ESTORNADO,
            'DELETED' => CobrancaParcela::CANCELADO,
            default => null,
        };

        if (!$novo || $parcela->status === $novo) {
            return;
        }

        $dados = ['status' => $novo];
        if ($novo === CobrancaParcela::PAGO) {
            $dados['pago_em'] = $dataPagamento ? Carbon::parse($dataPagamento, self::FUSO) : now(self::FUSO);
            // Pago pelo Asaas: a taxa já saiu no split; só registra quanto foi.
            $dados['taxa_plataforma'] = $this->taxaDaParcela($parcela->cobranca, $parcela);
        }

        $parcela->update($dados);
        $this->atualizarQuitacao($parcela->cobranca);
    }

    private function taxaDaParcela(Cobranca $cobranca, CobrancaParcela $parcela): float
    {
        return round((float) $parcela->valor * ((float) $cobranca->taxa_percentual / 100), 2);
    }

    /** Quando todas as parcelas estão pagas, a cobrança vira "quitada". */
    private function atualizarQuitacao(Cobranca $cobranca): void
    {
        $cobranca->refresh()->load('parcelas');

        if ($cobranca->status === Cobranca::STATUS_ACEITA
            && $cobranca->parcelas->isNotEmpty()
            && $cobranca->parcelas->every(fn (CobrancaParcela $p) => $p->status === CobrancaParcela::PAGO)) {
            $cobranca->update(['status' => Cobranca::STATUS_QUITADA]);
        }
    }

    /** @param string[] $permitidos */
    private function exigirStatus(Cobranca $cobranca, array $permitidos, string $mensagem): void
    {
        if (!in_array($cobranca->status, $permitidos, true)) {
            throw new \DomainException($mensagem);
        }
    }

    private function asaas(string $metodo, string $caminho, array $dados = [])
    {
        $http = Http::withHeaders(['access_token' => config('services.asaas.key')]);
        $url = config('services.asaas.url') . $caminho;

        return match ($metodo) {
            'get' => $http->get($url),
            'delete' => $http->delete($url),
            default => $http->post($url, $dados),
        };
    }
}
