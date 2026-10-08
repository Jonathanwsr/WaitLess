<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AssinaturaEntrega;
use App\Models\AvaliacaoProdutoEntrega;
use App\Models\PedidoEntrega;
use App\Models\ProdutoEntrega;
use App\Services\Entregas\EntregasRecursosService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;

/** Endpoints dos recursos de produtos para entrega (recompra, avaliação, rastreio, painel, assinatura). */
class EntregasRecursosController extends Controller
{
    public function __construct(private EntregasRecursosService $recursos)
    {
    }

    public function recompras(Request $request)
    {
        return response()->json(['sugestoes' => $this->recursos->sugestoesDeRecompra($request->user())]);
    }

    /** Cliente avalia o produto e o vendedor de um pedido entregue. Uma avaliação por pedido. */
    public function avaliar(Request $request, PedidoEntrega $pedido)
    {
        abort_unless((int) $pedido->cliente_id === (int) Auth::id(), 403, 'Este pedido não é seu.');

        if ($pedido->status !== 'concluido') {
            return response()->json(['error' => 'Você só pode avaliar depois que a entrega for concluída.'], 409);
        }

        $dados = $request->validate([
            'nota_produto' => 'required|integer|between:1,5',
            'nota_vendedor' => 'required|integer|between:1,5',
            'comentario' => 'nullable|string|max:1000',
        ]);

        $avaliacao = AvaliacaoProdutoEntrega::firstOrCreate(
            ['pedido_entrega_id' => $pedido->id],
            [
                'cliente_id' => $pedido->cliente_id,
                'produto_entrega_id' => $pedido->produto_entrega_id,
                'vendedor_id' => $pedido->vendedor_id,
                'nota_produto' => $dados['nota_produto'],
                'nota_vendedor' => $dados['nota_vendedor'],
                'comentario' => $dados['comentario'] ?? null,
            ]
        );

        if (!$avaliacao->wasRecentlyCreated) {
            return response()->json(['error' => 'Este pedido já foi avaliado.'], 409);
        }

        $this->recursos->creditarBonusAvaliacao($pedido);

        return response()->json([
            'message' => 'Obrigado pela avaliação! Você ganhou ' . EntregasRecursosService::PONTOS_BONUS_AVALIACAO . ' pontos.',
            'avaliacao' => $avaliacao,
        ], 201);
    }

    /** Médias de avaliação de um produto (usadas na listagem e no detalhe). */
    public static function resumoAvaliacoes(int $produtoId): array
    {
        $linha = AvaliacaoProdutoEntrega::where('produto_entrega_id', $produtoId)
            ->selectRaw('COUNT(*) as total, AVG(nota_produto) as media_produto, AVG(nota_vendedor) as media_vendedor')
            ->first();

        return [
            'total' => (int) ($linha->total ?? 0),
            'media_produto' => $linha->total ? round((float) $linha->media_produto, 1) : null,
            'media_vendedor' => $linha->total ? round((float) $linha->media_vendedor, 1) : null,
        ];
    }

    public function painelDeVendas(Request $request)
    {
        $dias = min(365, max(1, $request->integer('dias', 30)));

        return response()->json($this->recursos->painelDeVendas($request->user(), $dias));
    }

    /** Vendedor/equipe envia a posição do entregador. */
    public function registrarPosicao(Request $request, PedidoEntrega $pedido)
    {
        $this->garantirEquipeDoPedido($pedido, $request->user());

        if (!EntregasRecursosService::vendedorMonitora($pedido)) {
            return response()->json(['error' => 'O acompanhamento de entregas é exclusivo de sócios premium.'], 403);
        }

        if (!in_array($pedido->status, ['pago', 'aguardando_confirmacao'], true)) {
            return response()->json(['error' => 'Este pedido não está em entrega.'], 409);
        }

        $dados = $request->validate([
            'lat' => 'required|numeric|between:-90,90',
            'lng' => 'required|numeric|between:-180,180',
        ]);

        $this->recursos->registrarPosicao($pedido, (float) $dados['lat'], (float) $dados['lng']);

        return response()->json(['message' => 'Posição atualizada.']);
    }

    /** Cliente (ou equipe) acompanha a última posição do entregador. */
    public function posicao(Request $request, PedidoEntrega $pedido)
    {
        $user = $request->user();
        $ehCliente = (int) $pedido->cliente_id === (int) $user->id;
        abort_unless($ehCliente || (int) $pedido->vendedor_id === (int) $user->id, 403);

        $monitora = EntregasRecursosService::vendedorMonitora($pedido);

        return response()->json([
            'disponivel' => $monitora,
            'em_rota' => $monitora && (bool) $pedido->em_rota_em && $pedido->status !== 'concluido',
            'em_rota_em' => $pedido->em_rota_em,
            'lat' => $pedido->posicao_lat,
            'lng' => $pedido->posicao_lng,
            'atualizada_em' => $pedido->posicao_atualizada_em,
        ]);
    }

    public function listarAssinaturas(Request $request)
    {
        return response()->json([
            'assinaturas' => AssinaturaEntrega::with('produto:id,nome,fotos,valor,tem_promocao,valor_promocional')
                ->where('cliente_id', $request->user()->id)
                ->orderByDesc('created_at')
                ->get(),
        ]);
    }

    public function criarAssinatura(Request $request)
    {
        $dados = $request->validate([
            'produto_entrega_id' => 'required|integer|exists:produtos_entrega,id',
            'quantidade' => 'required|integer|min:1|max:20',
            'frequencia_dias' => 'required|integer|in:7,14,30',
            'modo_recebimento' => 'required|in:retirada,entrega',
            'modo_pagamento' => 'required|in:local,direto_vendedor',
            'proxima_entrega_em' => 'required|date|after_or_equal:' . now('America/Sao_Paulo')->toDateString(),
            'endereco' => 'nullable|array',
            'endereco.cep' => 'required_if:modo_recebimento,entrega|nullable|string|max:10',
            'endereco.rua' => 'required_if:modo_recebimento,entrega|nullable|string|max:255',
            'endereco.numero' => 'required_if:modo_recebimento,entrega|nullable|string|max:20',
            'endereco.bairro' => 'required_if:modo_recebimento,entrega|nullable|string|max:100',
            'endereco.cidade' => 'required_if:modo_recebimento,entrega|nullable|string|max:100',
            'endereco.estado' => 'required_if:modo_recebimento,entrega|nullable|string|size:2',
            'endereco.complemento' => 'nullable|string|max:100',
            'endereco.observacoes' => 'nullable|string|max:500',
        ]);

        $produto = ProdutoEntrega::findOrFail($dados['produto_entrega_id']);
        abort_unless($produto->ativo, 422, 'Este produto não está disponível.');
        abort_if($dados['modo_recebimento'] === 'entrega' && !$produto->aceita_entrega, 422, 'Este produto não é entregue.');
        abort_if($dados['modo_recebimento'] === 'retirada' && !$produto->aceita_retirada, 422, 'Este produto não está disponível para retirada.');

        $assinatura = AssinaturaEntrega::create([
            'cliente_id' => $request->user()->id,
            'produto_entrega_id' => $produto->id,
            'quantidade' => $dados['quantidade'],
            'frequencia_dias' => $dados['frequencia_dias'],
            'modo_recebimento' => $dados['modo_recebimento'],
            'modo_pagamento' => $dados['modo_pagamento'],
            'proxima_entrega_em' => $dados['proxima_entrega_em'],
            'endereco' => $dados['endereco'] ?? null,
            'status' => 'ativa',
        ]);

        return response()->json(['message' => 'Assinatura criada!', 'assinatura' => $assinatura], 201);
    }

    public function alterarAssinatura(Request $request, AssinaturaEntrega $assinatura)
    {
        abort_unless((int) $assinatura->cliente_id === (int) $request->user()->id, 403);

        $acao = $request->validate(['acao' => 'required|in:pausar,retomar,cancelar'])['acao'];

        $novoStatus = match ($acao) {
            'pausar' => 'pausada',
            'retomar' => 'ativa',
            'cancelar' => 'cancelada',
        };

        if ($assinatura->status === 'cancelada') {
            return response()->json(['error' => 'Esta assinatura já foi cancelada.'], 409);
        }

        $assinatura->update(['status' => $novoStatus]);

        return response()->json(['message' => 'Assinatura atualizada.', 'assinatura' => $assinatura]);
    }

    private function garantirEquipeDoPedido(PedidoEntrega $pedido, $user): void
    {
        $ehVendedor = (int) $pedido->vendedor_id === (int) $user->id;
        $ehEntregador = (int) $pedido->entregador_usuario_id === (int) $user->id;
        $ehDoLocal = $pedido->estabelecimento_id
            && $user->estabelecimentos()->where('estabelecimentos.id', $pedido->estabelecimento_id)->exists();

        abort_unless($ehVendedor || $ehDoLocal || $ehEntregador, 403, 'Só a equipe do pedido pode enviar a posição.');
    }
}
