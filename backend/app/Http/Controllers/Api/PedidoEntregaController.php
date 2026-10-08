<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CarrinhoProdutoEntrega;
use App\Models\Favorito;
use App\Models\Funcionario;
use App\Models\NotificacaoUsuario;
use App\Models\Pagamento;
use App\Models\PedidoEntrega;
use App\Models\Provider;
use App\Models\ProdutoEntrega;
use App\Support\BuscaProdutos;
use App\Services\EstornoService;
use App\Services\PagamentoService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;

/**
 * Área do cliente para "Produtos para entrega": catálogo, pedido com uma de três
 * formas de pagamento (online pelo Asaas com custódia, no local ou direto com o
 * vendedor), código de confirmação de 6 dígitos que o cliente dá ao vendedor na
 * entrega/busca (só ele libera o pagamento), cancelamento e estorno.
 */
class PedidoEntregaController extends Controller
{
    public function __construct(private PagamentoService $pagamentoService, private EstornoService $estornoService)
    {
    }

    public function index()
    {
        return Inertia::render('Entregas/Catalogo', [
            'categorias' => config('produtos.categorias_entrega'),
        ]);
    }

    public function catalogo(Request $request)
    {
        $validated = $request->validate([
            'busca' => 'nullable|string|max:100',
            'estado' => 'nullable|string|size:2',
            'cidade' => 'nullable|string|max:100',
            'categoria' => 'nullable|string|max:60',
            'estabelecimento_id' => 'nullable|integer|exists:estabelecimentos,id',
            'apenas_promocoes' => 'nullable|boolean',
            'apenas_premium' => 'nullable|boolean',
            'preco_min' => 'nullable|numeric|min:0',
            'preco_max' => 'nullable|numeric|min:0',
            'ordenar' => 'nullable|in:relevancia,menor_preco,maior_preco,mais_vendidos,recentes',
        ]);

        $query = ProdutoEntrega::with(['estabelecimento:id,nome', 'vendedor:id,name,plano_assinatura,plano_expira_em'])
            ->withExists('vendedorComCarteira as aceita_pagamento_online')
            ->withCount(['pedidos as total_vendidos' => fn ($q) => $q->where('status', 'concluido')])
            ->where('ativo', true)
            ->where('estoque_disponivel', '>', 0);

        $termos = BuscaProdutos::termos($validated['busca'] ?? null);
        BuscaProdutos::aplicar($query, $termos);

        if (!empty($validated['estado'])) {
            $query->where('endereco_estado', strtoupper($validated['estado']));
        }
        if (!empty($validated['cidade'])) {
            $query->whereRaw(BuscaProdutos::semAcento('endereco_cidade') . ' LIKE ?', ['%' . BuscaProdutos::normalizar($validated['cidade']) . '%']);
        }
        if (!empty($validated['categoria'])) {
            $query->where('categoria', $validated['categoria']);
        }
        if (!empty($validated['estabelecimento_id'])) {
            $query->where('estabelecimento_id', $validated['estabelecimento_id']);
        }
        if ($request->boolean('apenas_promocoes')) {
            $query->where('tem_promocao', true)->whereNotNull('valor_promocional');
        }
        if ($request->boolean('apenas_premium')) {
            // Mesma regra de User::isPremium(): plano premium* ainda dentro da validade.
            $query->whereHas('vendedor', fn ($v) => $v->where('plano_assinatura', 'like', 'premium%')->where('plano_expira_em', '>', now()));
        }

        $precoFinal = 'CASE WHEN tem_promocao AND valor_promocional IS NOT NULL THEN valor_promocional ELSE valor END';
        if (isset($validated['preco_min'])) {
            $query->whereRaw("{$precoFinal} >= ?", [$validated['preco_min']]);
        }
        if (isset($validated['preco_max'])) {
            $query->whereRaw("{$precoFinal} <= ?", [$validated['preco_max']]);
        }

        $ordem = $validated['ordenar'] ?? ($termos ? 'relevancia' : 'recentes');
        // Sem ordenação escolhida pelo cliente: vendedores premium primeiro, depois quem aceita pontos.
        if (in_array($ordem, ['relevancia', 'recentes'], true)) {
            app(\App\Services\DestaquePremiumService::class)->ordenarPorDestaque($query, 'produtos_entrega.usuario_id', 'usuario');
        }
        match ($ordem) {
            'relevancia' => BuscaProdutos::ordenarPorRelevancia($query, $termos),
            'menor_preco' => $query->orderByRaw("{$precoFinal} ASC"),
            'maior_preco' => $query->orderByRaw("{$precoFinal} DESC"),
            'mais_vendidos' => $query->orderByDesc('total_vendidos'),
            default => null,
        };
        $query->orderByDesc('produtos_entrega.created_at')->orderByDesc('produtos_entrega.id');

        $produtos = $query->paginate(12)->withQueryString();

        $favoritos = Favorito::where('usuario_id', $request->user()?->id)
            ->whereIn('produto_entrega_id', collect($produtos->items())->pluck('id'))
            ->pluck('produto_entrega_id')
            ->flip();
        $produtos->getCollection()->transform(function (ProdutoEntrega $p) use ($favoritos) {
            $p->setAttribute('favoritado', $favoritos->has($p->id));
            $p->setAttribute('vendedor_premium', (bool) $p->vendedor?->isPremium());
            // O plano do vendedor só serve para o selo; não vai para o cliente.
            $p->vendedor?->makeHidden(['plano_assinatura', 'plano_expira_em']);

            return $p;
        });

        return response()->json($produtos);
    }

    /** Página de detalhe e compra de um produto para entrega. */
    public function produto(ProdutoEntrega $produtoEntrega)
    {
        if (!$produtoEntrega->ativo) {
            abort(404, 'Este produto não está disponível.');
        }

        $produtoEntrega->load(['estabelecimento:id,nome', 'vendedor:id,name'])
            ->loadExists('vendedorComCarteira as aceita_pagamento_online');

        $usuarioId = request()->user()->id;

        return Inertia::render('Entregas/ProdutoDetalhe', [
            'produto' => $produtoEntrega,
            'favoritado' => Favorito::where('usuario_id', $usuarioId)->where('produto_entrega_id', $produtoEntrega->id)->exists(),
            'avaliacoes' => \App\Http\Controllers\Api\EntregasRecursosController::resumoAvaliacoes($produtoEntrega->id),
            'quantidadeNoCarrinho' => (int) CarrinhoProdutoEntrega::where('user_id', $usuarioId)->where('produto_entrega_id', $produtoEntrega->id)->value('quantidade'),
        ]);
    }

    /**
     * Cria o pedido. Online: já tenta a cobrança Asaas na mesma chamada (pagamento
     * fica em custódia até o código de 6 dígitos). No local / direto com o vendedor:
     * não passa pelo Asaas, só registra o pedido aguardando a confirmação na entrega.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'produto_entrega_id' => 'required|integer|exists:produtos_entrega,id',
            'quantidade' => 'required|integer|min:1|max:50',
            'modo_recebimento' => 'required|in:retirada,entrega',
            'modo_pagamento' => 'nullable|in:online,local,direto_vendedor',

            'entrega_cep' => 'required_if:modo_recebimento,entrega|nullable|string|max:10',
            'entrega_rua' => 'required_if:modo_recebimento,entrega|nullable|string|max:255',
            'entrega_numero' => 'required_if:modo_recebimento,entrega|nullable|string|max:20',
            'entrega_complemento' => 'nullable|string|max:100',
            'entrega_bairro' => 'required_if:modo_recebimento,entrega|nullable|string|max:100',
            'entrega_cidade' => 'required_if:modo_recebimento,entrega|nullable|string|max:100',
            'entrega_estado' => 'required_if:modo_recebimento,entrega|nullable|string|size:2',
            'entrega_observacoes' => 'nullable|string|max:500',

            'metodo_pagamento' => 'required_unless:modo_pagamento,local,direto_vendedor|nullable|in:pix,boleto,cartao',
            'asaas_customer_id' => 'nullable|string',
            'parcelas' => 'nullable|integer|min:1|max:12',
            'cartao' => 'nullable|array',
            'cartao.numero' => 'nullable|string',
            'cartao.titular' => 'nullable|string',
            'cartao.mes' => 'nullable|string',
            'cartao.ano' => 'nullable|string',
            'cartao.cvv' => 'nullable|string',
            'cartao_salvo_token' => 'nullable|string',
        ]);

        $validated['modo_pagamento'] ??= 'online';

        $cliente = $request->user();

        // Anti-robô: no máximo 1 compra por minuto por conta.
        $chaveLimite = 'compra-produto:' . $cliente->id;
        if (RateLimiter::tooManyAttempts($chaveLimite, 1)) {
            $segundos = RateLimiter::availableIn($chaveLimite);

            return response()->json([
                'error' => "Você acabou de fazer uma compra. Aguarde {$segundos} segundos para comprar de novo.",
                'tentar_em' => $segundos,
            ], 429);
        }

        // Dois cliques ao mesmo tempo não viram duas compras: só uma requisição por conta passa daqui.
        $trava = Cache::lock('compra-produto-trava:' . $cliente->id, 30);
        if (!$trava->get()) {
            return response()->json(['error' => 'Já estamos processando sua compra. Aguarde um instante.'], 429);
        }

        try {
            $resposta = $this->processarCompra($request, $validated, $cliente);
        } finally {
            $trava->release();
        }

        if ($resposta->getStatusCode() === 201) {
            RateLimiter::hit($chaveLimite, 60);
        }

        return $resposta;
    }

    /** Cria o pedido (estoque travado por linha) e, se for online, gera a cobrança. */
    private function processarCompra(Request $request, array $validated, $cliente)
    {
        $online = $validated['modo_pagamento'] === 'online';

        $produtoDaCompra = ProdutoEntrega::find($validated['produto_entrega_id']);
        if ($online && !$produtoDaCompra?->vendedorComCarteira()->exists()) {
            return response()->json([
                'error' => 'Este vendedor ainda não recebe pagamentos online. Escolha pagar no local ou direto com o vendedor.',
            ], 422);
        }

        $pedido = null;

        try {
            $pedido = DB::transaction(function () use ($validated, $cliente, $online) {
                // Trava a linha do produto pra nunca vender mais do que o estoque permite.
                $produto = ProdutoEntrega::whereKey($validated['produto_entrega_id'])->lockForUpdate()->first();

                if (!$produto || !$produto->ativo) {
                    abort(404, 'Este produto não está disponível.');
                }
                if ($validated['modo_recebimento'] === 'entrega' && !$produto->aceita_entrega) {
                    abort(422, 'Este produto não é entregue. Escolha buscar no local.');
                }
                if ($validated['modo_recebimento'] === 'retirada' && !$produto->aceita_retirada) {
                    abort(422, 'Este produto não está disponível para retirada. Escolha entrega.');
                }
                if ($validated['quantidade'] < (int) $produto->quantidade_minima) {
                    abort(422, "A quantidade mínima deste produto é {$produto->quantidade_minima}.");
                }
                if ($produto->estoque_disponivel < $validated['quantidade']) {
                    abort(422, 'Estoque insuficiente para a quantidade solicitada.');
                }

                // Preço promocional quando ativo; taxa de entrega só quando o cliente quer
                // receber em casa — retirada no local não paga frete.
                $valorUnitario = (float) $produto->valor_final;
                $valorProdutos = round($valorUnitario * $validated['quantidade'], 2);
                $taxaEntrega = $validated['modo_recebimento'] === 'entrega' ? (float) $produto->taxa_entrega : 0.0;
                $valorTotal = round($valorProdutos + $taxaEntrega, 2);

                $pedido = PedidoEntrega::create([
                    'codigo_pedido' => 'ENT-' . strtoupper(uniqid()),
                    'codigo_confirmacao' => str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT),
                    'cliente_id' => $cliente->id,
                    'produto_entrega_id' => $produto->id,
                    'vendedor_id' => $produto->usuario_id,
                    'estabelecimento_id' => $produto->estabelecimento_id,
                    'quantidade' => $validated['quantidade'],
                    'valor_unitario' => $valorUnitario,
                    'valor_total' => $valorTotal,
                    'taxa_plataforma' => $online ? \App\Support\Taxas::sobreEntregas($valorProdutos) : 0,
                    'taxa_entrega' => $taxaEntrega,
                    'modo_recebimento' => $validated['modo_recebimento'],
                    'modo_pagamento' => $validated['modo_pagamento'],

                    'origem_rua' => $produto->endereco_rua,
                    'origem_numero' => $produto->endereco_numero,
                    'origem_complemento' => $produto->endereco_complemento,
                    'origem_bairro' => $produto->endereco_bairro,
                    'origem_cidade' => $produto->endereco_cidade,
                    'origem_estado' => $produto->endereco_estado,
                    'origem_cep' => $produto->endereco_cep,

                    'entrega_cep' => $validated['entrega_cep'] ?? null,
                    'entrega_rua' => $validated['entrega_rua'] ?? null,
                    'entrega_numero' => $validated['entrega_numero'] ?? null,
                    'entrega_complemento' => $validated['entrega_complemento'] ?? null,
                    'entrega_bairro' => $validated['entrega_bairro'] ?? null,
                    'entrega_cidade' => $validated['entrega_cidade'] ?? null,
                    'entrega_estado' => $validated['entrega_estado'] ?? null,
                    'entrega_observacoes' => $validated['entrega_observacoes'] ?? null,

                    'status' => $online ? 'pendente_pagamento' : 'aguardando_confirmacao',
                ]);

                $produto->decrement('estoque_disponivel', $validated['quantidade']);

                return $pedido;
            });

            if (!$online) {
                return response()->json([
                    'status' => 'success',
                    'message' => 'Pedido registrado! Na entrega, informe o código de confirmação ao vendedor.',
                    'pedido' => $pedido->fresh(),
                    'pagamento' => null,
                ], 201);
            }

            $asaasCustomerId = $validated['asaas_customer_id'] ?? $this->pagamentoService->garantirClienteAsaas($cliente);

            $resultado = $this->pagamentoService->criarCobrancaEntrega(
                $pedido,
                $validated['metodo_pagamento'],
                $asaasCustomerId,
                $validated['parcelas'] ?? 1,
                $validated['cartao'] ?? null,
                $validated['metodo_pagamento'] === 'cartao' ? $cliente : null,
                $request->ip(),
                $validated['cartao_salvo_token'] ?? null
            );

            return response()->json([
                'status' => 'success',
                'message' => 'Pedido criado! Finalize o pagamento para confirmar.',
                'pedido' => $pedido->fresh(),
                'pagamento' => $resultado,
            ], 201);
        } catch (\Throwable $e) {
            $referencia = strtoupper(Str::random(8));
            Log::error("Erro ao criar pedido de entrega [{$referencia}]: " . $e->getMessage(), ['cliente' => $cliente->id, 'produto' => $validated['produto_entrega_id']]);

            // Pedido que não chegou a ser cobrado não pode ficar segurando estoque.
            if ($pedido && in_array($pedido->status, ['pendente_pagamento', 'aguardando_confirmacao'], true)) {
                DB::transaction(function () use ($pedido) {
                    $pedido->update(['status' => 'cancelado', 'data_cancelamento' => now()]);
                    ProdutoEntrega::whereKey($pedido->produto_entrega_id)->increment('estoque_disponivel', $pedido->quantidade);
                });
            }

            return $this->erroDeCompra($e, $referencia);
        }
    }

    /**
     * O cliente nunca vê detalhes internos (gateway, banco, código). Só passam mensagens pensadas
     * para ele: regras de compra (estoque, quantidade) e cartão recusado. O resto vira uma mensagem
     * genérica com um código para o suporte achar o erro no log.
     */
    private function erroDeCompra(\Throwable $e, string $referencia)
    {
        if ($e instanceof \Symfony\Component\HttpKernel\Exception\HttpExceptionInterface && $e->getStatusCode() < 500) {
            return response()->json(['error' => $e->getMessage() ?: 'Não foi possível concluir a compra.'], $e->getStatusCode() === 404 ? 404 : 422);
        }
        if ($e instanceof \App\Exceptions\CobrancaRecusadaException) {
            return response()->json(['error' => 'Pagamento recusado. Confira os dados do cartão ou escolha outra forma de pagamento.'], 422);
        }
        if ($e instanceof \App\Exceptions\CarteiraAsaasNaoConfiguradaException) {
            return response()->json(['error' => 'Este vendedor não está recebendo pagamentos online agora. Escolha pagar no local ou direto com o vendedor.'], 422);
        }

        return response()->json([
            'error' => "Não foi possível concluir sua compra agora. Tente novamente em alguns minutos. Se o problema continuar, informe o código {$referencia} ao suporte.",
            'referencia' => $referencia,
        ], 422);
    }

    public function meusPedidos(Request $request)
    {
        $pedidos = PedidoEntrega::with(['produto:id,nome,fotos,categoria', 'estabelecimento:id,nome', 'vendedor:id,name,mobile_phone'])
            ->where('cliente_id', $request->user()->id)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (PedidoEntrega $p) => $this->dadosDoPedidoParaCliente($p));

        return Inertia::render('Entregas/MeusPedidos', ['pedidos' => $pedidos]);
    }

    public function show(Request $request, PedidoEntrega $pedidoEntrega)
    {
        $this->garantirPertenceAoPedido($pedidoEntrega, $request->user());

        return Inertia::render('Entregas/Confirmacao', [
            'pedido' => $this->dadosDoPedidoParaCliente(
                $pedidoEntrega->load(['produto', 'estabelecimento:id,nome', 'vendedor:id,name,mobile_phone', 'pagamento'])
            ),
        ]);
    }

    /** Pedidos recebidos pelo sócio como vendedor dos seus produtos de entrega. */
    public function pedidosRecebidos(Request $request)
    {
        $pedidos = PedidoEntrega::with(['produto:id,nome,fotos', 'cliente:id,name,mobile_phone', 'estabelecimento:id,nome', 'funcionario:id,nome'])
            ->where('vendedor_id', $request->user()->id)
            ->orderByDesc('created_at')
            ->get();

        return response()->json(['pedidos' => $pedidos]);
    }

    /**
     * Vendedor (ou equipe do local) digita o código de 6 dígitos que o cliente
     * mostrou na entrega/busca. Só então o pagamento online sai da custódia
     * (releaseEscrow no Asaas) ou o pedido de pagamento direto/no local é concluído.
     */
    /** Tentativas erradas do código de 6 dígitos permitidas por pedido antes do bloqueio temporário. */
    private const TENTATIVAS_CODIGO = 5;
    private const BLOQUEIO_CODIGO_SEGUNDOS = 900;

    /**
     * Finaliza a entrega. Blindagens:
     * - só a equipe do pedido finaliza; o código de 6 dígitos é exigido no online;
     * - o código tem limite de tentativas POR PEDIDO (vale para qualquer conta), contra chute;
     * - uma trava por pedido impede duas finalizações ao mesmo tempo (custódia liberada uma vez);
     * - a conclusão é um UPDATE condicional: só um vence, então vendas e pontos nunca contam em dobro;
     * - erros internos viram mensagem genérica com código para o suporte.
     */
    public function liberarPagamento(Request $request, PedidoEntrega $pedidoEntrega)
    {
        $online = $pedidoEntrega->modo_pagamento === 'online';
        $validated = $request->validate(['codigo' => ($online ? 'required' : 'nullable') . '|digits:6']);

        $this->garantirPodeConfirmarEntrega($pedidoEntrega, $request->user());

        if (!in_array($pedidoEntrega->status, ['pago', 'aguardando_confirmacao'], true)) {
            return response()->json(['error' => 'Este pedido não está aguardando confirmação de entrega.'], 409);
        }

        if ($online) {
            $chaveCodigo = 'codigo-entrega:' . $pedidoEntrega->id;
            if (RateLimiter::tooManyAttempts($chaveCodigo, self::TENTATIVAS_CODIGO)) {
                $minutos = (int) ceil(RateLimiter::availableIn($chaveCodigo) / 60);

                return response()->json(['error' => "Muitas tentativas com código errado. Por segurança, este pedido fica bloqueado por {$minutos} minuto(s)."], 429);
            }

            if (!hash_equals((string) $pedidoEntrega->codigo_confirmacao, (string) ($validated['codigo'] ?? ''))) {
                RateLimiter::hit($chaveCodigo, self::BLOQUEIO_CODIGO_SEGUNDOS);
                $restantes = max(0, self::TENTATIVAS_CODIGO - RateLimiter::attempts($chaveCodigo));

                return response()->json([
                    'error' => 'Código incorreto. Peça ao cliente o código de 6 dígitos mostrado no pedido dele.'
                        . ($restantes > 0 ? " Restam {$restantes} tentativa(s)." : ' Pedido bloqueado por 15 minutos.'),
                ], 422);
            }
        }

        $trava = Cache::lock('finalizar-pedido-entrega:' . $pedidoEntrega->id, 60);
        if (!$trava->get()) {
            return response()->json(['error' => 'Esta entrega já está sendo finalizada. Aguarde um instante.'], 409);
        }

        try {
            return $this->concluirEntrega($pedidoEntrega->fresh(), $online ? 'codigo-entrega:' . $pedidoEntrega->id : null);
        } catch (\Throwable $e) {
            $referencia = strtoupper(Str::random(8));
            Log::error("Erro ao finalizar pedido de entrega #{$pedidoEntrega->id} [{$referencia}]: " . $e->getMessage());

            return response()->json(['error' => "Não foi possível finalizar a entrega agora. Tente novamente em alguns minutos. Se continuar, informe o código {$referencia} ao suporte."], 500);
        } finally {
            $trava->release();
        }
    }

    private function concluirEntrega(PedidoEntrega $pedido, ?string $chaveCodigo)
    {
        // Relido dentro da trava: outra requisição pode ter concluído enquanto esta esperava.
        if (!in_array($pedido->status, ['pago', 'aguardando_confirmacao'], true)) {
            return response()->json(['error' => 'Este pedido não está aguardando confirmação de entrega.'], 409);
        }

        $pagamento = null;
        if ($pedido->status === 'pago') {
            $pagamento = Pagamento::find($pedido->pagamento_id);
            if ($pagamento?->status !== 'pago' || !$pagamento->id_transacao_gateway) {
                return response()->json(['error' => 'O pagamento deste pedido ainda não foi confirmado. Tente novamente mais tarde.'], 409);
            }
            if (!in_array($pagamento->status_repasse, ['liberado', 'repassado'], true)) {
                if (!$this->pagamentoService->liberarCustodiaAsaas($pagamento->id_transacao_gateway)) {
                    return response()->json(['error' => 'Não foi possível liberar o pagamento agora. Tente novamente em alguns minutos.'], 502);
                }
                // Marca já, para uma nova tentativa não liberar a custódia de novo.
                $pagamento->update(['status_repasse' => 'liberado', 'data_liberacao_repasse' => now()->toDateString()]);
            }
        }

        $concluiu = DB::transaction(function () use ($pedido) {
            $linhas = PedidoEntrega::whereKey($pedido->id)
                ->whereIn('status', ['pago', 'aguardando_confirmacao'])
                ->update(['status' => 'concluido', 'data_conclusao' => now(), 'liberado_em' => now()]);

            if ($linhas === 1) {
                \App\Models\User::whereKey($pedido->vendedor_id)->increment('produtos_vendidos', $pedido->quantidade);
            }

            return $linhas === 1;
        });

        if (!$concluiu) {
            return response()->json(['error' => 'Este pedido já foi finalizado.'], 409);
        }

        if ($chaveCodigo) {
            RateLimiter::clear($chaveCodigo);
        }

        $pedido = $pedido->fresh();
        app(\App\Services\Entregas\EntregasRecursosService::class)->concederPontos($pedido);

        NotificacaoUsuario::avisar(
            $pedido->cliente_id,
            'Pedido entregue',
            "Seu pedido {$pedido->codigo_pedido} foi confirmado pelo vendedor. Obrigado!"
        );

        return response()->json(['message' => 'Entrega confirmada e pagamento liberado!', 'pedido' => $pedido]);
    }

    /**
     * Cancelamento ANTES da conclusão. Sem dinheiro envolvido (pendente ou
     * pagamento direto/no local) só libera o estoque. Online já pago e ainda em
     * custódia é devolvido ao pagador original.
     */
    /**
     * Comprador cancela só o que ainda não foi pago online: pedido pendente ou pagamento no local.
     * Pedido já pago online é cancelado pelo vendedor, que devolve o valor integral.
     */
    public function cancelar(Request $request, PedidoEntrega $pedidoEntrega)
    {
        if ((int) $pedidoEntrega->cliente_id !== (int) $request->user()->id) {
            abort(403, 'Este pedido não pertence a você.');
        }

        if ($pedidoEntrega->status === 'pago') {
            return response()->json(['error' => 'Este pedido já foi pago online. Peça ao vendedor para cancelar: ele devolve o valor na forma de pagamento original.'], 409);
        }

        if (!in_array($pedidoEntrega->status, ['pendente_pagamento', 'aguardando_confirmacao'], true)) {
            return response()->json(['error' => 'Este pedido não pode mais ser cancelado. Se já foi concluído, abra uma solicitação de estorno.'], 409);
        }

        return $this->executarCancelamento($pedidoEntrega, $request->user()->id, 'CANCELAMENTO_CLIENTE');
    }

    /** Sócio, gerente ou vendedor cancela um pedido em aberto. Se já foi pago online, devolve o valor. */
    public function cancelarPeloVendedor(Request $request, PedidoEntrega $pedidoEntrega)
    {
        $this->garantirPodeCancelarPeloVendedor($pedidoEntrega, $request->user());

        if (!in_array($pedidoEntrega->status, ['pendente_pagamento', 'aguardando_confirmacao', 'pago'], true)) {
            return response()->json(['error' => 'Este pedido não pode mais ser cancelado. Se já foi concluído, use a solicitação de estorno.'], 409);
        }

        return $this->executarCancelamento($pedidoEntrega, $request->user()->id, 'CANCELAMENTO_VENDEDOR');
    }

    private function executarCancelamento(PedidoEntrega $pedido, int $userId, string $motivo)
    {
        try {
            $resultado = $this->pagamentoService->processarCancelamentoPedidoEntrega($pedido, $userId, $motivo);

            return response()->json(['message' => $resultado['message']]);
        } catch (\Exception $e) {
            $referencia = strtoupper(Str::random(8));
            Log::error("Erro ao cancelar pedido de entrega #{$pedido->id} [{$referencia}]: " . $e->getMessage());

            return response()->json([
                'error' => "Não foi possível cancelar o pedido agora. Tente novamente em alguns minutos. Se continuar, informe o código {$referencia} ao suporte.",
            ], 500);
        }
    }

    private function garantirPodeCancelarPeloVendedor(PedidoEntrega $pedido, $user): void
    {
        $ehVendedor = (int) $pedido->vendedor_id === (int) $user->id;
        $ehGestorDoLocal = $pedido->estabelecimento_id && DB::table('estabelecimento_usuario')
            ->where('usuario_id', $user->id)
            ->where('estabelecimento_id', $pedido->estabelecimento_id)
            ->whereIn('tipo', ['admin', 'socio', 'proprietario', 'gerente'])
            ->exists();

        abort_unless($ehVendedor || $ehGestorDoLocal, 403, 'Só o vendedor ou a gestão do local pode cancelar este pedido.');
    }

    /**
     * Pedido concluído: online abre estorno pelo EstornoService (aprovação do admin,
     * categoria ENTREGA). Pagamento no local / direto com o vendedor fica como
     * disputa no próprio pedido — o dinheiro não passou pela plataforma, então o
     * admin só registra a decisão.
     */
    public function solicitarEstorno(Request $request, PedidoEntrega $pedidoEntrega)
    {
        if ((int) $pedidoEntrega->cliente_id !== (int) $request->user()->id) {
            abort(403, 'Este pedido não pertence a você.');
        }

        $request->validate([
            'motivo' => 'required|string|max:255',
            'descricao' => 'required|string|min:10|max:2000',
            'imagens' => 'nullable|array|max:5',
            'imagens.*' => 'image|mimes:jpeg,png,jpg|max:3072',
        ]);

        if ($pedidoEntrega->modo_pagamento !== 'online' || !$pedidoEntrega->pagamento_id) {
            if ($pedidoEntrega->status !== 'concluido') {
                return response()->json(['error' => 'Você só pode pedir estorno depois que o pedido for entregue.'], 409);
            }
            if ($pedidoEntrega->disputa_status === 'solicitado') {
                return response()->json(['error' => 'Já existe uma solicitação de estorno em análise para este pedido.'], 409);
            }

            $pedidoEntrega->update([
                'disputa_status' => 'solicitado',
                'disputa_motivo' => $request->motivo,
                'disputa_descricao' => $request->descricao,
                'disputa_resolvida_em' => null,
            ]);

            return response()->json(['message' => 'Solicitação de estorno enviada para análise.'], 201);
        }

        $pagamento = Pagamento::find($pedidoEntrega->pagamento_id);

        try {
            $estorno = $this->estornoService->solicitarEstorno(
                $request->user(),
                $pagamento,
                array_merge($request->all(), ['categoria' => 'ENTREGA']),
                $request->file('imagens') ?? []
            );
            $estorno->update(['pedido_entrega_id' => $pedidoEntrega->id]);

            return response()->json(['message' => 'Solicitação de estorno enviada com sucesso.', 'estorno' => $estorno], 201);
        } catch (\Exception $e) {
            // Regras do estorno (prazo, duplicidade, imagens) vêm como Exception simples e são para o cliente;
            // erros de banco/rede não são mostrados.
            if ($e::class === \Exception::class) {
                return response()->json(['error' => $e->getMessage()], 422);
            }
            $referencia = strtoupper(Str::random(8));
            Log::error("Erro ao solicitar estorno do pedido #{$pedidoEntrega->id} [{$referencia}]: " . $e->getMessage());

            return response()->json(['error' => "Não foi possível enviar a solicitação agora. Se continuar, informe o código {$referencia} ao suporte."], 500);
        }
    }

    /** Sócio/gerente escolhe qual funcionário vai atender o pedido (mesmas regras do agendamento). */
    public function atribuirFuncionario(Request $request, PedidoEntrega $pedidoEntrega)
    {
        $validated = $request->validate([
            'funcionario_id' => 'nullable|exists:funcionarios,id',
            'eu_mesmo' => 'nullable|boolean',
        ]);

        $user = Auth::user();

        $gerencia = (int) $user->id === (int) $pedidoEntrega->vendedor_id
            || ($pedidoEntrega->estabelecimento_id && $user->estabelecimentos()->where('estabelecimentos.id', $pedidoEntrega->estabelecimento_id)->exists());

        $meuFuncionarioId = (!$gerencia && $pedidoEntrega->estabelecimento_id)
            ? Funcionario::where('usuario_id', $user->id)->where('estabelecimento_id', $pedidoEntrega->estabelecimento_id)->value('id')
            : null;

        $autoAtribuicao = false;
        if (!$gerencia && $meuFuncionarioId) {
            $novoId = $validated['funcionario_id'] ?? null;
            $estavaLivreOuEraMeu = is_null($pedidoEntrega->funcionario_id) || (int) $pedidoEntrega->funcionario_id === (int) $meuFuncionarioId;
            $novoEhMeuOuNulo = is_null($novoId) || (int) $novoId === (int) $meuFuncionarioId;
            $autoAtribuicao = $estavaLivreOuEraMeu && $novoEhMeuOuNulo;
        }

        if (!$gerencia && !$autoAtribuicao) {
            abort(403, 'Você não tem permissão para atribuir funcionários neste pedido.');
        }

        if (!empty($validated['funcionario_id'])) {
            $pertenceAoLocal = Funcionario::where('id', $validated['funcionario_id'])
                ->where('estabelecimento_id', $pedidoEntrega->estabelecimento_id)
                ->exists();
            if (!$pertenceAoLocal) {
                return $request->wantsJson()
                    ? response()->json(['error' => 'Esse funcionário não pertence a este local.'], 422)
                    : back()->withErrors(['error' => 'Esse funcionário não pertence a este local.']);
            }
        }

        $entregadorUsuarioId = $user->id;
        if (!empty($validated['funcionario_id'])) {
            $entregadorUsuarioId = Funcionario::whereKey($validated['funcionario_id'])->value('usuario_id');
        } elseif (empty($validated['eu_mesmo']) && empty($validated['funcionario_id'])) {
            $entregadorUsuarioId = null;
        }

        $pedidoEntrega->update([
            'funcionario_id' => $validated['funcionario_id'] ?? null,
            'entregador_usuario_id' => $entregadorUsuarioId,
            'atribuido_por' => $user->id,
        ]);

        return $request->wantsJson()
            ? response()->json(['message' => 'Funcionário atribuído ao pedido.', 'pedido' => $pedidoEntrega->fresh()])
            : back()->with('success', 'Funcionário atribuído ao pedido.');
    }

    public function comprovantePDF(Request $request, PedidoEntrega $pedidoEntrega)
    {
        $user = $request->user();
        $ehCliente = (int) $pedidoEntrega->cliente_id === (int) $user->id;
        $ehVendedor = (int) $pedidoEntrega->vendedor_id === (int) $user->id;

        $ehEntregador = (int) $pedidoEntrega->entregador_usuario_id === (int) $user->id;
        $ehDoLocal = $pedidoEntrega->estabelecimento_id
            && $user->estabelecimentos()->where('estabelecimentos.id', $pedidoEntrega->estabelecimento_id)->exists();

        if (!$ehCliente && !$ehVendedor && !$ehEntregador && !$ehDoLocal && $user->papel !== 'admin') {
            abort(403, 'Você não tem permissão para ver este comprovante.');
        }

        $pedidoEntrega->load(['produto', 'cliente:id,name,email,mobile_phone,cpf_cnpj', 'vendedor:id,name,email,mobile_phone', 'estabelecimento:id,nome,cnpj,razao_social,telefone,cep,rua,numero,complemento,bairro,cidade,estado', 'pagamento']);

        $pdf = Pdf::loadView('pdfs.comprovante_entrega', [
            'pedido' => $pedidoEntrega,
            'mostrarCodigo' => $ehCliente || $user->papel === 'admin',
            'mostrarFinanceiro' => $ehVendedor || $user->papel === 'admin',
            'mostrarDocumentoCliente' => $ehCliente || $user->papel === 'admin',
            'vendedorCadastro' => Provider::where('user_id', $pedidoEntrega->vendedor_id)->first(),
            'formasPagamento' => self::FORMAS_PAGAMENTO,
        ]);

        return $pdf->download("Comprovante_Entrega_{$pedidoEntrega->codigo_pedido}.pdf");
    }

    public const FORMAS_PAGAMENTO = [
        'online' => 'Pagamento online (Asaas, com custódia até a entrega)',
        'local' => 'Pagamento no local',
        'direto_vendedor' => 'Pagamento direto com o vendedor',
    ];

    /** Dados que a tela do cliente precisa: endereço, forma de pagamento, código e contato. */
    public function dadosDoPedidoParaCliente(PedidoEntrega $pedido): array
    {
        $dados = $pedido->toArray();
        $dados['forma_pagamento_label'] = self::FORMAS_PAGAMENTO[$pedido->modo_pagamento] ?? $pedido->modo_pagamento;
        $dados['endereco_recebimento'] = $pedido->modo_recebimento === 'entrega'
            ? trim(implode(', ', array_filter([$pedido->entrega_rua, $pedido->entrega_numero, $pedido->entrega_complemento])) . ' - ' . $pedido->entrega_bairro . ', ' . $pedido->entrega_cidade . '/' . $pedido->entrega_estado . ' (CEP ' . $pedido->entrega_cep . ')')
            : trim(implode(', ', array_filter([$pedido->origem_rua, $pedido->origem_numero, $pedido->origem_complemento])) . ' - ' . $pedido->origem_bairro . ', ' . $pedido->origem_cidade . '/' . $pedido->origem_estado);
        $dados['codigo_confirmacao_visivel'] = in_array($pedido->status, ['pago', 'aguardando_confirmacao'], true)
            ? $pedido->codigo_confirmacao
            : null;

        $dados['avaliado'] = \App\Models\AvaliacaoProdutoEntrega::where('pedido_entrega_id', $pedido->id)->exists();
        $dados['pontos_ganhos'] = $pedido->status === 'concluido' && $pedido->estabelecimento_id
            ? app(\App\Services\Entregas\EntregasRecursosService::class)->pontosDaCompra($pedido)
            : 0;
        $dados['em_rota'] = \App\Services\Entregas\EntregasRecursosService::vendedorMonitora($pedido)
            && (bool) $pedido->em_rota_em
            && $pedido->status !== 'concluido';

        return $dados;
    }

    private function garantirPertenceAoPedido(PedidoEntrega $pedido, $user): void
    {
        if ((int) $pedido->cliente_id !== (int) $user->id && (int) $pedido->vendedor_id !== (int) $user->id) {
            abort(403, 'Você não tem permissão para ver este pedido.');
        }
    }

    /** Quem pode confirmar a entrega: o vendedor, a equipe do local ou o funcionário designado. */
    private function garantirPodeConfirmarEntrega(PedidoEntrega $pedido, $user): void
    {
        $ehVendedor = (int) $pedido->vendedor_id === (int) $user->id;
        $ehDoLocal = $pedido->estabelecimento_id
            && $user->estabelecimentos()->where('estabelecimentos.id', $pedido->estabelecimento_id)->exists();
        $ehFuncionarioDesignado = (int) $pedido->entregador_usuario_id === (int) $user->id
            || ($pedido->funcionario_id
                && Funcionario::where('id', $pedido->funcionario_id)->where('usuario_id', $user->id)->exists());

        if (!$ehVendedor && !$ehDoLocal && !$ehFuncionarioDesignado && $user->papel !== 'admin') {
            abort(403, 'Só o vendedor ou a equipe do local pode confirmar esta entrega.');
        }
    }
}
