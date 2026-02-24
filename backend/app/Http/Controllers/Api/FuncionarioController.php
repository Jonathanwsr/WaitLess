<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Funcionario;
use Illuminate\Http\Request;
use App\Models\User;
use App\Models\Estabelecimento;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;

class FuncionarioController extends Controller

{



    public function index(Request $request)
    {
        $meusEstabelecimentos = $request->user()->estabelecimentos()->get();
        
        // Magia do Laravel: Contamos e somamos dados das tabelas relacionadas na mesma busca
        $funcionarios = Funcionario::with(['usuario', 'estabelecimento'])
            ->whereIn('estabelecimento_id', $meusEstabelecimentos->pluck('id'))
            
            // 1. Conta quantos agendamentos finalizados esse funcionário tem
            ->withCount(['agendamentos as total_atendimentos' => function ($query) {
                $query->where('status', 'finalizado');
            }])
            
           
            ->withSum(['agendamentos as faturamento_total' => function ($query) {
                $query->where('status', 'finalizado');
            }], 'valor_final')
            
            ->get();

        
        foreach ($funcionarios as $func) {
            $func->faturamento_total = $func->faturamento_total ?? 0; 
            
            $media = \DB::table('avaliacoes')
                ->join('agendamentos', 'avaliacoes.agendamento_id', '=', 'agendamentos.id')
                ->where('agendamentos.funcionario_id', $func->id)
                ->avg('avaliacoes.nota');
                
            $func->avaliacao_media = $media;
        }

        return Inertia::render('Estabelecimentos/Funcionarios', [
            'funcionarios' => $funcionarios,
            'meusEstabelecimentos' => $meusEstabelecimentos
        ]);
    }
    public function store(Request $request, Estabelecimento $estabelecimento)
    {
        $validated = $request->validate([
            'nome'     => 'required|string|max:255',
            'telefone' => 'nullable|string|max:20',
            'cargo'    => 'required|string|max:255',
            'email'    => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
        ]);

        $user = User::create([
            'name'     => $validated['nome'],
            'email'    => $validated['email'],
            'password' => Hash::make($validated['password']),
            'papel'    => $validated['cargo'], 
        ]);

        $estabelecimento->funcionarios()->create([
            'usuario_id' => $user->id,
            'nome'       => $validated['nome'],
            'telefone'   => $validated['telefone'],
            'cargo'      => $validated['cargo'],
        ]);

        return redirect()->back()->with('success', 'Funcionário e conta de acesso criados!');
    }

    public function update(Request $request, Funcionario $funcionario)
    {
        $validated = $request->validate([
            'nome'     => 'required|string|max:255',
            'telefone' => 'nullable|string|max:20',
            'cargo'    => 'required|string|max:255',
            'email'    => 'nullable|email|unique:users,email,' . $funcionario->usuario_id,
            'password' => 'nullable|string|min:8',
        ]);

        $funcionario->update([
            'nome'     => $validated['nome'],
            'telefone' => $validated['telefone'],
            'cargo'    => $validated['cargo'],
        ]);

        if ($funcionario->usuario_id) {
            $user = User::find($funcionario->usuario_id);
            if ($user) {
                $user->name = $validated['nome'];
                $user->papel = $validated['cargo'];
                
                if (!empty($validated['email'])) {
                    $user->email = $validated['email'];
                }
                if (!empty($validated['password'])) {
                    $user->password = Hash::make($validated['password']);
                }
                $user->save();
            }
        }

        return redirect()->back()->with('success', 'Funcionário atualizado!');
    }

    public function destroy(Funcionario $funcionario)
    {
        $funcionario->update(['ativo' => false]);
        
        return redirect()->back()->with('success', 'Funcionário removido da equipe.');
    }
}