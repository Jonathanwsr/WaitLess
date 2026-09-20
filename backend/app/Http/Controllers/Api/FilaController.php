<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Estabelecimento;
use App\Models\Agendamento;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB; // 👉 Importante para buscar os itens
use Inertia\Inertia;
use Carbon\Carbon;

class FilaController extends Controller
{
    /**
     * Rota "/fila" (sem estabelecimento na URL) usada quando o usuário
     * seleciona "Todos os locais" no seletor da tela de Fila. Não existe uma
     * visão agregada entre estabelecimentos ainda, então redireciona para a
     * fila do primeiro local vinculado ao usuário (dono, sócio, gerente ou
     * funcionário) — evita o erro fatal de método inexistente que existia aqui.
     */
    public function index(Request $request)
    {
        $user = $request->user();

        if (in_array($user->papel, ['atendente', 'funcionario'])) {
            $estabelecimentoId = \App\Models\Funcionario::where('usuario_id', $user->id)->value('estabelecimento_id');
        } else {
            $estabelecimentoId = $user->estabelecimentos()->value('estabelecimentos.id');
        }

        if (!$estabelecimentoId) {
            return redirect()->route('dashboard')->withErrors(['error' => 'Nenhum estabelecimento vinculado à sua conta.']);
        }

        return redirect()->route('estabelecimentos.fila', $estabelecimentoId);
    }

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

        // 👉 INJEÇÃO: Busca os Produtos Extras para a listagem da Fila
        $agendamentos->getCollection()->transform(function ($agendamento) {
            $extras = DB::table('itens_aluguel')
                ->where('agendamento_id', $agendamento->id)
                ->get();
                
            $agendamento->produtos_extras = $extras;
            $agendamento->valor_total_extras = $extras->sum(function($item) {
                return $item->valor_diaria * $item->quantidade; // valor_diaria salva o preço do produto no carrinho
            });
            return $agendamento;
        });

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
        
        // ADICIONADOS: proprietario e funcionario
        if (!in_array($user->papel, ['admin', 'socio', 'gerente', 'proprietario', 'funcionario'])) {
            abort(403, 'Você não tem permissão para acessar o quadro de produtividade.');
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
                      ->with(['usuario', 'servico', 'pagamento', 'finalizadoPor:id,name'])
                      ->orderBy('data_agendamento', 'asc')
                      ->orderBy('hora_agendamento', 'asc');
            }])
            ->get();

        // 👉 INJEÇÃO: Busca os Produtos Extras para os agendamentos já designados aos funcionários
        foreach ($funcionarios as $funcionario) {
            $funcionario->agendamentos->transform(function ($agendamento) {
                $extras = DB::table('itens_aluguel')->where('agendamento_id', $agendamento->id)->get();
                $agendamento->produtos_extras = $extras;
                $agendamento->valor_total_extras = $extras->sum(function($item) {
                    return $item->valor_diaria * $item->quantidade;
                });
                return $agendamento;
            });
        }

        $semFuncionario = Agendamento::where('estabelecimento_id', $estabelecimento->id)
            ->whereBetween('data_agendamento', [$strInicio, $strFim])
            ->whereNull('funcionario_id')
            ->whereIn('status', ['pendente', 'confirmado'])
            ->with(['usuario', 'servico', 'pagamento'])
            ->orderBy('data_agendamento', 'asc')
            ->orderBy('hora_agendamento', 'asc')
            ->get();

        // 👉 INJEÇÃO: Busca os Produtos Extras para agendamentos na fila de espera (Sem funcionário)
        $semFuncionario->transform(function ($agendamento) {
            $extras = DB::table('itens_aluguel')->where('agendamento_id', $agendamento->id)->get();
            $agendamento->produtos_extras = $extras;
            $agendamento->valor_total_extras = $extras->sum(function($item) {
                return $item->valor_diaria * $item->quantidade;
            });
            return $agendamento;
        });

        // 3. DADOS PARA O RELATÓRIO E PDF (Paginados)
        $queryRelatorio = Agendamento::where('estabelecimento_id', $estabelecimento->id)
            ->whereBetween('data_agendamento', [$strInicio, $strFim])
            ->with(['usuario', 'servico', 'funcionario', 'pagamento', 'finalizadoPor:id,name'])
            ->orderBy('data_agendamento', 'desc')
            ->orderBy('hora_agendamento', 'desc');
            
        $perPage = $request->get('per_page', 15);
        $agendamentosPaginados = $queryRelatorio->paginate($perPage)->withQueryString();

        // 👉 INJEÇÃO: Busca os Produtos Extras para o formato de Tabela/Relatório PDF
        $agendamentosPaginados->getCollection()->transform(function ($agendamento) {
            $extras = DB::table('itens_aluguel')->where('agendamento_id', $agendamento->id)->get();
            $agendamento->produtos_extras = $extras;
            $agendamento->valor_total_extras = $extras->sum(function($item) {
                return $item->valor_diaria * $item->quantidade;
            });
            return $agendamento;
        });

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
        
        // ADICIONADO: funcionario
        if (!in_array($user->papel, ['admin', 'socio', 'gerente', 'proprietario', 'funcionario'])) {
            abort(403, 'Você não tem permissão para acessar a equipe global.');
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