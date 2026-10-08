<?php

namespace App\Services\Entregas;

use App\Models\Agendamento;
use App\Models\AssinaturaEntrega;
use App\Models\NotificacaoUsuario;
use App\Models\PedidoEntrega;
use App\Models\ProdutoEntrega;
use App\Models\User;
use App\Support\StatusFuncionamento;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/** Regras dos recursos de produtos para entrega: recompra, pontos, fila, vendas, rastreio e assinatura. */
class EntregasRecursosService
{
    private const FUSO = StatusFuncionamento::FUSO;

    /**
     * Produtos que o cliente compra com regularidade (2+ entregas), com a previsão da próxima compra.
     * Só sugere produtos ainda ativos.
     */
    public function sugestoesDeRecompra(User $cliente): array
    {
        $pedidos = PedidoEntrega::with('produto:id,nome,fotos,ativo')
            ->where('cliente_id', $cliente->id)
            ->where('status', 'concluido')
            ->whereNotNull('data_conclusao')
            ->orderBy('data_conclusao')
            ->get()
            ->groupBy('produto_entrega_id');

        $sugestoes = [];
        foreach ($pedidos as $lista) {
            $produto = $lista->first()->produto;
            if (!$produto || !$produto->ativo || $lista->count() < 2) {
                continue;
            }

            $datas = $lista->map(fn ($p) => Carbon::parse($p->data_conclusao)->startOfDay())->values();
            $intervalos = [];
            for ($i = 1; $i < $datas->count(); $i++) {
                $intervalos[] = $datas[$i - 1]->diffInDays($datas[$i]);
            }
            $intervaloMedio = max(1, (int) round(array_sum($intervalos) / count($intervalos)));
            $ultima = $datas->last();
            $proxima = $ultima->copy()->addDays($intervaloMedio);

            $sugestoes[] = [
                'produto_entrega_id' => $produto->id,
                'nome' => $produto->nome,
                'fotos' => $produto->fotos,
                'compras' => $lista->count(),
                'intervalo_dias' => $intervaloMedio,
                'ultima_compra_em' => $ultima->toDateString(),
                'proxima_prevista_em' => $proxima->toDateString(),
                'pronta_para_repetir' => $proxima->lte(now(self::FUSO)->startOfDay()),
            ];
        }

        usort($sugestoes, fn ($a, $b) => strcmp($a['proxima_prevista_em'], $b['proxima_prevista_em']));

        return $sugestoes;
    }

    /** Lembra o cliente de repor um produto que chegou no ponto de recompra (um aviso por produto e dia). */
    public function enviarLembretesDeRecompra(): int
    {
        $enviados = 0;

        User::where('papel', 'user')->chunkById(200, function ($clientes) use (&$enviados) {
            foreach ($clientes as $cliente) {
                foreach ($this->sugestoesDeRecompra($cliente) as $sugestao) {
                    if (!$sugestao['pronta_para_repetir']) {
                        continue;
                    }

                    $titulo = 'Hora de repor';
                    $jaAvisado = NotificacaoUsuario::where('usuario_id', $cliente->id)
                        ->where('titulo', $titulo)
                        ->where('mensagem', 'like', '%"' . $sugestao['nome'] . '"%')
                        ->where('created_at', '>=', now(self::FUSO)->startOfDay())
                        ->exists();

                    if ($jaAvisado) {
                        continue;
                    }

                    NotificacaoUsuario::avisar($cliente->id, $titulo, "Está na hora de repor \"{$sugestao['nome']}\". Compre de novo em alguns toques.");
                    $enviados++;
                }
            }
        });

        return $enviados;
    }

    /**
     * Pontos de fidelidade pela entrega concluída (1 ponto por R$ 1), gravados no mesmo formato
     * que o webhook usa para os demais pagamentos. Concedido uma única vez por pedido.
     */
    public function concederPontos(PedidoEntrega $pedido): int
    {
        if (!$pedido->estabelecimento_id || $pedido->pontos_concedidos_em) {
            return 0;
        }

        $pontos = $this->pontosDaCompra($pedido);
        if ($pontos <= 0) {
            return 0;
        }

        $concedidos = DB::transaction(function () use ($pedido, $pontos) {
            // Marca primeiro e só segue quem conseguiu marcar: duas chamadas juntas nunca dão pontos em dobro.
            $marcou = PedidoEntrega::whereKey($pedido->id)->whereNull('pontos_concedidos_em')->update(['pontos_concedidos_em' => now()]);
            if (!$marcou) {
                return false;
            }

            DB::table('historico_pontos')->insert([
                'usuario_id' => $pedido->cliente_id,
                'estabelecimento_id' => $pedido->estabelecimento_id,
                'tipo' => 'ganho',
                'descricao' => 'Pontos da entrega ' . $pedido->codigo_pedido,
                'quantidade' => $pontos,
                'created_at' => now(),
            ]);

            $registro = DB::table('pontos_usuario_estabelecimento')
                ->where('usuario_id', $pedido->cliente_id)
                ->where('estabelecimento_id', $pedido->estabelecimento_id);

            if ($registro->exists()) {
                $registro->increment('total_pontos', $pontos, ['updated_at' => now()]);
            } else {
                DB::table('pontos_usuario_estabelecimento')->insert([
                    'usuario_id' => $pedido->cliente_id,
                    'estabelecimento_id' => $pedido->estabelecimento_id,
                    'total_pontos' => $pontos,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            return true;
        });

        if (!$concedidos) {
            return 0;
        }

        return $pontos;
    }

    /**
     * Pontos por real gasto conforme o plano do cliente: Premium Plus rende 3 por R$ 1, qualquer
     * outro plano premium 1 por R$ 1, e quem não tem plano 0,5 por R$ 1.
     */
    public function pontosDaCompra(PedidoEntrega $pedido): int
    {
        $cliente = $pedido->cliente ?? User::find($pedido->cliente_id);
        $taxa = match (true) {
            $cliente?->plano_assinatura === 'premium-plus' && $cliente->isPremium() => 3.0,
            (bool) $cliente?->isPremium() => 1.0,
            default => 0.5,
        };

        // Pontos sobre o valor dos produtos; a taxa de entrega (frete) não gera pontos.
        $valorProdutos = max(0.0, (float) $pedido->valor_total - (float) $pedido->taxa_entrega);

        return (int) floor($valorProdutos * $taxa);
    }

    /** Bônus fixo quando o cliente avalia a compra (só se o local recebe pontos). */
    public const PONTOS_BONUS_AVALIACAO = 10;

    public function creditarBonusAvaliacao(PedidoEntrega $pedido): void
    {
        if (!$pedido->estabelecimento_id) {
            return;
        }

        DB::transaction(function () use ($pedido) {
            DB::table('historico_pontos')->insert([
                'usuario_id' => $pedido->cliente_id,
                'estabelecimento_id' => $pedido->estabelecimento_id,
                'tipo' => 'ganho',
                'descricao' => 'Bônus por avaliar a entrega ' . $pedido->codigo_pedido,
                'quantidade' => self::PONTOS_BONUS_AVALIACAO,
                'created_at' => now(),
            ]);

            $registro = DB::table('pontos_usuario_estabelecimento')
                ->where('usuario_id', $pedido->cliente_id)
                ->where('estabelecimento_id', $pedido->estabelecimento_id);

            if ($registro->exists()) {
                $registro->increment('total_pontos', self::PONTOS_BONUS_AVALIACAO, ['updated_at' => now()]);
            } else {
                DB::table('pontos_usuario_estabelecimento')->insert([
                    'usuario_id' => $pedido->cliente_id,
                    'estabelecimento_id' => $pedido->estabelecimento_id,
                    'total_pontos' => self::PONTOS_BONUS_AVALIACAO,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        });
    }

    /** O rastreio do entregador só existe quando o vendedor é sócio premium (premium-socio ou premium-socio-anual). */
    public static function vendedorMonitora(PedidoEntrega $pedido): bool
    {
        $vendedor = $pedido->vendedor ?? User::find($pedido->vendedor_id);

        return (bool) $vendedor?->podeGerenciarEquipeAvancada();
    }

    /**
     * Avisa o cliente quando faltam até 2 atendimentos para a vez dele no dia.
     * Um aviso por agendamento (grava aviso_vez_em). Devolve quantos avisos foram enviados.
     */
    public function avisarVezNaFila(): int
    {
        $hoje = now(self::FUSO)->toDateString();
        $enviados = 0;

        $porLocal = Agendamento::whereDate('data_agendamento', $hoje)
            ->whereIn('status', ['pendente', 'confirmado', 'em_atendimento'])
            ->orderBy('hora_agendamento')
            ->get()
            ->groupBy('estabelecimento_id');

        foreach ($porLocal as $estabelecimentoId => $fila) {
            $aguardando = $fila->whereIn('status', ['pendente', 'confirmado']);

            foreach ($aguardando as $agendamento) {
                if ($agendamento->aviso_vez_em) {
                    continue;
                }

                $naFrente = $fila->filter(fn ($a) => $a->hora_agendamento < $agendamento->hora_agendamento)->count();
                if ($naFrente > 2) {
                    continue;
                }

                $local = DB::table('estabelecimentos')->where('id', $estabelecimentoId)->value('nome') ?? 'o local';
                $texto = $naFrente === 0
                    ? "É a sua vez no {$local}. Pode vir!"
                    : "Faltam {$naFrente} atendimento(s) para a sua vez no {$local}.";

                NotificacaoUsuario::avisar($agendamento->usuario_id, 'Sua vez está chegando', $texto);
                $agendamento->update(['aviso_vez_em' => now()]);
                $enviados++;
            }
        }

        return $enviados;
    }

    /**
     * Painel do vendedor: faturamento, pedidos, ticket médio, produtos mais vendidos e
     * horários de pico, com base nas entregas concluídas no período.
     */
    public function painelDeVendas(User $vendedor, int $dias = 30): array
    {
        $inicio = now(self::FUSO)->subDays($dias)->startOfDay();
        $base = PedidoEntrega::where('vendedor_id', $vendedor->id)
            ->where('status', 'concluido')
            ->where('data_conclusao', '>=', $inicio);

        $faturamento = (float) (clone $base)->sum('valor_total');
        $pedidos = (int) (clone $base)->count();

        $topProdutos = (clone $base)
            ->select('produto_entrega_id', DB::raw('SUM(quantidade) as unidades'), DB::raw('SUM(valor_total) as receita'))
            ->groupBy('produto_entrega_id')
            ->orderByDesc('receita')
            ->limit(5)
            ->get()
            ->map(function ($linha) {
                $produto = ProdutoEntrega::withTrashed()->find($linha->produto_entrega_id);

                return [
                    'produto_entrega_id' => $linha->produto_entrega_id,
                    'nome' => $produto?->nome ?? 'Produto removido',
                    'unidades' => (int) $linha->unidades,
                    'receita' => round((float) $linha->receita, 2),
                ];
            })
            ->values()
            ->all();

        $horaLocal = "EXTRACT(HOUR FROM (data_conclusao AT TIME ZONE 'UTC' AT TIME ZONE '" . self::FUSO . "'))";
        $picoPorHora = (clone $base)
            ->select(DB::raw("{$horaLocal} as hora"), DB::raw('COUNT(*) as pedidos'))
            ->groupBy(DB::raw($horaLocal))
            ->orderBy(DB::raw($horaLocal))
            ->get()
            ->map(fn ($l) => ['hora' => (int) $l->hora, 'pedidos' => (int) $l->pedidos])
            ->values()
            ->all();

        return [
            'periodo_dias' => $dias,
            'faturamento' => round($faturamento, 2),
            'pedidos' => $pedidos,
            'ticket_medio' => $pedidos ? round($faturamento / $pedidos, 2) : 0,
            'produtos_vendidos' => (int) $vendedor->produtos_vendidos,
            'top_produtos' => $topProdutos,
            'pico_por_hora' => $picoPorHora,
        ];
    }

    /** Posição do entregador, enviada enquanto o pedido está em rota. */
    public function registrarPosicao(PedidoEntrega $pedido, float $lat, float $lng): void
    {
        $pedido->update([
            'em_rota_em' => $pedido->em_rota_em ?? now(),
            'posicao_lat' => $lat,
            'posicao_lng' => $lng,
            'posicao_atualizada_em' => now(),
        ]);
    }

    /**
     * Gera o pedido de cada entrega vencida da assinatura. Só para pagamento no local ou direto
     * com o vendedor: cobrança recorrente online exige nova autorização do cliente a cada ciclo.
     */
    public function processarAssinaturasVencidas(): int
    {
        $hoje = now(self::FUSO)->toDateString();
        $geradas = 0;

        AssinaturaEntrega::with('produto')
            ->where('status', 'ativa')
            ->whereDate('proxima_entrega_em', '<=', $hoje)
            ->get()
            ->each(function (AssinaturaEntrega $assinatura) use (&$geradas) {
                $produto = $assinatura->produto;

                if (!$produto || !$produto->ativo || $produto->estoque_disponivel < $assinatura->quantidade) {
                    $assinatura->update(['proxima_entrega_em' => now(self::FUSO)->addDay()->toDateString()]);
                    return;
                }

                $endereco = $assinatura->endereco ?? [];
                $valorProdutos = (float) $produto->valor_final * $assinatura->quantidade;
                $taxa = $assinatura->modo_recebimento === 'entrega' ? (float) $produto->taxa_entrega : 0.0;

                DB::transaction(function () use ($assinatura, $produto, $endereco, $valorProdutos, $taxa, &$geradas) {
                    PedidoEntrega::create([
                        'codigo_pedido' => 'ENT-ASS-' . strtoupper(uniqid()),
                        'codigo_confirmacao' => str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT),
                        'cliente_id' => $assinatura->cliente_id,
                        'produto_entrega_id' => $produto->id,
                        'vendedor_id' => $produto->usuario_id,
                        'estabelecimento_id' => $produto->estabelecimento_id,
                        'quantidade' => $assinatura->quantidade,
                        'valor_unitario' => $produto->valor_final,
                        'valor_total' => round($valorProdutos + $taxa, 2),
                        'taxa_plataforma' => 0,
                        'taxa_entrega' => $taxa,
                        'modo_recebimento' => $assinatura->modo_recebimento,
                        'modo_pagamento' => $assinatura->modo_pagamento,
                        'origem_rua' => $produto->endereco_rua,
                        'origem_numero' => $produto->endereco_numero,
                        'origem_complemento' => $produto->endereco_complemento,
                        'origem_bairro' => $produto->endereco_bairro,
                        'origem_cidade' => $produto->endereco_cidade,
                        'origem_estado' => $produto->endereco_estado,
                        'origem_cep' => $produto->endereco_cep,
                        'entrega_cep' => $endereco['cep'] ?? null,
                        'entrega_rua' => $endereco['rua'] ?? null,
                        'entrega_numero' => $endereco['numero'] ?? null,
                        'entrega_complemento' => $endereco['complemento'] ?? null,
                        'entrega_bairro' => $endereco['bairro'] ?? null,
                        'entrega_cidade' => $endereco['cidade'] ?? null,
                        'entrega_estado' => $endereco['estado'] ?? null,
                        'entrega_observacoes' => $endereco['observacoes'] ?? null,
                        'status' => 'aguardando_confirmacao',
                    ]);

                    $produto->decrement('estoque_disponivel', $assinatura->quantidade);
                    $assinatura->update([
                        'proxima_entrega_em' => Carbon::parse($assinatura->proxima_entrega_em)->addDays($assinatura->frequencia_dias)->toDateString(),
                    ]);

                    NotificacaoUsuario::avisar(
                        $assinatura->cliente_id,
                        'Entrega da assinatura',
                        "Sua entrega recorrente de \"{$produto->nome}\" foi gerada. Mostre o código ao vendedor."
                    );
                    $geradas++;
                });
            });

        return $geradas;
    }
}
