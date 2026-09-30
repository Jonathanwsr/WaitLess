<?php

namespace App\Services;

use App\Models\Agendamento;
use App\Models\Aluguel;
use App\Models\CustoOperacional;
use App\Models\Estorno;
use App\Models\Pagamento;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Agrega, pra área reservada do admin (Admin/Relatorios), o dinheiro que
 * passa pela plataforma inteira: quanto entra (GMV), quanto a plataforma
 * retém de taxa, quanto sai como repasse pra proprietários, quanto sai como
 * estorno pra clientes, e quanto é gasto com operação (APIs externas,
 * e-mail, IA, hospedagem) — pra chegar num lucro líquido real.
 *
 * Nota de schema: `agendamentos` não guarda a taxa da plataforma na própria
 * linha (só `valor_final`) — a taxa de um serviço só existe quando o
 * agendamento tem um Pagamento online vinculado (`pagamentos.taxa`); reservas
 * presenciais não geram Pagamento. Já `alugueis.taxa_plataforma` é sempre
 * preenchido. Por isso a receita retida soma as duas fontes.
 */
class AdminRelatorioService
{
    private function periodoDe(?string $mesReferencia): ?Carbon
    {
        return $mesReferencia ? Carbon::parse($mesReferencia . '-01') : null;
    }

    public function resumoFinanceiro(?string $mesReferencia = null): array
    {
        $competencia = $this->periodoDe($mesReferencia);

        $agendamentosQuery = Agendamento::whereNotIn('status', ['cancelado']);
        $alugueisQuery = Aluguel::whereNotIn('status', ['cancelado']);
        $pagamentosTaxaQuery = Pagamento::where('status', 'pago')->whereNotNull('agendamento_id');
        $estornosQuery = Estorno::where('status', 'ESTORNADO');
        $custosQuery = CustoOperacional::query();

        if ($competencia) {
            $agendamentosQuery->whereYear('created_at', $competencia->year)->whereMonth('created_at', $competencia->month);
            $alugueisQuery->whereYear('created_at', $competencia->year)->whereMonth('created_at', $competencia->month);
            $pagamentosTaxaQuery->whereYear('data_pagamento', $competencia->year)->whereMonth('data_pagamento', $competencia->month);
            $estornosQuery->whereYear('data_estorno', $competencia->year)->whereMonth('data_estorno', $competencia->month);
            $custosQuery->whereYear('competencia', $competencia->year)->whereMonth('competencia', $competencia->month);
        }

        $volumeServicos = (float) (clone $agendamentosQuery)->sum('valor_final');
        $volumeAlugueis = (float) (clone $alugueisQuery)->sum('valor_total');
        $volumeTotal = $volumeServicos + $volumeAlugueis;

        $taxaServicos = (float) (clone $pagamentosTaxaQuery)->sum('taxa');
        $taxaAlugueis = (float) (clone $alugueisQuery)->sum('taxa_plataforma');
        $receitaPlataforma = $taxaServicos + $taxaAlugueis;

        $totalRepassado = (float) DB::table('extrato_providers')
            ->where('tipo', 'repasse')
            ->when($competencia, fn ($q) => $q->whereYear('created_at', $competencia->year)->whereMonth('created_at', $competencia->month))
            ->sum('valor_bruto');

        $totalEstornado = (float) (clone $estornosQuery)->sum('valor_estornado');
        $totalCustos = (float) (clone $custosQuery)->sum('valor');

        return [
            'competencia' => $competencia?->format('Y-m'),
            'volume_total_transacionado' => $volumeTotal,
            'volume_servicos' => $volumeServicos,
            'volume_alugueis' => $volumeAlugueis,
            'receita_plataforma' => $receitaPlataforma,
            'valor_repassado_proprietarios' => $totalRepassado,
            'total_estornado' => $totalEstornado,
            'total_custos_operacionais' => $totalCustos,
            'lucro_liquido_real' => $receitaPlataforma - $totalEstornado - $totalCustos,
        ];
    }

    /** Evolução mensal (últimos $meses meses) da receita retida, repasses, estornos, custos e lucro. */
    public function evolucaoMensal(int $meses = 6): array
    {
        $resultado = [];

        for ($i = $meses - 1; $i >= 0; $i--) {
            $mes = Carbon::now()->subMonths($i);
            $resumo = $this->resumoFinanceiro($mes->format('Y-m'));
            $resultado[] = [
                'mes' => $mes->format('Y-m'),
                'label' => $mes->format('m/Y'),
                'volume' => $resumo['volume_total_transacionado'],
                'receita_plataforma' => $resumo['receita_plataforma'],
                'repassado' => $resumo['valor_repassado_proprietarios'],
                'estornado' => $resumo['total_estornado'],
                'custos' => $resumo['total_custos_operacionais'],
                'lucro' => $resumo['lucro_liquido_real'],
            ];
        }

        return $resultado;
    }

    /** Repasses feitos a cada proprietário/sócio, a partir do extrato real de transferências PIX. */
    public function repassesPorProprietario(): array
    {
        return DB::table('extrato_providers')
            ->join('providers', 'extrato_providers.provider_id', '=', 'providers.id')
            ->join('users', 'providers.user_id', '=', 'users.id')
            ->where('extrato_providers.tipo', 'repasse')
            ->select(
                'users.id as usuario_id',
                'users.name as proprietario_nome',
                'users.email as proprietario_email',
                DB::raw('COUNT(*) as total_repasses'),
                DB::raw('SUM(extrato_providers.valor_bruto) as total_repassado'),
                DB::raw('MAX(extrato_providers.created_at) as ultimo_repasse')
            )
            ->groupBy('users.id', 'users.name', 'users.email')
            ->orderByDesc('total_repassado')
            ->get()
            ->map(fn ($r) => [
                'usuario_id' => $r->usuario_id,
                'proprietario_nome' => $r->proprietario_nome,
                'proprietario_email' => $r->proprietario_email,
                'total_repasses' => (int) $r->total_repasses,
                'total_repassado' => (float) $r->total_repassado,
                'ultimo_repasse' => $r->ultimo_repasse,
            ])
            ->values()
            ->all();
    }

    /** Resumo de estornos: contagem/valor por status, e os concluídos mais recentes. */
    public function resumoEstornos(int $limite = 15): array
    {
        $porStatus = Estorno::selectRaw('status, COUNT(*) as total, SUM(valor_estornado) as valor')
            ->groupBy('status')
            ->get()
            ->map(fn ($r) => ['status' => $r->status, 'total' => (int) $r->total, 'valor' => (float) $r->valor])
            ->values();

        $recentes = Estorno::with(['cliente:id,name,email', 'prestador:id,name'])
            ->where('status', 'ESTORNADO')
            ->orderByDesc('data_estorno')
            ->limit($limite)
            ->get()
            ->map(fn ($e) => [
                'id' => $e->id,
                'codigo_estorno' => $e->codigo_estorno,
                'cliente_nome' => $e->cliente?->name,
                'prestador_nome' => $e->prestador?->name,
                'categoria' => $e->categoria,
                'valor_estornado' => (float) $e->valor_estornado,
                'motivo' => $e->motivo,
                'data_estorno' => $e->data_estorno,
            ]);

        return ['por_status' => $porStatus, 'recentes' => $recentes];
    }

    /** Planos ativos, pontos distribuídos/gastos e uso de cupons/promoções por clientes. */
    public function resumoClientes(): array
    {
        $baseClientesPremium = User::where('papel', 'user')
            ->whereNotNull('plano_assinatura')
            ->where('plano_assinatura', '!=', 'gratuito')
            ->where('plano_expira_em', '>', now());

        $porPlano = (clone $baseClientesPremium)
            ->selectRaw('plano_assinatura, COUNT(*) as total')
            ->groupBy('plano_assinatura')
            ->get();

        $pontosDistribuidos = (int) DB::table('historico_pontos')->where('tipo', 'ganho')->sum('quantidade');
        $pontosGastos = (int) DB::table('historico_pontos')->where('tipo', 'uso')->sum('quantidade');

        $descontoPontos = (float) DB::table('agendamentos')->sum('valor_desconto_pontos')
            + (float) DB::table('alugueis')->sum('valor_desconto_pontos');
        $descontoCupons = (float) DB::table('agendamentos')->sum('valor_desconto_cupom')
            + (float) DB::table('alugueis')->sum('valor_desconto_cupom');

        $cuponsUsados = (int) DB::table('cupom_user')->where('usado', true)->count();

        $promocoes = DB::table('promocoes')
            ->select('id', 'nome', 'tipo', 'ativo', 'utilizacoes_atuais', 'limite_utilizacao', 'data_inicio', 'data_fim')
            ->orderByDesc('utilizacoes_atuais')
            ->get();

        return [
            'total_clientes' => User::where('papel', 'user')->count(),
            'clientes_premium' => (clone $baseClientesPremium)->count(),
            'por_plano' => $porPlano,
            'pontos_distribuidos' => $pontosDistribuidos,
            'pontos_gastos' => $pontosGastos,
            'saldo_pontos_em_aberto' => (int) User::sum('pontos_saldo'),
            'valor_descontado_em_pontos' => $descontoPontos,
            'valor_descontado_em_cupons' => $descontoCupons,
            'cupons_usados' => $cuponsUsados,
            'promocoes' => $promocoes,
        ];
    }

    public function custosOperacionais(?string $mesReferencia = null)
    {
        $competencia = $this->periodoDe($mesReferencia);

        return CustoOperacional::with('criador:id,name')
            ->when($competencia, fn ($q) => $q->whereYear('competencia', $competencia->year)->whereMonth('competencia', $competencia->month))
            ->orderByDesc('competencia')
            ->orderByDesc('id')
            ->get();
    }

    public function custosPorCategoria(?string $mesReferencia = null): array
    {
        $competencia = $this->periodoDe($mesReferencia);

        return CustoOperacional::selectRaw('categoria, SUM(valor) as total')
            ->when($competencia, fn ($q) => $q->whereYear('competencia', $competencia->year)->whereMonth('competencia', $competencia->month))
            ->groupBy('categoria')
            ->get()
            ->map(fn ($r) => ['categoria' => $r->categoria, 'total' => (float) $r->total])
            ->values()
            ->all();
    }
}
