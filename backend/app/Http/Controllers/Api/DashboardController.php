<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agendamento;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class DashboardController extends Controller
{
    public function index()
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
            // 👉 A MÁGICA AQUI: Agora o banco de dados puxa os novos status!
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

        return Inertia::render('Cliente/Dashboard', [
            'agendamentos' => $meusAgendamentos,
            'usuario' => $user
        ]);
    }
}