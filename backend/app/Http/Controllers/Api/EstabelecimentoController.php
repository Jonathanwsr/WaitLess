<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Estabelecimento;
use Illuminate\Http\Request;
use App\Models\Agendamento;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class EstabelecimentoController extends Controller
{
    public function create()
    {
        return Inertia::render('Estabelecimentos/Create');
    }

    public function store(Request $request)
    {
        $user = Auth::user();

        if (!in_array($user->papel, ['admin', 'socio', 'gerente'])) {
            abort(403, 'Acesso negado. Apenas administradores, sócios ou gerentes podem criar um estabelecimento.');
        }

        $validated = $request->validate([
            'nome'         => 'required|string|max:255',
            'ramo_atuacao' => 'nullable|string|max:255',
            'telefone'     => 'nullable|string|max:20',
            'cep'          => 'nullable|string|max:10',  
            'rua'          => 'nullable|string|max:255',
            'numero'       => 'nullable|string|max:20',
            'complemento'  => 'nullable|string|max:255',
            'bairro'       => 'nullable|string|max:255',
            'cidade'       => 'nullable|string|max:255',
            'estado'       => 'nullable|string|size:2',  
            'foto_perfil'  => 'nullable|string|max:255', 
            'ativo'        => 'nullable|boolean',
        ]);

        $estabelecimento = Estabelecimento::create($validated);

        $estabelecimento->proprietarios()->attach($user->id, [
            'tipo' => $user->papel 
        ]);
        
        return redirect()->route('dashboard')->with('success', 'Estabelecimento criado com sucesso!');
    }

    // 👉 FUNÇÃO UPDATE CORRIGIDA E ÚNICA (com o token do Mercado Pago)
    public function update(Request $request, Estabelecimento $estabelecimento)
    {
        $validated = $request->validate([
            'nome'              => 'required|string|max:255',
            'ramo_atuacao'      => 'nullable|string|max:255',
            'telefone'          => 'nullable|string|max:20',
            'cep'               => 'nullable|string|max:10',  
            'rua'               => 'nullable|string|max:255',
            'numero'            => 'nullable|string|max:20',
            'complemento'       => 'nullable|string|max:255',
            'bairro'            => 'nullable|string|max:255',
            'cidade'            => 'nullable|string|max:255',
            'estado'            => 'nullable|string|size:2',
            // O token agora passa pela segurança!
            'token_mercadopago' => 'nullable|string', 
        ]);

        $estabelecimento->update($validated);
        
        return redirect()->back()->with('success', 'Configurações atualizadas com sucesso!');
    }

    public function toggleStatus(Estabelecimento $estabelecimento)
    {
        $estabelecimento->update(['ativo' => !$estabelecimento->ativo]);
        
        $mensagem = $estabelecimento->ativo ? 'Estabelecimento reativado!' : 'Estabelecimento desativado temporariamente.';
        return redirect()->back()->with('success', $mensagem);
    }

    public function fila(Request $request, Estabelecimento $estabelecimento)
    {
        $query = Agendamento::with(['usuario:id,name', 'servico:id,nome,valor', 'pagamento:id,agendamento_id,status'])
            ->where('estabelecimento_id', $estabelecimento->id)
            ->whereDate('data_agendamento', $request->input('data', now()->toDateString())); 

        if ($request->filled('status') && $request->status !== 'todos') {
            $query->where('status', $request->status);
        }

        if ($request->filled('status_pagamento') && $request->status_pagamento !== 'todos') {
            $query->whereHas('pagamento', function ($q) use ($request) {
                $q->where('status', $request->status_pagamento);
            });
        }

        $query->orderBy('hora_agendamento', $request->input('ordem', 'asc'));

        $agendamentos = $query->paginate($request->input('per_page', 10))->withQueryString();

        return Inertia::render('Estabelecimentos/Fila', [
            'estabelecimento' => $estabelecimento->only(['id', 'nome']),
            'agendamentos'    => $agendamentos,
            'filtros'         => $request->only(['ordem', 'status', 'status_pagamento', 'per_page', 'data'])
        ]);
    }

    public function configuracoes(Estabelecimento $estabelecimento)
    {
        $user = Auth::user();
        $meusEstabelecimentos = $user->estabelecimentosGerenciados()->select('estabelecimentos.id', 'nome', 'ativo', 'token_mercadopago')->get();
        $funcionarios = $estabelecimento->funcionarios()->select('id', 'nome', 'cargo', 'usuario_id', 'telefone', 'ativo')->get();
        $servicos = $estabelecimento->servicos()->latest()->get();

        return Inertia::render('Estabelecimentos/Configuracoes', [
            'estabelecimento'      => $estabelecimento,
            'meusEstabelecimentos' => $meusEstabelecimentos,
            'funcionarios'         => $funcionarios,
            'servicos'             => $servicos
        ]);
    }
}