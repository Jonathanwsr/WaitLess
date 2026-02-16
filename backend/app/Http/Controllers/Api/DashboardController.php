<?php

namespace App\Http\Controllers\Api;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class DashboardController extends Controller
{
    public function index()
    {
        $estabelecimentos = Auth::user()->estabelecimentosGerenciados()
            ->select('estabelecimentos.id', 'nome', 'foto_perfil', 'avaliacao_media', 'arrecadacao_total', 'ativo')
            ->withCount([
                'agendamentos as fila_agora' => function ($query) {
                    $query->whereDate('data_agendamento', now()->toDateString())
                          ->whereIn('status', ['pendente', 'confirmado']);
                },
                'funcionarios'
            ])
            ->get();

        $totalClientesFila = $estabelecimentos->sum('fila_agora');
        $totalArrecadado = $estabelecimentos->sum('arrecadacao_total');
        $estabelecimentosAtivos = $estabelecimentos->where('ativo', true)->count();

        return Inertia::render('Dashboard', [
            'estabelecimentos' => $estabelecimentos,
            'metricas' => [
                'total_fila' => $totalClientesFila,
                'total_arrecadado' => $totalArrecadado,
                'ativos' => $estabelecimentosAtivos,
            ]
        ]);
    }
}