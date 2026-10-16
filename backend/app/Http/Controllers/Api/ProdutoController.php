<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Produto;
use App\Models\Agendamento;
use App\Models\Aluguel;
use App\Models\Estabelecimento;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class ProdutoController extends Controller
{
    /**
     * Retornar JSON com Meus Produtos para o React
     */
    public function meusProdutosJson()
    {
        $estabelecimentosIds = DB::table('estabelecimento_usuario')
            ->where('usuario_id', Auth::id())
            ->pluck('estabelecimento_id');

        $produtos = Produto::whereIn('estabelecimento_id', $estabelecimentosIds)
            ->orWhere('usuario_id', Auth::id())
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($produtos);
    }

    /**
     * 1. Criar Produto (Com verificação de Vínculo com Estabelecimento)
     */
    public function store(Request $request)
    {
        try {
            $request->validate([
                'estabelecimento_id' => 'required|exists:estabelecimentos,id',
                'nome'               => 'required|string|max:255',
            ], [
                'estabelecimento_id.required' => 'Por favor, selecione qual estabelecimento receberá este produto.',
                'estabelecimento_id.exists'   => 'O estabelecimento selecionado não existe.'
            ]);

            // Verifica na tabela pivot se o usuário tem permissão para o estabelecimento selecionado
            $temPermissao = DB::table('estabelecimento_usuario')
                ->where('usuario_id', Auth::id())
                ->where('estabelecimento_id', $request->estabelecimento_id)
                ->exists();

            if (!$temPermissao) {
                return response()->json([
                    'error' => 'Você não tem permissão para cadastrar produtos neste estabelecimento.'
                ], 403);
            }

            $dados = $request->except(['fotos', 'vinculo_modo', 'agendamento_id']);
            $dados['usuario_id'] = Auth::id();
            $dados['estabelecimento_id'] = $request->estabelecimento_id;
            // "Onde este produto aparece": só na loja, em todo o local, em um serviço ou em uma reserva.
            $dados = array_merge($dados, app(\App\Services\ProdutosAdicionaisService::class)
                ->normalizarVinculo($request->all(), (int) $request->estabelecimento_id, Auth::user()));

            $caminhosFotos = [];

            if ($request->hasFile('fotos')) {
                $fotos = $request->file('fotos');

                if (count($fotos) > 5) {
                    return response()->json(['error' => 'Você só pode enviar no máximo 5 fotos por produto.'], 400);
                }

                foreach ($fotos as $foto) {
                    if ($this->imagemContemConteudoInadequado($foto)) {
                        return response()->json([
                            'error' => 'Uma das imagens enviadas violou nossos termos de uso (conteúdo inadequado detectado).'
                        ], 400);
                    }

                    $urlImageKit = $this->uploadParaImageKit($foto);
                    $caminhosFotos[] = $urlImageKit;
                }
            }

            // O Model já tem cast 'fotos' => 'array' — atribuir aqui uma string
            // json_encode()ada fazia o cast codificar de novo por cima,
            // gravando um JSON duplamente escapado no banco.
            $dados['fotos'] = $caminhosFotos;

            $isPromocao = $request->boolean('is_promocao') || $request->boolean('promocao');
            $dados['is_promocao'] = $isPromocao;
            unset($dados['promocao']);

            if ($isPromocao) {
                $dados['valor_final'] = $dados['valor_promocional'] ?? 0;
            } else {
                $dados['valor_final'] = $dados['valor_normal'] ?? 0;
            }

            $produto = Produto::create($dados);
            return response()->json($produto, 201);

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['error' => $e->validator->errors()->first()], 422);
        } catch (\Exception $e) {
            Log::error('Erro ao criar produto: ' . $e->getMessage());
            return response()->json(['error' => 'Ocorreu um erro inesperado ao salvar o produto.'], 500);
        }
    }

    /**
     * 2. Editar Produto
     */
    public function update(Request $request, $id)
    {
        try {
            $produto = Produto::findOrFail($id);

            // Antes só checava permissão quando o estabelecimento_id estava MUDANDO —
            // ou seja, qualquer usuário autenticado podia editar produto de outro
            // estabelecimento contanto que não tentasse movê-lo. Agora checa sempre,
            // no estabelecimento atual do produto.
            $temPermissaoAtual = DB::table('estabelecimento_usuario')
                ->where('usuario_id', Auth::id())
                ->where('estabelecimento_id', $produto->estabelecimento_id)
                ->exists();

            if (!$temPermissaoAtual) {
                return response()->json(['error' => 'Você não tem permissão para editar este produto.'], 403);
            }

            // Se o estabelecimento estiver sendo alterado, verifica a permissão no destino também
            if ($request->has('estabelecimento_id') && $request->estabelecimento_id != $produto->estabelecimento_id) {
                $temPermissaoDestino = DB::table('estabelecimento_usuario')
                    ->where('usuario_id', Auth::id())
                    ->where('estabelecimento_id', $request->estabelecimento_id)
                    ->exists();

                if (!$temPermissaoDestino) {
                    return response()->json(['error' => 'Permissão negada para alterar para este estabelecimento.'], 403);
                }
            }

            // Fotos tratadas à parte: arquivos e listas não vão direto para o campo `fotos`.
            $dados = $request->except(['fotos', 'fotos_existentes', 'fotos_mantidas', '_method', 'vinculo_modo', 'agendamento_id']);
            if ($request->hasAny(['vinculo_modo', 'atrelado_reservas', 'servico_id', 'aluguel_id'])) {
                $dados = array_merge($dados, app(\App\Services\ProdutosAdicionaisService::class)->normalizarVinculo(
                    $request->all() + ['atrelado_reservas' => $produto->atrelado_reservas],
                    (int) ($request->input('estabelecimento_id') ?: $produto->estabelecimento_id),
                    Auth::user()
                ));
            }

            $fotos = $this->fotosDaEdicao($request, $produto);
            if ($fotos instanceof \Illuminate\Http\JsonResponse) {
                return $fotos;
            }
            if ($fotos !== null) {
                $dados['fotos'] = $fotos;
            }

            $hasPromocaoInput = $request->has('is_promocao') || $request->has('promocao');

            if ($hasPromocaoInput) {
                $isPromocao = $request->boolean('is_promocao') || $request->boolean('promocao');
                $dados['is_promocao'] = $isPromocao;

                if ($isPromocao) {
                    $dados['valor_final'] = $dados['valor_promocional'] ?? $produto->valor_promocional;
                } else {
                    $dados['valor_final'] = $dados['valor_normal'] ?? $produto->valor_normal;
                }
            } elseif (isset($dados['valor_normal'])) {
                $dados['valor_final'] = $dados['valor_normal'];
            }

            unset($dados['promocao']);

            $produto->update($dados);
            return response()->json($produto);

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['error' => $e->validator->errors()->first()], 422);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Não conseguimos atualizar este produto agora.'], 400);
        }
    }

    /**
     * 3. Apagar Produto
     */
    public function destroy($id)
    {
        try {
            $produto = Produto::withTrashed()->findOrFail($id);

            // Não tinha NENHUMA checagem de dono aqui — qualquer usuário autenticado
            // conseguia apagar (forceDelete, permanente) o produto de qualquer
            // estabelecimento só sabendo/adivinhando o id.
            $temPermissao = DB::table('estabelecimento_usuario')
                ->where('usuario_id', Auth::id())
                ->where('estabelecimento_id', $produto->estabelecimento_id)
                ->exists();

            if (!$temPermissao) {
                return response()->json(['error' => 'Você não tem permissão para apagar este produto.'], 403);
            }

            $produto->forceDelete();
            return response()->json(['message' => 'Produto apagado com sucesso.']);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Produto não encontrado ou já foi excluído.'], 404);
        }
    }

    /**
     * 4. Listar produtos e carregar estabelecimentos do usuário para o Inertia
     */
    public function meusProdutos()
    {
        $usuarioId = Auth::id();

        // Obtém os IDs dos estabelecimentos associados ao usuário na pivot
        $estabelecimentosIds = DB::table('estabelecimento_usuario')
            ->where('usuario_id', $usuarioId)
            ->pluck('estabelecimento_id');

        // Busca as informações dos estabelecimentos para popular o <select> do form
        $estabelecimentos = Estabelecimento::whereIn('id', $estabelecimentosIds)
            ->get(['id', 'nome']);

        // Busca os produtos dos estabelecimentos do usuário
        $produtos = Produto::whereIn('estabelecimento_id', $estabelecimentosIds)
            ->orWhere('usuario_id', $usuarioId)
            ->orderBy('created_at', 'desc')
            ->get();

        // Serviços e reservas (locações) aos quais o produto pode ser vinculado.
        $listaServicos = \App\Models\Servico::whereIn('estabelecimento_id', $estabelecimentosIds)
            ->where('ativo', true)
            ->orderBy('nome')
            ->get(['id', 'nome', 'estabelecimento_id']);

        // Reservas de qualquer tipo: as dos locais do sócio e as avulsas dele.
        $listaReservas = app(\App\Services\ProdutosAdicionaisService::class)->reservasDoSocio(Auth::user());

        // Tela única de produtos: aba "Com serviço ou reserva" (estes produtos) e aba "Entrega e retirada"
        // (produtos_entrega), que só sócio/proprietário/admin podem gerenciar.
        $papel = mb_strtolower((string) Auth::user()->papel);
        $podeEntrega = in_array($papel, ['socio', 'sócio', 'proprietario', 'proprietário', 'admin'], true);
        $aba = request('aba') === 'entrega' && $podeEntrega ? 'entrega' : 'vinculados';

        return Inertia::render('Estabelecimentos/Produtos', [
            'aba'              => $aba,
            'podeEntrega'      => $podeEntrega,
            'vinculados'       => [
                'produtos'         => $produtos,
                'estabelecimentos' => $estabelecimentos,
                'listaServicos'    => $listaServicos,
                'listaReservas'    => $listaReservas,
            ],
            'entrega'          => $podeEntrega ? app(ProdutoEntregaController::class)->dadosDaTela() : null,
        ]);
    }

    /**
     * App: dados da aba "Com serviço ou reserva" (produtos, locais e o que pode ser vinculado).
     * Cada produto já vem com o nome do serviço e da reserva a que está vinculado.
     */
    public function dadosApp()
    {
        $usuarioId = Auth::id();
        $estabelecimentosIds = DB::table('estabelecimento_usuario')->where('usuario_id', $usuarioId)->pluck('estabelecimento_id');

        $servicos = \App\Models\Servico::whereIn('estabelecimento_id', $estabelecimentosIds)->where('ativo', true)->orderBy('nome')->get(['id', 'nome', 'estabelecimento_id']);
        $reservas = app(\App\Services\ProdutosAdicionaisService::class)->reservasDoSocio(Auth::user());
        $nomeServico = $servicos->pluck('nome', 'id');
        $nomeReserva = collect($reservas)->pluck('nome', 'id');

        $produtos = Produto::whereIn('estabelecimento_id', $estabelecimentosIds)
            ->orWhere('usuario_id', $usuarioId)
            ->orderByDesc('created_at')
            ->get()
            ->map(function (Produto $p) use ($nomeServico, $nomeReserva) {
                $p->setAttribute('servico_nome', $p->servico_id ? ($nomeServico[$p->servico_id] ?? null) : null);
                $p->setAttribute('reserva_nome', $p->aluguel_id ? ($nomeReserva[$p->aluguel_id] ?? null) : null);
                $p->setAttribute('vinculo_modo', \App\Services\ProdutosAdicionaisService::modoDe($p));

                return $p;
            });

        return response()->json([
            'produtos' => $produtos,
            'estabelecimentos' => Estabelecimento::whereIn('id', $estabelecimentosIds)->get(['id', 'nome']),
            'servicos' => $servicos,
            'reservas' => $reservas,
        ]);
    }

    /**
     * Adicionais que o cliente pode escolher para um serviço (?servico_id=) ou uma reserva (?item_aluguel_id=).
     */
    public function adicionais(Request $request)
    {
        $dados = $request->validate([
            'servico_id' => 'nullable|integer|required_without:item_aluguel_id',
            'item_aluguel_id' => 'nullable|integer|required_without:servico_id',
        ]);

        return response()->json(['produtos' => app(\App\Services\ProdutosAdicionaisService::class)
            ->disponiveis($dados['servico_id'] ?? null, $dados['item_aluguel_id'] ?? null, $request->user())->values()]);
    }

    /** Relatório do sócio: adicionais vendidos junto com serviços e reservas (web e app). */
    public function adicionaisVendidos(Request $request)
    {
        $dados = $request->validate(['dias' => 'nullable|integer|in:7,30,90']);

        return response()->json(app(\App\Services\ResultadosSocioService::class)->adicionaisVendidos($request->user(), (int) ($dados['dias'] ?? 30)));
    }

    /**
     * 5. Listar produtos de um estabelecimento
     */
    public function produtosPorEstabelecimento($estabelecimento_id)
    {
        $produtos = Produto::where('estabelecimento_id', $estabelecimento_id)->get();
        return response()->json($produtos);
    }

    /**
     * 6. Listar produtos para o CLIENTE (Vitrine e Extras)
     */
    public function produtosDisponiveisParaCliente(Request $request, $estabelecimento_id)
    {
        try {
            $usuario = Auth::check() ? Auth::user() : null;
            $isPremium = false;

            if ($usuario) {
                $planosPremium = ['premium', 'premium_plus', 'pro'];
                $isPremium = in_array(strtolower($usuario->plano_assinatura ?? ''), $planosPremium);
            }

            $query = Produto::where('estabelecimento_id', $estabelecimento_id)
                            ->where('estoque_disponivel', '>', 0)
                            ->where('atrelado_reservas', true);

            if (!$isPremium) {
                $query->where('somente_premium', false);
            }

            $produtos = $query->orderBy('is_promocao', 'desc')
                              ->orderBy('nome', 'asc')
                              ->get();

            return response()->json($produtos);

        } catch (\Exception $e) {
            Log::error('Erro ao listar produtos para cliente: ' . $e->getMessage());
            return response()->json(['error' => 'Não conseguimos carregar os itens adicionais.'], 500);
        }
    }

    /**
     * 7. Ofertas Premium para Clientes
     */
    public function produtosExclusivosPremium($estabelecimento_id)
    {
        try {
            $usuario = Auth::user();
            $planosPremium = ['premium', 'premium_plus', 'pro']; 

            if (!$usuario || !in_array(strtolower($usuario->plano_assinatura ?? ''), $planosPremium)) {
                return response()->json([
                    'error' => 'Acesso negado. Assine um plano Premium.'
                ], 403);
            }

            $produtos = Produto::where('estabelecimento_id', $estabelecimento_id)
                               ->where('estoque_disponivel', '>', 0)
                               ->where(function ($q) {
                                   $q->where('somente_premium', true)
                                     ->orWhere('is_promocao', true);
                               })
                               ->get();

            return response()->json($produtos);

        } catch (\Exception $e) {
            return response()->json(['error' => 'Erro ao carregar ofertas premium.'], 500);
        }
    }

    /**
     * 8. Repor Estoque
     */
    public function adicionarEstoque(Request $request, $id)
    {
        try {
            $request->validate(['quantidade' => 'required|integer|min:1']);

            $produto = Produto::findOrFail($id);
            $produto->increment('estoque_disponivel', $request->quantidade);

            return response()->json([
                'message'       => 'Estoque atualizado!', 
                'estoque_atual' => $produto->estoque_disponivel
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Valor inválido para estoque.'], 400);
        }
    }

    /**
     * 9. Vincular Produto na Tabela Pivot `itens_aluguel`
     */
    public function vincularProduto(Request $request)
    {
        try {
            $request->validate([
                'produto_id'                 => 'required|exists:produtos,id',
                'servico_id'                 => 'nullable|exists:servicos,id',
                'agendamento_id'             => 'nullable|exists:agendamentos,id',
                'aluguel_id'                 => 'nullable|exists:alugueis,id',
                'pagamento_id'               => 'nullable',
                'usuario_estabelecimento_id' => 'nullable',
                'quantidade'                 => 'required|integer|min:1'
            ]);

            // Trava a linha do produto dentro da transação: compras simultâneas nunca vendem além do estoque.
            return DB::transaction(function () use ($request) {
                $produto = Produto::whereKey($request->produto_id)->lockForUpdate()->firstOrFail();

                if ($produto->estoque_disponivel < $request->quantidade) {
                    return response()->json(['error' => 'Estoque insuficiente.'], 400);
                }

                DB::table('itens_aluguel')->insert([
                    'nome'                       => $produto->nome,
                    'categoria'                  => 'outro',
                    'descricao'                  => $produto->descricao,
                    'quantidade'                 => $request->quantidade,
                    'valor_diaria'               => $produto->valor_final,
                    'usuario_id'                 => Auth::id(), // Registra o usuário logado
                    // itens_aluguel.estabelecimento_id aponta para users (o dono), não para estabelecimentos.
                    'estabelecimento_id'         => $produto->usuario_id,
                    'servico_id'                 => $request->servico_id,
                    'agendamento_id'             => $request->agendamento_id,
                    'aluguel_id'                 => $request->aluguel_id,
                    'pagamento_id'               => $request->pagamento_id,
                    'usuario_estabelecimento_id' => $request->usuario_estabelecimento_id ?? null,
                    'created_at'                 => now(),
                    'updated_at'                 => now(),
                ]);

                $produto->decrement('estoque_disponivel', $request->quantidade);
                if (isset($produto->quantidade_vendida)) {
                    $produto->increment('quantidade_vendida', $request->quantidade);
                }

                return response()->json([
                    'message'          => 'Produto vinculado com sucesso!',
                    'estoque_restante' => $produto->estoque_disponivel
                ], 200);
            });

        } catch (\Exception $e) {
            Log::error('Erro ao vincular produto na tabela itens_aluguel: ' . $e->getMessage());
            return response()->json(['error' => 'Erro ao processar o vínculo do produto.'], 500);
        }
    }

    /**
     * Fotos na edição: mantém só as que o produto já tinha (vindas em `fotos_existentes`, JSON ou lista,
     * ou `fotos_mantidas[]`) e soma as novas enviadas em `fotos[]`, até 5 no total.
     * Devolve null quando a edição não mexe em fotos (ficam como estão).
     */
    private function fotosDaEdicao(Request $request, Produto $produto)
    {
        $mexeuEmFotos = $request->has('fotos_existentes') || $request->has('fotos_mantidas') || $request->hasFile('fotos');
        if (!$mexeuEmFotos) {
            return null;
        }

        $atuais = is_array($produto->fotos) ? $produto->fotos : (json_decode((string) $produto->fotos, true) ?: []);

        $pedidas = $request->input('fotos_mantidas', $request->input('fotos_existentes', []));
        if (is_string($pedidas)) {
            $pedidas = json_decode($pedidas, true) ?: [];
        }
        // Só fotos que já eram deste produto: ninguém consegue "colar" uma URL de fora.
        $mantidas = array_values(array_filter((array) $pedidas, fn ($url) => is_string($url) && in_array($url, $atuais, true)));

        $novas = $request->hasFile('fotos') ? (array) $request->file('fotos') : [];
        if (count($mantidas) + count($novas) > 5) {
            return response()->json(['error' => 'Você só pode ter no máximo 5 fotos por produto.'], 400);
        }

        foreach ($novas as $foto) {
            if ($this->imagemContemConteudoInadequado($foto)) {
                return response()->json(['error' => 'Uma das imagens enviadas violou nossos termos de uso (conteúdo inadequado detectado).'], 400);
            }
            $mantidas[] = $this->uploadParaImageKit($foto);
        }

        return $mantidas;
    }

    /* =========================================================================
       MÉTODOS PRIVADOS AUXILIARES (HIVE AI E IMAGEKIT)
       ========================================================================= */

    /** Moderação de imagem centralizada no HiveAiService (desligada por padrão). */
    private function imagemContemConteudoInadequado($foto)
    {
        return \App\Services\HiveAiService::bloqueada($foto);
    }

    private function uploadParaImageKit($foto)
    {
        $privateKey = env('IMAGEKIT_PRIVATE_KEY');
        if (!$privateKey) throw new \Exception('Chave ImageKit ausente.');

        $response = Http::withBasicAuth($privateKey, '')
            ->attach('file', file_get_contents($foto->getRealPath()), $foto->getClientOriginalName())
            ->post('https://upload.imagekit.io/api/v1/files/upload', [
                'fileName' => uniqid() . '_' . preg_replace('/[^A-Za-z0-9\-\.]/', '', $foto->getClientOriginalName()),
                'folder'   => '/produtos_lokyva' 
            ]);

        if ($response->successful()) {
            return $response->json('url');
        }

        throw new \Exception('Falha no upload para o ImageKit.');
    }
}