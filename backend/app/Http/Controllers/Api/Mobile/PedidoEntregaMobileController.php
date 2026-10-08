<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Api\PedidoEntregaController;
use App\Http\Controllers\Controller;
use App\Models\CarrinhoProdutoEntrega;
use App\Models\Favorito;
use App\Models\PedidoEntrega;
use App\Models\ProdutoEntrega;
use Illuminate\Http\Request;

/**
 * Entregas no app: as regras moram em PedidoEntregaController (web). Aqui só
 * adaptamos a entrada e a saída para JSON, para que web e app nunca divirjam.
 */
class PedidoEntregaMobileController extends Controller
{
    public function __construct(private PedidoEntregaController $web)
    {
    }

    public function catalogo(Request $request)
    {
        return $this->web->catalogo($request);
    }

    public function categorias()
    {
        return response()->json(['categorias' => config('produtos.categorias_entrega')]);
    }

    public function produto(Request $request, ProdutoEntrega $produtoEntrega)
    {
        abort_unless($produtoEntrega->ativo, 404, 'Este produto não está disponível.');

        $produtoEntrega->load(['estabelecimento:id,nome', 'vendedor:id,name'])
            ->loadExists('vendedorComCarteira as aceita_pagamento_online');

        return response()->json([
            'produto' => $produtoEntrega,
            'favoritado' => Favorito::where('usuario_id', $request->user()->id)->where('produto_entrega_id', $produtoEntrega->id)->exists(),
            'avaliacoes' => \App\Http\Controllers\Api\EntregasRecursosController::resumoAvaliacoes($produtoEntrega->id),
            'quantidade_no_carrinho' => (int) CarrinhoProdutoEntrega::where('user_id', $request->user()->id)->where('produto_entrega_id', $produtoEntrega->id)->value('quantidade'),
        ]);
    }

    public function store(Request $request)
    {
        return $this->web->store($request);
    }

    public function meusPedidos(Request $request)
    {
        $pedidos = PedidoEntrega::with(['produto:id,nome,fotos,categoria', 'estabelecimento:id,nome', 'vendedor:id,name,mobile_phone'])
            ->where('cliente_id', $request->user()->id)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (PedidoEntrega $p) => $this->web->dadosDoPedidoParaCliente($p));

        return response()->json(['pedidos' => $pedidos]);
    }

    public function show(Request $request, PedidoEntrega $pedidoEntrega)
    {
        abort_unless(
            (int) $pedidoEntrega->cliente_id === (int) $request->user()->id || (int) $pedidoEntrega->vendedor_id === (int) $request->user()->id,
            403,
            'Você não tem permissão para ver este pedido.'
        );

        return response()->json([
            'pedido' => $this->web->dadosDoPedidoParaCliente(
                $pedidoEntrega->load(['produto', 'estabelecimento:id,nome', 'vendedor:id,name,mobile_phone', 'pagamento'])
            ),
        ]);
    }

    public function pedidosRecebidos(Request $request)
    {
        return $this->web->pedidosRecebidos($request);
    }

    public function atribuirFuncionario(Request $request, PedidoEntrega $pedidoEntrega)
    {
        return $this->web->atribuirFuncionario($request, $pedidoEntrega);
    }

    public function liberarPagamento(Request $request, PedidoEntrega $pedidoEntrega)
    {
        return $this->web->liberarPagamento($request, $pedidoEntrega);
    }

    public function cancelar(Request $request, PedidoEntrega $pedidoEntrega)
    {
        return $this->web->cancelar($request, $pedidoEntrega);
    }

    public function cancelarPeloVendedor(Request $request, PedidoEntrega $pedidoEntrega)
    {
        return $this->web->cancelarPeloVendedor($request, $pedidoEntrega);
    }

    public function solicitarEstorno(Request $request, PedidoEntrega $pedidoEntrega)
    {
        return $this->web->solicitarEstorno($request, $pedidoEntrega);
    }

    public function comprovantePDF(Request $request, PedidoEntrega $pedidoEntrega)
    {
        return $this->web->comprovantePDF($request, $pedidoEntrega);
    }

    /** Pedidos já entregues do cliente, com a situação do estorno de cada um (aba "Produtos" em Estornos). */
    public function estornosProdutos(Request $request)
    {
        $pedidos = PedidoEntrega::with('produto:id,nome,fotos')
            ->where('cliente_id', $request->user()->id)
            ->whereIn('status', ['concluido', 'estornado'])
            ->orderByDesc('data_conclusao')
            ->get();

        $estornos = \App\Models\Estorno::whereIn('pedido_entrega_id', $pedidos->pluck('id'))
            ->get(['pedido_entrega_id', 'status'])
            ->keyBy('pedido_entrega_id');

        return response()->json([
            'pedidos' => $pedidos->map(function (PedidoEntrega $p) use ($estornos) {
                $dados = $p->toArray();
                $dados['estorno_status'] = $estornos->get($p->id)?->status;

                return $dados;
            }),
        ]);
    }
}
