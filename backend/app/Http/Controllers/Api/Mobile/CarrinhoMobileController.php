<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Carrinho; 
use App\Models\Servico;
use App\Models\ItemAluguel;
use App\Models\Estabelecimento;
use Illuminate\Support\Facades\Auth;

class CarrinhoMobileController extends Controller
{
    /**
     * Retorna todos os itens no carrinho do usuário.
     */
    public function index()
    {
        $user = Auth::user();
        
        // Supondo que sua model Carrinho tenha os relacionamentos 'servico' e 'itemAluguel'
        $itensCarrinho = Carrinho::with(['servico', 'itemAluguel', 'estabelecimento:id,nome,foto_perfil'])
            ->where('user_id', $user->id)
            ->get();

        $total = 0;

        // Formata os dados para o aplicativo
        $itensCarrinho->transform(function ($item) use (&$total) {
            $preco = 0;
            $nome = '';
            $foto = null;
            $tipo = '';

            if ($item->servico_id && $item->servico) {
                $preco = $item->servico->valor; // ou preco
                $nome = $item->servico->nome;
                // Se serviço não tiver foto, pega do estabelecimento
                $foto = $item->servico->foto ?? $item->estabelecimento->foto_perfil; 
                $tipo = 'servico';
            } elseif ($item->item_aluguel_id && $item->itemAluguel) {
                $preco = $item->itemAluguel->valor_diaria;
                $nome = $item->itemAluguel->nome;
                
                // Trata as fotos do ItemAluguel
                $fotos = is_string($item->itemAluguel->fotos) ? json_decode($item->itemAluguel->fotos, true) : $item->itemAluguel->fotos;
                $foto = !empty($fotos) ? $fotos[0] : $item->estabelecimento->foto_perfil;
                $tipo = 'aluguel';
            }

            $subtotal = $preco * $item->quantidade;
            $total += $subtotal;

            return [
                'id' => $item->id,
                'quantidade' => $item->quantidade,
                'estabelecimento_id' => $item->estabelecimento_id,
                'estabelecimento_nome' => $item->estabelecimento->nome ?? 'Local',
                'tipo' => $tipo,
                'nome_item' => $nome,
                'preco_unitario' => (float) $preco,
                'subtotal' => (float) $subtotal,
                'foto' => $foto
            ];
        });

        return response()->json([
            'status' => 'success',
            'data' => $itensCarrinho,
            'resumo' => [
                'quantidade_itens' => $itensCarrinho->sum('quantidade'),
                'total_carrinho' => $total
            ]
        ], 200);
    }

    /**
     * Adiciona um Serviço ou Item de Aluguel ao carrinho.
     */
    public function store(Request $request)
    {
        $request->validate([
            'estabelecimento_id' => 'required|exists:estabelecimentos,id',
            'servico_id' => 'nullable|exists:servicos,id',
            'item_aluguel_id' => 'nullable|exists:itens_aluguel,id',
            'quantidade' => 'nullable|integer|min:1'
        ]);

        if (!$request->servico_id && !$request->item_aluguel_id) {
            return response()->json(['error' => 'É necessário informar um serviço ou item para alugar.'], 400);
        }

        $user = Auth::user();

        // Verifica se o item já existe no carrinho para somar a quantidade
        $query = Carrinho::where('user_id', $user->id)
            ->where('estabelecimento_id', $request->estabelecimento_id);

        if ($request->servico_id) $query->where('servico_id', $request->servico_id);
        if ($request->item_aluguel_id) $query->where('item_aluguel_id', $request->item_aluguel_id);

        $itemExistente = $query->first();

        if ($itemExistente) {
            $itemExistente->increment('quantidade', $request->quantidade ?? 1);
            return response()->json(['message' => 'Quantidade atualizada no carrinho!']);
        }

        Carrinho::create([
            'user_id' => $user->id,
            'estabelecimento_id' => $request->estabelecimento_id,
            'servico_id' => $request->servico_id,
            'item_aluguel_id' => $request->item_aluguel_id,
            'quantidade' => $request->quantidade ?? 1,
        ]);

        return response()->json(['message' => 'Item adicionado ao carrinho com sucesso!'], 201);
    }

    /**
     * Atualiza a quantidade (+ ou -).
     */
    public function update(Request $request, $id)
    {
        $request->validate(['quantidade' => 'required|integer|min:1']);

        $user = Auth::user();
        
        $item = Carrinho::where('id', $id)->where('user_id', $user->id)->firstOrFail();
        $item->update(['quantidade' => $request->quantidade]);

        return response()->json(['message' => 'Carrinho atualizado!']);
    }

    /**
     * Remove o item do carrinho.
     */
    public function destroy($id)
    {
        $user = Auth::user();
        
        $item = Carrinho::where('id', $id)->where('user_id', $user->id)->firstOrFail();
        $item->delete();

        return response()->json(['message' => 'Item removido do carrinho.']);
    }


    /**
     * Inicia o Checkout: Transforma o carrinho em um Agendamento/Pedido pendente
     */
    public function gerarCheckout(Request $request)
    {
        $user = \Illuminate\Support\Facades\Auth::user();
        
        $itens = Carrinho::with(['servico', 'itemAluguel'])->where('user_id', $user->id)->get();

        if ($itens->isEmpty()) {
            return response()->json(['error' => 'Sua sacola está vazia.'], 400);
        }

        $total = 0;
        $estabelecimento_id = $itens->first()->estabelecimento_id; // Assume que o carrinho é da mesma loja

        foreach ($itens as $item) {
            $preco = $item->servico ? $item->servico->valor : ($item->itemAluguel ? $item->itemAluguel->valor_diaria : 0);
            $total += ($preco * $item->quantidade);
        }

        // Cria o registro na tabela de Agendamentos (ou Pedidos) com status pendente
        // Ajuste os nomes das colunas conforme a sua migration de Agendamentos
        $agendamento = \App\Models\Agendamento::create([
            'cliente_id' => $user->id,
            'estabelecimento_id' => $estabelecimento_id,
            'valor_total' => $total,
            'status' => 'pendente', // Fica pendente até o Asaas ou Pagamento Local confirmar
            'status_pagamento' => 'pendente',
            'data_servico' => now()->addDays(1), // Ideal: Receber a data escolhida pelo App via $request->data_agendamento
        ]);

        // Retorna os dados necessários para a Tela de Pagamento
        return response()->json([
            'status' => 'success',
            'agendamento_id' => $agendamento->id,
            'valor_total' => $total,
            'asaas_customer_id' => $user->asaas_customer_id
        ], 200);
    }
}