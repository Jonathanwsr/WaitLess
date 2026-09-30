<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Sugestao;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

/** Painel admin do programa de gamificação: sugestões enviadas, check-ins e bônus mensal. */
class AdminGamificacaoController extends Controller
{
    public function index(Request $request)
    {
        $status = $request->query('status');

        $sugestoes = Sugestao::with('usuario:id,name,email')
            ->when($status, fn ($q) => $q->where('status', $status))
            ->orderByDesc('created_at')
            ->paginate(20)
            ->withQueryString();

        $hoje = now()->toDateString();
        $mesAtual = now()->format('Y-m');

        $estatisticas = [
            'checkins_hoje' => DB::table('checkins_gamificacao')->where('data', $hoje)->count(),
            'checkins_pontos_hoje' => (int) DB::table('checkins_gamificacao')->where('data', $hoje)->sum('pontos'),
            'sugestoes_pendentes' => Sugestao::where('status', 'pendente')->count(),
            'sugestoes_total' => Sugestao::count(),
            'bonus_mensal_creditados' => DB::table('bonus_mensal_gamificacao')->where('ano_mes', $mesAtual)->count(),
            'bonus_mensal_pontos' => (int) DB::table('bonus_mensal_gamificacao')->where('ano_mes', $mesAtual)->sum('pontos'),
        ];

        return Inertia::render('Admin/Gamificacao', [
            'sugestoes' => $sugestoes,
            'estatisticas' => $estatisticas,
            'statusFiltro' => $status,
        ]);
    }

    public function responder(Request $request, Sugestao $sugestao)
    {
        $dados = $request->validate([
            'status' => 'required|in:pendente,em_analise,respondida,arquivada',
            'resposta_admin' => 'nullable|string|max:2000',
        ]);

        $sugestao->update($dados);

        return back()->with('success', 'Sugestão atualizada.');
    }
}
