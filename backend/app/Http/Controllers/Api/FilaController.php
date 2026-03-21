<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Estabelecimento;
use App\Models\Agendamento;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Carbon\Carbon;

class FilaController extends Controller
{
    public function show(Request $request, Estabelecimento $estabelecimento)
    {
        $funcionarios = $estabelecimento->funcionarios()->where('ativo', true)->get(['id', 'nome', 'cargo']);

        $query = Agendamento::with(['usuario', 'servico', 'pagamento'])
            ->where('estabelecimento_id', $estabelecimento->id);

        $dataInicio = $request->get('data_inicio', Carbon::today()->toDateString());
        $dataFim = $request->get('data_fim', Carbon::today()->toDateString());
        $query->whereBetween('data_agendamento', [$dataInicio, $dataFim]);

        if ($request->filled('status') && $request->status !== 'todos') {
            $query->where('status', $request->status);
        }

        if ($request->filled('status_pagamento') && $request->status_pagamento !== 'todos') {
            $query->where('status_pagamento', $request->status_pagamento);
        }

        $ordem = $request->get('ordem', 'asc');
        $query->orderBy('data_agendamento', $ordem)->orderBy('hora_agendamento', $ordem);

        $perPage = $request->get('per_page', 10);
        $agendamentos = $query->paginate($perPage)->withQueryString();

        return Inertia::render('Estabelecimentos/Fila', [
            'estabelecimento' => $estabelecimento,
            'agendamentos' => $agendamentos, 
            'funcionarios' => $funcionarios,
            'filtros' => $request->all(),
        ]);
    }

    public function agendaFuncionarios(Request $request, Estabelecimento $estabelecimento)
    {
        $user = \Illuminate\Support\Facades\Auth::user();
        if (!in_array($user->papel, ['admin', 'socio', 'gerente'])) {
            abort(403, 'Apenas a gerência tem acesso ao quadro de produtividade.');
        }

        // 1. Processamento dos Filtros de Data
        $periodo = $request->get('periodo', 'hoje'); // hoje, mes, ano, custom, todos
        $dataInicio = Carbon::today();
        $dataFim = Carbon::today();

        if ($periodo === 'mes') {
            $dataInicio = Carbon::now()->startOfMonth();
            $dataFim = Carbon::now()->endOfMonth();
        } elseif ($periodo === 'ano') {
            $dataInicio = Carbon::now()->startOfYear();
            $dataFim = Carbon::now()->endOfYear();
        } elseif ($periodo === 'custom') {
            $dataInicio = Carbon::parse($request->get('data_inicio', Carbon::today()));
            $dataFim = Carbon::parse($request->get('data_fim', Carbon::today()));
        } elseif ($periodo === 'todos') {
            $dataInicio = Carbon::parse('2000-01-01');
            $dataFim = Carbon::now()->addYears(10);
        }

        $strInicio = $dataInicio->toDateString();
        $strFim = $dataFim->toDateString();

        // 2. DADOS PARA O KANBAN (Visual)
        $funcionarios = $estabelecimento->funcionarios()
            ->where('ativo', true)
            ->with(['agendamentos' => function($query) use ($strInicio, $strFim) {
                $query->whereBetween('data_agendamento', [$strInicio, $strFim])
                      ->whereIn('status', ['pendente', 'confirmado', 'concluido', 'finalizado'])
                      ->with(['usuario', 'servico'])
                      ->orderBy('data_agendamento', 'asc')
                      ->orderBy('hora_agendamento', 'asc');
            }])
            ->get();

        $semFuncionario = Agendamento::where('estabelecimento_id', $estabelecimento->id)
            ->whereBetween('data_agendamento', [$strInicio, $strFim])
            ->whereNull('funcionario_id')
            ->whereIn('status', ['pendente', 'confirmado'])
            ->with(['usuario', 'servico'])
            ->orderBy('data_agendamento', 'asc')
            ->orderBy('hora_agendamento', 'asc')
            ->get();

        // 3. DADOS PARA O RELATÓRIO E PDF (Paginados)
        $queryRelatorio = Agendamento::where('estabelecimento_id', $estabelecimento->id)
            ->whereBetween('data_agendamento', [$strInicio, $strFim])
            ->with(['usuario', 'servico', 'funcionario'])
            ->orderBy('data_agendamento', 'desc')
            ->orderBy('hora_agendamento', 'desc');
            
        $perPage = $request->get('per_page', 15);
        $agendamentosPaginados = $queryRelatorio->paginate($perPage)->withQueryString();

        return Inertia::render('Estabelecimentos/AgendaFuncionarios', [
            'estabelecimento' => $estabelecimento,
            'funcionarios' => $funcionarios,
            'semFuncionario' => $semFuncionario,
            'agendamentosPaginados' => $agendamentosPaginados,
            'filtros' => $request->all(),
            'datasProcessadas' => ['inicio' => $strInicio, 'fim' => $strFim]
        ]);
    }

    public function equipeGlobal(Request $request)
    {
        $user = \Illuminate\Support\Facades\Auth::user();
        if (!in_array($user->papel, ['admin', 'socio', 'gerente', 'proprietario'])) {
            abort(403, 'Apenas a gerência tem acesso à equipa global.');
        }

        $estabelecimentosIds = \App\Models\Estabelecimento::where('user_id', $user->id)
            ->orWhere('usuario_id', $user->id)
            ->pluck('id');

        $funcionarios = \App\Models\Funcionario::with('estabelecimento')
            ->whereIn('estabelecimento_id', $estabelecimentosIds)
            ->orderBy('created_at', 'desc')
            ->get();

        return Inertia::render('Equipe/Global', [
            'funcionarios' => $funcionarios
        ]);
    }
}