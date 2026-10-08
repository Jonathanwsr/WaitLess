<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Models\Agendamento;
use App\Models\Aluguel;
use Carbon\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class RelatorioPremiumMobileController extends Controller
{
    /**
     * Relatório detalhado do cliente Premium: junta tudo que o sistema sabe
     * sobre o uso dele (agendamentos + locações, pontos, economia, favoritos)
     * num único retorno pronto para a tela com gráficos no app.
     */
    public function relatorio()
    {
        $user = Auth::user();

        // User::isPremium() confere nome do plano E expiração — a checagem
        // anterior (só o nome) deixava um cliente com Premium vencido
        // continuar vendo o relatório completo pra sempre.
        if (!$user->isPremium()) {
            return response()->json(['error' => 'Este relatório é exclusivo para assinantes Premium.'], 403);
        }

        $statusPagos = ['confirmado', 'em_atendimento', 'finalizado'];
        $statusAlugueisPagos = ['confirmado', 'em_andamento', 'finalizado'];

        $agendamentos = Agendamento::where('usuario_id', $user->id)
            ->whereIn('status', $statusPagos)
            ->with('estabelecimento:id,nome,ramo_atuacao')
            ->get(['id', 'estabelecimento_id', 'data_agendamento', 'valor_final', 'valor_desconto_pontos', 'valor_desconto_cupom', 'nota']);

        $alugueis = Aluguel::where('locatario_id', $user->id)
            ->whereIn('status', $statusAlugueisPagos)
            ->with('item:id,nome,categoria')
            ->get(['id', 'item_aluguel_id', 'data_inicio', 'valor_total', 'valor_desconto_promocional']);

        $totalGastoServicos = (float) $agendamentos->sum('valor_final');
        $totalGastoLocacoes = (float) $alugueis->sum('valor_total');
        $totalEconomizado = (float) $agendamentos->sum('valor_desconto_pontos') + (float) $agendamentos->sum('valor_desconto_cupom')
            + (float) $alugueis->sum('valor_desconto_promocional');

        // Gasto por mês (últimos 6 meses) — base para o gráfico de barras.
        $meses = collect(range(5, 0))->map(fn ($i) => Carbon::now()->subMonths($i)->startOfMonth());
        $gastoPorMes = $meses->map(function (Carbon $mes) use ($agendamentos, $alugueis) {
            $doMes = fn ($data) => $data && Carbon::parse($data)->isSameMonth($mes) && Carbon::parse($data)->isSameYear($mes);
            $valor = $agendamentos->filter(fn ($a) => $doMes($a->data_agendamento))->sum('valor_final')
                + $alugueis->filter(fn ($a) => $doMes($a->data_inicio))->sum('valor_total');

            return ['mes' => $mes->translatedFormat('M/y'), 'valor' => round((float) $valor, 2)];
        })->values();

        // Estabelecimentos favoritos (por nº de reservas de serviço).
        $favoritos = $agendamentos
            ->filter(fn ($a) => $a->estabelecimento)
            ->groupBy('estabelecimento_id')
            ->map(fn ($grupo) => ['nome' => $grupo->first()->estabelecimento->nome, 'visitas' => $grupo->count()])
            ->sortByDesc('visitas')
            ->take(5)
            ->values();

        // Categorias mais usadas, combinando ramo do estabelecimento (serviços) e categoria do item (locações).
        $categorias = $agendamentos->filter(fn ($a) => $a->estabelecimento?->ramo_atuacao)->pluck('estabelecimento.ramo_atuacao')
            ->merge($alugueis->filter(fn ($a) => $a->item?->categoria)->pluck('item.categoria'))
            ->countBy()
            ->sortByDesc(fn ($qtd) => $qtd)
            ->take(6)
            ->map(fn ($qtd, $nome) => ['nome' => $nome, 'quantidade' => $qtd])
            ->values();

        $pontos = DB::table('historico_pontos')->where('usuario_id', $user->id)
            ->selectRaw("tipo, COALESCE(SUM(quantidade), 0) as total")
            ->groupBy('tipo')
            ->pluck('total', 'tipo');

        return response()->json([
            'resumo' => [
                'total_gasto' => round($totalGastoServicos + $totalGastoLocacoes, 2),
                'total_gasto_servicos' => round($totalGastoServicos, 2),
                'total_gasto_locacoes' => round($totalGastoLocacoes, 2),
                'total_reservas' => $agendamentos->count() + $alugueis->count(),
                'total_servicos' => $agendamentos->count(),
                'total_locacoes' => $alugueis->count(),
                'total_economizado' => round($totalEconomizado, 2),
                'avaliacoes_feitas' => $agendamentos->whereNotNull('nota')->count(),
                'pontos_ganhos' => (int) ($pontos['ganho'] ?? 0),
                'pontos_usados' => (int) ($pontos['uso'] ?? 0),
                'pontos_saldo_atual' => (int) ($user->pontos_saldo ?? 0),
            ],
            'gasto_por_mes' => $gastoPorMes,
            'estabelecimentos_favoritos' => $favoritos,
            'categorias_mais_usadas' => $categorias,
        ]);
    }
}
