<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Models\Carrinho;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Equivalente mobile do CarrinhoController (web): mesma modelagem de dados
 * (o carrinho só guarda serviços — a tabela `carrinhos` não tem coluna para
 * item de aluguel), porém devolvendo JSON em vez de páginas Inertia.
 */
class CarrinhoMobileController extends Controller
{
    public function index()
    {
        $user = Auth::user();

        $totalNoCarrinho = Carrinho::where('user_id', $user->id)->count();

        $itensCarrinho = Carrinho::with(['servico', 'estabelecimento:id,nome,foto_perfil'])
            ->where('user_id', $user->id)
            ->whereHas('servico')
            ->get();

        // Serviços removidos pelo estabelecimento após terem sido colocados no carrinho
        $itensRemovidos = $totalNoCarrinho - $itensCarrinho->count();

        $total = 0;

        $itens = $itensCarrinho->map(function (Carrinho $item) use (&$total) {
            $fotos = $item->servico->fotos ? (json_decode($item->servico->fotos, true) ?: []) : [];
            $subtotal = (float) $item->servico->valor * $item->quantidade;
            $total += $subtotal;

            return [
                'id' => $item->id,
                'quantidade' => $item->quantidade,
                'estabelecimento_id' => $item->estabelecimento_id,
                'estabelecimento_nome' => $item->estabelecimento->nome ?? 'Local',
                'servico_id' => $item->servico_id,
                'nome_item' => $item->servico->nome,
                'duracao_minutos' => $item->servico->duracao_minutos,
                'preco_unitario' => (float) $item->servico->valor,
                'subtotal' => $subtotal,
                'fotos' => $fotos,
            ];
        });

        return response()->json([
            'status' => 'success',
            'data' => $itens,
            'resumo' => [
                'quantidade_itens' => $itens->sum('quantidade'),
                'total_carrinho' => $total,
                'itens_removidos' => $itensRemovidos,
            ],
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'estabelecimento_id' => 'required|exists:estabelecimentos,id',
            'servico_id' => 'required|exists:servicos,id',
            'quantidade' => 'nullable|integer|min:1',
        ]);

        $user = Auth::user();

        $itemExistente = Carrinho::where('user_id', $user->id)
            ->where('servico_id', $request->servico_id)
            ->first();

        if ($itemExistente) {
            return response()->json(['message' => 'Este serviço já está no seu carrinho!']);
        }

        Carrinho::create([
            'user_id' => $user->id,
            'estabelecimento_id' => $request->estabelecimento_id,
            'servico_id' => $request->servico_id,
            'quantidade' => $request->quantidade ?? 1,
        ]);

        return response()->json(['message' => 'Serviço adicionado ao carrinho com sucesso!'], 201);
    }

    public function update(Request $request, $id)
    {
        $request->validate(['quantidade' => 'required|integer|min:1']);

        $user = Auth::user();

        $item = Carrinho::where('id', $id)->where('user_id', $user->id)->firstOrFail();
        $item->update(['quantidade' => $request->quantidade]);

        return response()->json(['message' => 'Carrinho atualizado!']);
    }

    public function destroy($id)
    {
        $user = Auth::user();

        $item = Carrinho::where('id', $id)->where('user_id', $user->id)->firstOrFail();
        $item->delete();

        return response()->json(['message' => 'Serviço removido do carrinho.']);
    }

    /**
     * Não cria o agendamento diretamente (o carrinho não sabe data/hora
     * escolhida): devolve o resumo do carrinho para a tela de agendamento,
     * exatamente como o botão "Agendar Horários" do web faz ao redirecionar
     * para a rota `cliente.agendar` com esses mesmos dados via query string.
     */
    public function gerarCheckout()
    {
        $user = Auth::user();

        $itens = Carrinho::with('servico')
            ->where('user_id', $user->id)
            ->whereHas('servico')
            ->get();

        if ($itens->isEmpty()) {
            return response()->json(['error' => 'Seu carrinho está vazio.'], 400);
        }

        $primeiroItem = $itens->first();
        $total = $itens->sum(fn (Carrinho $item) => (float) $item->servico->valor * $item->quantidade);
        $quantidadeTotal = $itens->sum('quantidade');

        return response()->json([
            'status' => 'success',
            'estabelecimento_id' => $primeiroItem->estabelecimento_id,
            'servico_id' => $primeiroItem->servico_id,
            'total_carrinho' => $total,
            'quantidade_carrinho' => $quantidadeTotal,
        ]);
    }
}
