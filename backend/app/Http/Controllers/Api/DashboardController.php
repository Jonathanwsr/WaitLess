<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agendamento;
use Illuminate\Http\Request;
use App\Models\Estabelecimento;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Carbon\Carbon;

class DashboardController extends Controller
{
    public function index(Request $request)
    {
        $user = Auth::user();

        // ====================================================
        // 1. DASHBOARD DO DONO / GERENTE
        // ====================================================
        if (in_array($user->papel, ['admin', 'socio', 'gerente'])) {
            $estabelecimentos = $user->estabelecimentosGerenciados()
                ->select('estabelecimentos.id', 'nome', 'foto_perfil', 'avaliacao_media', 'arrecadacao_total', 'ativo')
                ->withCount([
                    'agendamentos as fila_agora' => function ($query) {
                        $query->whereDate('data_agendamento', now()->toDateString())
                              ->whereIn('status', ['pendente', 'confirmado']);
                    },
                    'funcionarios'
                ])
                ->get();

            return Inertia::render('Dashboard', [
                'estabelecimentos' => $estabelecimentos,
                'metricas' => [
                    'total_fila' => $estabelecimentos->sum('fila_agora'),
                    'total_arrecadado' => $estabelecimentos->sum('arrecadacao_total'),
                    'ativos' => $estabelecimentos->where('ativo', true)->count(),
                ]
            ]);
        }

        // ====================================================
        // 2. DASHBOARD DO CLIENTE FINAL
        // ====================================================
        
        // A. Busca Agendamentos ATIVOS (Pendentes, Confirmados, Pagando)
        $meusAgendamentos = Agendamento::with([
                'estabelecimento:id,nome,cidade,estado', 
                'servico:id,nome,valor,duracao_minutos'
            ])
            ->where('usuario_id', $user->id)
            ->whereIn('status', ['pendente', 'confirmado', 'aguardando_pagamento'])
            ->orderBy('data_agendamento', 'asc')
            ->orderBy('hora_agendamento', 'asc')
            ->get();

        foreach ($meusAgendamentos as $agendamento) {
            $pessoasNaFrente = Agendamento::where('estabelecimento_id', $agendamento->estabelecimento_id)
                ->whereDate('data_agendamento', $agendamento->data_agendamento)
                ->whereIn('status', ['pendente', 'confirmado', 'aguardando_pagamento'])
                ->where('hora_agendamento', '<', $agendamento->hora_agendamento)
                ->count();

            $agendamento->pessoas_na_frente = $pessoasNaFrente;
        }

        // B. NOVO: Busca HISTÓRICO de Agendamentos (Concluídos e Cancelados)
        $historicoAgendamentos = Agendamento::with([
                'estabelecimento:id,nome,foto_perfil,cidade', 
                'servico:id,nome,valor,duracao_minutos'
            ])
            ->where('usuario_id', $user->id)
            ->whereIn('status', ['concluido', 'finalizado', 'cancelado'])
            ->orderBy('data_agendamento', 'desc')
            ->orderBy('hora_agendamento', 'desc')
            ->take(20) // Limita os últimos 20 para não pesar a tela inicial
            ->get()
            ->map(function ($item) {
                // Prepara variáveis auxiliares para o Front-end facilitar a exibição
                $item->pode_avaliar = in_array($item->status, ['concluido', 'finalizado']) && is_null($item->nota);
                $item->data_formatada = Carbon::parse($item->data_agendamento)->format('d/m/Y');
                return $item;
            });

        // C. LÓGICA DE GEOLOCALIZAÇÃO: Estabelecimentos Próximos
        $userLat = $request->input('lat');
        $userLng = $request->input('lng');
        $radius = $request->input('radius', 10); // Padrão 10km
        
        $estabelecimentosProximos = [];

        if ($userLat && $userLng) {
            $estabelecimentosProximos = Estabelecimento::withinDistance($userLat, $userLng, $radius)
                ->with(['servicos:id,estabelecimento_id,nome,valor'])
                ->get();
        }

        return Inertia::render('Cliente/Dashboard', [
            'agendamentos' => $meusAgendamentos,
            'historico' => $historicoAgendamentos, // <--- Enviado para a nova aba do Front-end
            'usuario' => $user,
            'estabelecimentos_proximos' => $estabelecimentosProximos 
        ]);
    }

    // ====================================================
    // ROTA PARA A BUSCA A CADA 5 MINUTOS (AJAX/AXIOS)
    // ====================================================
    public function getNearby(Request $request)
    {
        $request->validate([
            'lat' => 'required|numeric', 
            'lng' => 'required|numeric', 
            'radius' => 'nullable|integer|min:1|max:50', 
        ]);

        $userLat = $request->input('lat');
        $userLng = $request->input('lng');
        $radius = $request->input('radius', 10); 

        $nearbyEstabelecimentos = Estabelecimento::withinDistance($userLat, $userLng, $radius)
            ->with(['servicos:id,estabelecimento_id,nome,valor']) 
            ->get();

        return response()->json($nearbyEstabelecimentos);
    }

    public function showHome()
    {
        return Inertia::render('Cliente/Home');
    }

    public function showEstabelecimento($id)
    {
        $estabelecimento = Estabelecimento::with([
            'servicos' 
        ])->findOrFail($id);

        return Inertia::render('Cliente/EstabelecimentoShow', [
            'estabelecimento' => $estabelecimento
        ]);
    }
}