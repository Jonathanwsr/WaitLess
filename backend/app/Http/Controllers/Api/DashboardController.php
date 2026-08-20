<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agendamento;
use Illuminate\Http\Request;
use App\Models\Estabelecimento;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

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
        $meusAgendamentos = Agendamento::with([
                'estabelecimento:id,nome,cidade,estado', 
                'servico:id,nome,valor,duracao_minutos'
            ])
            ->where('usuario_id', $user->id)
            ->whereIn('status', ['pendente', 'confirmado', 'aguardando_pagamento', 'cancelado'])
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

        // ----------------------------------------------------
        // LÓGICA DE GEOLOCALIZAÇÃO: Estabelecimentos Próximos
        // ----------------------------------------------------
        // Verifica se as coordenadas foram enviadas na requisição inicial
        $userLat = $request->input('lat');
        $userLng = $request->input('lng');
        $radius = $request->input('radius', 10); // Padrão 10km
        
        $estabelecimentosProximos = [];

        // Se o frontend enviou as coordenadas, faz o cálculo via Haversine (Scope do Model)
        if ($userLat && $userLng) {
            $estabelecimentosProximos = Estabelecimento::withinDistance($userLat, $userLng, $radius)
                ->with(['servicos:id,estabelecimento_id,nome,valor'])
                ->get();
        }

        return Inertia::render('Cliente/Dashboard', [
            'agendamentos' => $meusAgendamentos,
            'usuario' => $user,
            'estabelecimentos_proximos' => $estabelecimentosProximos // Envia pro Vue/React
        ]);
    }

    // ====================================================
    // ROTA PARA A BUSCA A CADA 5 MINUTOS (AJAX/AXIOS)
    // ====================================================
    public function getNearby(Request $request)
    {
        // Validação dos dados de entrada
        $request->validate([
            'lat' => 'required|numeric', // Latitude do usuário
            'lng' => 'required|numeric', // Longitude do usuário
            'radius' => 'nullable|integer|min:1|max:50', // Raio de busca em km (padrão 10)
        ]);

        $userLat = $request->input('lat');
        $userLng = $request->input('lng');
        $radius = $request->input('radius', 10); // Valor padrão de 10km

        // Executa a busca usando a scope definida no modelo Estabelecimento
        $nearbyEstabelecimentos = Estabelecimento::withinDistance($userLat, $userLng, $radius)
            ->with(['servicos:id,estabelecimento_id,nome,valor']) 
            ->get();

        // Retorna os dados em formato JSON para o frontend (para a atualização de 5 em 5 min)
        return response()->json($nearbyEstabelecimentos);
    }

    public function showHome()
    {
        return Inertia::render('Cliente/Home');
    }

    
    public function showEstabelecimento($id)
    {
        // 1. Busca o estabelecimento pelo ID ou retorna erro 404 se não achar
        $estabelecimento = Estabelecimento::with([
            'servicos' // Traz os serviços vinculados para mostrar na tela da loja
            // Você pode adicionar outros relacionamentos aqui, como 'avaliacoes', 'profissionais', etc.
        ])->findOrFail($id);

        // 2. Renderiza a tela do Inertia passando os dados
        // (Você precisará criar esse arquivo JSX: resources/js/Pages/Cliente/EstabelecimentoShow.jsx)
        return Inertia::render('Cliente/EstabelecimentoShow', [
            'estabelecimento' => $estabelecimento
        ]);
    }
}