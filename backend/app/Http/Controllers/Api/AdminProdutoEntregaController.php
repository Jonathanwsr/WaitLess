<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Estorno;
use App\Models\NotificacaoUsuario;
use App\Models\PedidoEntrega;
use App\Models\ProdutoEntrega;
use App\Services\ImageKitService;
use App\Services\PagamentoService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

/** Administração dos produtos para entrega: remover qualquer produto e decidir estornos fora do Asaas. */
class AdminProdutoEntregaController extends Controller
{
    private const STATUS_EM_ABERTO = ['pendente_pagamento', 'aguardando_confirmacao', 'pago'];

    public function __construct(private PagamentoService $pagamentoService)
    {
    }

    public function index()
    {
        $produtos = ProdutoEntrega::withTrashed()
            ->with(['vendedor:id,name,email', 'estabelecimento:id,nome'])
            ->withCount('pedidos')
            ->orderByDesc('created_at')
            ->limit(300)
            ->get();

        $estornosOnline = Estorno::with(['cliente:id,name,email', 'pedidoEntrega.produto:id,nome'])
            ->where('categoria', 'ENTREGA')
            ->whereNotNull('pedido_entrega_id')
            ->orderByDesc('created_at')
            ->limit(200)
            ->get();

        $disputasForaDaPlataforma = PedidoEntrega::with(['produto:id,nome', 'cliente:id,name,email', 'vendedor:id,name'])
            ->where('modo_pagamento', '!=', 'online')
            ->whereNotNull('disputa_status')
            ->orderByDesc('updated_at')
            ->limit(200)
            ->get();

        return Inertia::render('Admin/ProdutosEntrega', [
            'produtos' => $produtos,
            'estornosOnline' => $estornosOnline,
            'disputasForaDaPlataforma' => $disputasForaDaPlataforma,
        ]);
    }

    /**
     * Remove o produto. Pedidos em aberto são cancelados; quem já pagou online
     * tem o valor devolvido à conta de quem pagou (mesmo caminho do cancelamento
     * do cliente). Se alguma devolução falhar, o produto NÃO é removido.
     */
    public function destroy(Request $request, ProdutoEntrega $produto)
    {
        $validated = $request->validate(['motivo' => 'required|string|min:5|max:255']);

        $pedidosEmAberto = $produto->pedidos()->whereIn('status', self::STATUS_EM_ABERTO)->get();

        $devolvidos = 0;
        foreach ($pedidosEmAberto as $pedido) {
            try {
                // Mesma regra do cancelamento: cobrança pendente é cancelada no Asaas e quem pagou recebe de volta.
                $resultado = $this->pagamentoService->processarCancelamentoPedidoEntrega($pedido, $request->user()->id, 'CANCELAMENTO_ADMIN');
                if ($resultado['estornado']) {
                    $devolvidos++;
                }
            } catch (\Exception $e) {
                return back()->with('error', "Não foi possível devolver o pagamento do pedido {$pedido->codigo_pedido}. O produto não foi removido: {$e->getMessage()}");
            }

            NotificacaoUsuario::avisar(
                $pedido->cliente_id,
                'Pedido cancelado',
                "O produto \"{$produto->nome}\" foi removido pela Lokyva (pedido {$pedido->codigo_pedido})." .
                ($pedido->modo_pagamento === 'online' ? ' Se você pagou online, o valor foi devolvido para a forma de pagamento original.' : '') .
                " Motivo: {$validated['motivo']}"
            );
        }

        DB::transaction(function () use ($produto, $validated, $devolvidos) {
            $produto->update(['motivo_remocao' => $validated['motivo'], 'ativo' => false]);
            $produto->delete();

            NotificacaoUsuario::avisar(
                $produto->usuario_id,
                'Produto removido pela Lokyva',
                "Seu produto \"{$produto->nome}\" foi removido pela administração. Motivo: {$validated['motivo']}. " .
                "Pedidos em aberto foram cancelados" . ($devolvidos ? " e {$devolvidos} pagamento(s) online devolvido(s) a quem pagou." : '.')
            );
        });

        ImageKitService::deleteMany($produto->fotos ?? []);

        return back()->with('success', 'Produto removido e vendedor avisado.');
    }

    /** Decisão sobre disputa de pedido pago no local / direto com o vendedor (fora do Asaas). */
    public function decidirDisputa(Request $request, PedidoEntrega $pedido)
    {
        $validated = $request->validate([
            'decisao' => 'required|in:aprovar,reprovar',
            'resposta' => 'nullable|string|max:500',
        ]);

        if ($pedido->disputa_status !== 'solicitado') {
            return back()->with('error', 'Este pedido não tem uma disputa em análise.');
        }

        $aprovado = $validated['decisao'] === 'aprovar';
        $pedido->update([
            'disputa_status' => $aprovado ? 'aprovado' : 'reprovado',
            'disputa_resolvida_em' => now(),
        ]);

        $texto = $aprovado
            ? "O estorno do pedido {$pedido->codigo_pedido} foi aprovado. A devolução é combinada diretamente com o vendedor."
            : "O pedido de estorno do pedido {$pedido->codigo_pedido} não foi aprovado.";
        if (!empty($validated['resposta'])) {
            $texto .= ' ' . $validated['resposta'];
        }

        NotificacaoUsuario::avisar($pedido->cliente_id, 'Decisão sobre seu estorno', $texto);
        NotificacaoUsuario::avisar($pedido->vendedor_id, 'Decisão sobre o estorno', $texto);

        return back()->with('success', 'Decisão registrada.');
    }
}
