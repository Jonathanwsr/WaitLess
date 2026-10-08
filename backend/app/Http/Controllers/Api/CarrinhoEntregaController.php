<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CarrinhoProdutoEntrega;
use App\Models\ProdutoEntrega;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/** Carrinho dos produtos para entrega — separado do carrinho de serviços (ver CarrinhoProdutoEntrega). Responde JSON para o app. */
class CarrinhoEntregaController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'produto_entrega_id' => 'required|integer|exists:produtos_entrega,id',
            'quantidade' => 'nullable|integer|min:1|max:50',
        ]);

        $produto = ProdutoEntrega::findOrFail($validated['produto_entrega_id']);

        if (!$produto->ativo || $produto->estoque_disponivel < 1) {
            return $this->resposta($request, 'Este produto não está disponível no momento.', 422, error: true);
        }

        $item = CarrinhoProdutoEntrega::firstOrNew([
            'user_id' => Auth::id(),
            'produto_entrega_id' => $produto->id,
        ]);

        $quantidade = (int) ($validated['quantidade'] ?? max(1, (int) $produto->quantidade_minima));
        $item->quantidade = min(($item->exists ? $item->quantidade : 0) + $quantidade, $produto->estoque_disponivel);
        $item->save();

        return $this->resposta($request, 'Produto adicionado ao carrinho!', 201, ['item' => $item]);
    }

    public function update(Request $request, CarrinhoProdutoEntrega $item)
    {
        abort_unless((int) $item->user_id === (int) Auth::id(), 403);

        $validated = $request->validate(['quantidade' => 'required|integer|min:1|max:50']);

        $estoque = (int) $item->produto()->value('estoque_disponivel');
        $item->update(['quantidade' => min($validated['quantidade'], max($estoque, 1))]);

        return $this->resposta($request, 'Carrinho atualizado!', 200, ['item' => $item]);
    }

    public function destroy(Request $request, CarrinhoProdutoEntrega $item)
    {
        abort_unless((int) $item->user_id === (int) Auth::id(), 403);

        $item->delete();

        return $this->resposta($request, 'Produto removido do carrinho.');
    }

    private function resposta(Request $request, string $mensagem, int $status = 200, array $extra = [], bool $error = false)
    {
        if ($request->wantsJson()) {
            $chave = $error ? 'error' : 'message';

            return response()->json(array_merge([$chave => $mensagem], $extra), $status);
        }

        return $error ? back()->with('error', $mensagem) : back()->with('success', $mensagem);
    }
}
