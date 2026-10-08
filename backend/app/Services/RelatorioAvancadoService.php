<?php

namespace App\Services;

use App\Models\Agendamento;
use App\Models\Funcionario;
use App\Models\PedidoEntrega;
use App\Models\Servico;
use App\Models\User;
use Carbon\Carbon;

/**
 * Relatório avançado do sócio/gerente — exclusivo para quem tem algum plano
 * Premium (qualquer nível, ver PlanoService::PLANOS_PREMIUM['socio']). Junta
 * faturamento histórico, produtividade da equipe, serviços mais vendidos,
 * cancelamento e retenção de clientes de todos os estabelecimentos que o
 * usuário gerencia. Compartilhado entre o painel web (Inertia) e o app
 * mobile (JSON), pra não duplicar a regra de negócio nos dois.
 */
class RelatorioAvancadoService
{
    public function ehPremium(User $user): bool
    {
        // Reaproveita User::isPremium() — ela já confere expiração do plano,
        // o que a checagem anterior (só o nome do plano) deixava passar batido:
        // um sócio com plano Premium vencido continuaria vendo o relatório completo.
        return $user->isPremium();
    }

    /** @return array{bloqueado: bool, semDados?: bool, ...} */
    public function montar(User $user): array
    {
        if (!$this->ehPremium($user)) {
            return ['bloqueado' => true];
        }

        $estabelecimentoIds = $user->estabelecimentos()->pluck('estabelecimentos.id');

        if ($estabelecimentoIds->isEmpty()) {
            return ['bloqueado' => false, 'semDados' => true];
        }

        // Faturamento dos últimos 6 meses (serviços).
        $meses = collect(range(5, 0))->map(fn ($i) => Carbon::now()->subMonths($i)->startOfMonth());
        $faturamentoPorMes = $meses->map(function (Carbon $mes) use ($estabelecimentoIds) {
            $inicio = $mes->copy()->startOfMonth()->toDateString();
            $fim = $mes->copy()->endOfMonth()->toDateString();

            $valorServicos = (float) Agendamento::whereIn('estabelecimento_id', $estabelecimentoIds)
                ->whereIn('status', ['finalizado'])
                ->whereBetween('data_agendamento', [$inicio, $fim])
                ->sum('valor_final');

            // Vendas de produtos para entrega/retirada concluídas no mês (mesma data de conclusão usada no relatório semanal).
            $valorProdutos = (float) PedidoEntrega::whereIn('estabelecimento_id', $estabelecimentoIds)
                ->where('status', 'concluido')
                ->whereBetween('data_conclusao', [$mes->copy()->startOfMonth(), $mes->copy()->endOfMonth()])
                ->sum('valor_total');

            return [
                'mes' => $mes->translatedFormat('M/y'),
                'valor' => round($valorServicos + $valorProdutos, 2),
                'valor_produtos' => round($valorProdutos, 2),
            ];
        })->values();

        $faturamentoMesAtual = (float) ($faturamentoPorMes->last()['valor'] ?? 0);
        $faturamentoMesAnterior = (float) ($faturamentoPorMes->slice(-2, 1)->first()['valor'] ?? 0);
        $crescimentoPercentual = $faturamentoMesAnterior > 0
            ? round((($faturamentoMesAtual - $faturamentoMesAnterior) / $faturamentoMesAnterior) * 100, 1)
            : null;

        $inicioMes = Carbon::now()->startOfMonth()->toDateString();
        $fimMes = Carbon::now()->endOfMonth()->toDateString();

        $agendamentosDoMes = Agendamento::whereIn('estabelecimento_id', $estabelecimentoIds)
            ->whereBetween('data_agendamento', [$inicioMes, $fimMes])
            ->get(['id', 'usuario_id', 'servico_id', 'funcionario_id', 'hora_agendamento', 'status', 'valor_final']);

        $finalizadosDoMes = $agendamentosDoMes->where('status', 'finalizado');
        $canceladosDoMes = $agendamentosDoMes->where('status', 'cancelado');

        $taxaCancelamento = $agendamentosDoMes->count() > 0
            ? round(($canceladosDoMes->count() / $agendamentosDoMes->count()) * 100, 1)
            : 0;

        $ticketMedio = $finalizadosDoMes->count() > 0
            ? round((float) $finalizadosDoMes->sum('valor_final') / $finalizadosDoMes->count(), 2)
            : 0;

        $rankingFuncionarios = $finalizadosDoMes
            ->filter(fn ($a) => $a->funcionario_id)
            ->groupBy('funcionario_id')
            ->map(function ($grupo) {
                $funcionario = Funcionario::find($grupo->first()->funcionario_id);
                return [
                    'nome' => $funcionario->nome ?? 'Funcionário',
                    'atendimentos' => $grupo->count(),
                    'faturamento' => round((float) $grupo->sum('valor_final'), 2),
                ];
            })
            ->sortByDesc('faturamento')
            ->take(8)
            ->values();

        $servicosMaisVendidos = $finalizadosDoMes
            ->filter(fn ($a) => $a->servico_id)
            ->groupBy('servico_id')
            ->map(function ($grupo) {
                $servico = Servico::find($grupo->first()->servico_id);
                return [
                    'nome' => $servico->nome ?? 'Serviço',
                    'quantidade' => $grupo->count(),
                    'faturamento' => round((float) $grupo->sum('valor_final'), 2),
                ];
            })
            ->sortByDesc('quantidade')
            ->take(8)
            ->values();

        $horariosPico = $agendamentosDoMes
            ->groupBy(fn ($a) => substr((string) $a->hora_agendamento, 0, 2) . 'h')
            ->map(fn ($grupo, $hora) => ['hora' => $hora, 'quantidade' => $grupo->count()])
            ->sortByDesc('quantidade')
            ->take(5)
            ->values();

        $clientesDoMes = $agendamentosDoMes->pluck('usuario_id')->unique();
        $clientesNovos = $clientesDoMes->filter(function ($usuarioId) use ($estabelecimentoIds, $inicioMes) {
            return !Agendamento::whereIn('estabelecimento_id', $estabelecimentoIds)
                ->where('usuario_id', $usuarioId)
                ->where('data_agendamento', '<', $inicioMes)
                ->exists();
        })->count();
        $clientesRecorrentes = max(0, $clientesDoMes->count() - $clientesNovos);

        return [
            'bloqueado' => false,
            'faturamento_por_mes' => $faturamentoPorMes,
            'resumo' => [
                'faturamento_mes_atual' => $faturamentoMesAtual,
                'crescimento_percentual' => $crescimentoPercentual,
                'ticket_medio' => $ticketMedio,
                'taxa_cancelamento' => $taxaCancelamento,
                'atendimentos_mes' => $finalizadosDoMes->count(),
                'clientes_novos' => $clientesNovos,
                'clientes_recorrentes' => $clientesRecorrentes,
            ],
            'ranking_funcionarios' => $rankingFuncionarios,
            'servicos_mais_vendidos' => $servicosMaisVendidos,
            'horarios_pico' => $horariosPico,
        ];
    }
}
