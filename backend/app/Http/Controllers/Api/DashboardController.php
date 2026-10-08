<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agendamento;
use App\Models\Aluguel;
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
        if (in_array(mb_strtolower((string) $user->papel), ['admin', 'socio', 'sócio', 'gerente', 'proprietario', 'proprietário'])) {
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
                ],
                'fechamentoDia' => $this->fechamentoDoDia($estabelecimentos->pluck('id')),
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

        // Conta "pessoas na frente" de uma vez para todos os estabelecimentos/dias
        // envolvidos, em vez de 1 query de contagem por agendamento do cliente.
        $filasPorEstabelecimentoEDia = Agendamento::whereIn('estabelecimento_id', $meusAgendamentos->pluck('estabelecimento_id')->unique())
            ->whereIn('data_agendamento', $meusAgendamentos->pluck('data_agendamento')->unique())
            ->whereIn('status', ['pendente', 'confirmado', 'aguardando_pagamento'])
            ->get(['estabelecimento_id', 'data_agendamento', 'hora_agendamento']);

        foreach ($meusAgendamentos as $agendamento) {
            $agendamento->pessoas_na_frente = $filasPorEstabelecimentoEDia
                ->where('estabelecimento_id', $agendamento->estabelecimento_id)
                ->where('data_agendamento', $agendamento->data_agendamento)
                ->filter(fn ($a) => $a->hora_agendamento < $agendamento->hora_agendamento)
                ->count();
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

        // B2. Locações avulsas (Aluguel) do cliente — mesmo conceito de
        // agendamentos/histórico acima, mas para imóveis/veículos/etc.
        // alugados direto do dono (ver LocacaoAvulsaController).
        $meusAlugueis = Aluguel::with('item:id,nome,categoria,fotos')
            ->where('locatario_id', $user->id)
            ->orderBy('created_at', 'desc')
            ->take(20)
            ->get();

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
            'alugueis' => $meusAlugueis,
            'usuario' => $user,
            'estabelecimentos_proximos' => $estabelecimentosProximos
        ]);
    }

    // ====================================================
    // FECHAMENTO DO DIA (sócio/gerente) — faturamento, serviços mais
    // vendidos, horário de pico e caixa (presencial x online) somando
    // todos os estabelecimentos que o usuário gerencia, só com os
    // atendimentos de HOJE que de fato aconteceram/foram confirmados.
    // ====================================================
    private function fechamentoDoDia($estabelecimentoIds)
    {
        if ($estabelecimentoIds->isEmpty()) {
            return [
                'valor_total' => 0,
                'atendimentos' => 0,
                'servicos_mais_vendidos' => [],
                'horarios_pico' => [],
                'caixa' => ['presencial' => 0, 'online' => 0],
            ];
        }

        $statusRealizados = ['confirmado', 'em_atendimento', 'finalizado'];

        $agendamentosHoje = Agendamento::whereIn('estabelecimento_id', $estabelecimentoIds)
            ->whereDate('data_agendamento', now()->toDateString())
            ->whereIn('status', $statusRealizados)
            ->with('servico:id,nome')
            ->get(['id', 'estabelecimento_id', 'servico_id', 'hora_agendamento', 'valor_final', 'status_pagamento']);

        $alugueisHoje = Aluguel::whereIn('estabelecimento_id', $estabelecimentoIds)
            ->whereDate('data_inicio', now()->toDateString())
            ->whereIn('status', ['confirmado', 'em_andamento', 'finalizado'])
            ->get(['id', 'estabelecimento_id', 'valor_total', 'forma_pagamento']);

        $valorAgendamentos = (float) $agendamentosHoje->sum('valor_final');
        $valorAlugueis = (float) $alugueisHoje->sum('valor_total');

        $caixaPresencial = (float) $agendamentosHoje->whereIn('status_pagamento', ['presencial'])->sum('valor_final')
            + (float) $alugueisHoje->where('forma_pagamento', 'presencial')->sum('valor_total');
        $caixaOnline = (float) $agendamentosHoje->whereIn('status_pagamento', ['pago', 'pago_online'])->sum('valor_final')
            + (float) $alugueisHoje->where('forma_pagamento', 'online')->sum('valor_total');

        $servicosMaisVendidos = $agendamentosHoje
            ->filter(fn ($a) => $a->servico)
            ->groupBy('servico_id')
            ->map(fn ($grupo) => [
                'nome' => $grupo->first()->servico->nome,
                'quantidade' => $grupo->count(),
                'valor_total' => (float) $grupo->sum('valor_final'),
            ])
            ->sortByDesc('quantidade')
            ->take(5)
            ->values();

        $horariosPico = $agendamentosHoje
            ->groupBy(fn ($a) => substr((string) $a->hora_agendamento, 0, 2) . 'h')
            ->map(fn ($grupo, $hora) => ['hora' => $hora, 'quantidade' => $grupo->count()])
            ->sortByDesc('quantidade')
            ->take(3)
            ->values();

        return [
            'valor_total' => $valorAgendamentos + $valorAlugueis,
            'atendimentos' => $agendamentosHoje->count() + $alugueisHoje->count(),
            'servicos_mais_vendidos' => $servicosMaisVendidos,
            'horarios_pico' => $horariosPico,
            'caixa' => ['presencial' => $caixaPresencial, 'online' => $caixaOnline],
        ];
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