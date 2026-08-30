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

            $dados = $request->except('fotos');
            $dados['usuario_id'] = Auth::id();
            $dados['estabelecimento_id'] = $request->estabelecimento_id;
            $dados['servico_id']     = $request->input('servico_id');
            $dados['agendamento_id'] = $request->input('agendamento_id');
            $dados['aluguel_id']     = $request->input('aluguel_id');

            $caminhosFotos = [];

            if ($request->hasFile('fotos')) {
                $fotos = $request->file('fotos');

                if (count($fotos) > 5) {
                    return response()->json(['error' => 'Poxa, você só pode enviar no máximo 5 fotos por produto.'], 400);
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

            $dados['fotos'] = json_encode($caminhosFotos);

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
            return response()->json(['error' => 'Ops! Ocorreu um erro inesperado ao salvar o produto.'], 500);
        }
    }

    /**
     * 2. Editar Produto
     */
    public function update(Request $request, $id)
    {
        try {
            $produto = Produto::findOrFail($id);

            // Se o estabelecimento estiver sendo alterado, verifica a permissão na pivot
            if ($request->has('estabelecimento_id') && $request->estabelecimento_id != $produto->estabelecimento_id) {
                $temPermissao = DB::table('estabelecimento_usuario')
                    ->where('usuario_id', Auth::id())
                    ->where('estabelecimento_id', $request->estabelecimento_id)
                    ->exists();

                if (!$temPermissao) {
                    return response()->json(['error' => 'Permissão negada para alterar para este estabelecimento.'], 403);
                }
            }

            $dados = $request->all();
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

        return Inertia::render('Estabelecimentos/ProdutoManager', [
            'produtos'         => $produtos,
            'estabelecimentos' => $estabelecimentos
        ]);
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
     * 6. Listar produtos para o CLIENTE
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
     * 8. Adicionar ao Agendamento/Aluguel
     */
    public function adicionarAoAgendamento(Request $request, $produto_id)
    {
        try {
            $request->validate([
                'vinculo_id' => 'required|integer',
                'tipo'       => 'required|in:agendamento,aluguel'
            ]);

            $produto = Produto::findOrFail($produto_id);

            if ($produto->estoque_disponivel <= 0) {
                return response()->json(['error' => 'Produto sem estoque.'], 400);
            }

            $model = $request->tipo === 'agendamento' 
                ? Agendamento::findOrFail($request->vinculo_id)
                : Aluguel::findOrFail($request->vinculo_id);

            if ($produto->estabelecimento_id !== $model->estabelecimento_id) {
                return response()->json(['error' => 'Produto pertence a outro estabelecimento.'], 400);
            }

            $produto->decrement('estoque_disponivel');
            $produto->increment('quantidade_vendida');

            $model->valor_final += $produto->valor_final;
            $model->save();

            return response()->json([
                'message'    => 'Produto adicionado com sucesso ao pedido!', 
                'novo_valor' => $model->valor_final
            ]);

        } catch (\Exception $e) {
            return response()->json(['error' => 'Não foi possível vincular o produto.'], 400);
        }
    }

    /**
     * 9. Repor Estoque
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
     * 10. Vincular Produto na Tabela Pivot `itens_aluguel`
     */
    public function vincularProduto(Request $request)
    {
        try {
            $request->validate([
                'produto_id'     => 'required|exists:produtos,id',
                'servico_id'     => 'nullable|exists:servicos,id',
                'agendamento_id' => 'nullable|exists:agendamentos,id',
                'aluguel_id'     => 'nullable|exists:alugueis,id',
                'quantidade'     => 'required|integer|min:1'
            ]);

            $produto = Produto::findOrFail($request->produto_id);

            if ($produto->estoque_disponivel < $request->quantidade) {
                return response()->json(['error' => 'Estoque insuficiente.'], 400);
            }

            DB::table('itens_aluguel')->insert([
                'estabelecimento_id'         => $produto->estabelecimento_id,
                'servico_id'                 => $request->servico_id,
                'nome'                       => $produto->nome,
                'categoria'                  => 'outro',
                'descricao'                  => $produto->descricao,
                'quantidade'                 => $request->quantidade,
                'valor_diaria'               => $produto->valor_final,
                'usuario_id'                 => Auth::id(),
                'usuario_estabelecimento_id' => null,
                'pagamento_id'               => $request->pagamento_id,
                'agendamento_id'             => $request->agendamento_id,
                'aluguel_id'                 => $request->aluguel_id,
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

        } catch (\Exception $e) {
            Log::error('Erro ao vincular produto: ' . $e->getMessage());
            return response()->json(['error' => 'Erro ao processar o vínculo do produto.'], 500);
        }
    }

    /* Auxiliares Privados */
    private function imagemContemConteudoInadequado($foto)
    {
        try {
            $hiveKey = env('HIVE_API_KEY'); 
            if (!$hiveKey) return false;

            $response = Http::withHeaders([
                'authorization' => 'token ' . $hiveKey,
                'accept'        => 'application/json',
            ])->attach('media', file_get_contents($foto->getRealPath()), $foto->getClientOriginalName())
              ->post('https://api.thehive.ai/api/v2/task/sync', ['classes' => 'nsfw']);

            if ($response->successful()) {
                $classes = $response->json()['status'][0]['response']['output'][0]['classes'] ?? [];
                foreach ($classes as $class) {
                    if (in_array($class['class'], ['yes_nsfw', 'pornography']) && $class['score'] > 0.70) {
                        return true; 
                    }
                }
            }
        } catch (\Exception $e) {
            Log::error('Hive AI error: ' . $e->getMessage());
        }
        return false;
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