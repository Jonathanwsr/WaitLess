<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Carrinho; 
use App\Models\Servico;
use App\Models\Estabelecimento;
use Inertia\Inertia;
use Illuminate\Support\Facades\Auth;

class CarrinhoController extends Controller
{
    
    public function index()
    {
        $user = Auth::user();
        
        
        $itensCarrinho = Carrinho::with(['servico', 'estabelecimento'])
            ->where('user_id', $user->id)
            ->get();

        return Inertia::render('Cliente/Carrinho', [
            'itensCarrinho' => $itensCarrinho
        ]);
    }

    /**
     * Adiciona um serviço ao carrinho.
     */
    public function store(Request $request)
    {
        $request->validate([
            'servico_id' => 'required|exists:servicos,id',
            'estabelecimento_id' => 'required|exists:estabelecimentos,id',
            'quantidade' => 'nullable|integer|min:1'
        ]);

        $user = Auth::user();

      
        $itemExistente = Carrinho::where('user_id', $user->id)
            ->where('servico_id', $request->servico_id)
            ->first();

        if ($itemExistente) {
           
            return back()->with('success', 'Este serviço já está no seu carrinho!');
        }

        
        Carrinho::create([
            'user_id' => $user->id,
            'servico_id' => $request->servico_id,
            'estabelecimento_id' => $request->estabelecimento_id,
            'quantidade' => $request->quantidade ?? 1,
        ]);

        return back()->with('success', 'Serviço adicionado ao carrinho com sucesso!');
    }

    
    public function update(Request $request, $id)
    {
        $request->validate([
            'quantidade' => 'required|integer|min:1'
        ]);

        $user = Auth::user();
        
        $item = Carrinho::where('id', $id)
            ->where('user_id', $user->id)
            ->firstOrFail();

        $item->update([
            'quantidade' => $request->quantidade
        ]);

        return back()->with('success', 'Carrinho atualizado!');
    }

   
    public function destroy($id)
    {
        $user = Auth::user();
        
        
        $item = Carrinho::where('id', $id)
            ->where('user_id', $user->id)
            ->firstOrFail();
            
        $item->delete();

        return back()->with('success', 'Serviço removido do carrinho.');
    }
}