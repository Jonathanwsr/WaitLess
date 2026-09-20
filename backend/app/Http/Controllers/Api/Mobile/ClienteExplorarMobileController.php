<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Models\Estabelecimento;
use App\Models\ItemAluguel;
use App\Models\Servico;
use App\Models\Produto;
use App\Services\PlanoService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Exception;

class ClienteExplorarMobileController extends Controller
{
    private function calcularValorComDesconto(float $valorBase, bool $temPromocao, ?string $tipoDesconto, $valorDesconto): float
    {
        if (!$temPromocao || !$valorDesconto) return $valorBase;

        $desconto = (float) $valorDesconto;
        $valorFinal = $tipoDesconto === 'fixo'
            ? $valorBase - $desconto
            : $valorBase - ($valorBase * $desconto / 100);

        return max(0, round($valorFinal, 2));
    }

    /**
     * GET /explorar/ofertas-premium
     * Serviços, reservas e produtos exclusivos/com desconto para o app. Usuários
     * não Premium recebem a mesma lista com `bloqueado: true`, para mostrar o
     * que estão perdendo e incentivar a assinatura (diferenciação por plano).
     */
    public function ofertasPremium(Request $request, PlanoService $planoService)
    {
        try {
            $user = Auth::user();
            $isPremium = $user && in_array($user->plano_assinatura, $planoService->planosPermitidos('user'), true);

            // Servico::estabelecimento() aponta para Estabelecimento (coluna "nome"), enquanto
            // ItemAluguel::estabelecimento() aponta para User (coluna "name") — selects diferentes
            // por tabela, com alias para "name" para o app ler um campo único e consistente.
            $servicos = Servico::with(['estabelecimento' => function ($q) {
                    $q->select('id', 'nome as name', 'foto_perfil', 'cidade', 'estado');
                }])
                ->where('ativo', true)
                ->where(function ($q) { $q->where('somente_premium', true)->orWhere('tem_promocao', true); })
                ->latest()
                ->get()
                ->map(function ($s) {
                    return [
                        'id' => $s->id, 'tipo' => 'servico', 'nome' => $s->nome, 'descricao' => $s->descricao,
                        'fotos' => $s->fotos, 'estabelecimento' => $s->estabelecimento,
                        'somente_premium' => (bool) $s->somente_premium, 'tem_promocao' => (bool) $s->tem_promocao,
                        'aceita_pontos' => (bool) $s->aceita_pontos, 'maximo_pontos_permitidos' => $s->maximo_pontos_permitidos,
                        'valor_original' => (float) $s->valor,
                        'valor_com_desconto' => $this->calcularValorComDesconto((float) $s->valor, (bool) $s->tem_promocao, $s->tipo_desconto, $s->valor_desconto),
                    ];
                });

            $itensAluguel = ItemAluguel::with(['estabelecimento' => function ($q) {
                    $q->select('id', 'name', 'foto_perfil', 'cidade', 'estado');
                }])
                ->where('ativo', true)
                ->where(function ($q) { $q->where('somente_premium', true)->orWhere('tem_promocao', true); })
                ->latest()
                ->get()
                ->map(function ($item) {
                    $base = (float) ($item->valor_diaria ?? 0);
                    return [
                        'id' => $item->id, 'tipo' => 'reserva', 'nome' => $item->nome, 'categoria' => $item->categoria,
                        'descricao' => $item->descricao, 'fotos' => $item->fotos, 'estabelecimento' => $item->estabelecimento,
                        'somente_premium' => (bool) $item->somente_premium, 'tem_promocao' => (bool) $item->tem_promocao,
                        'aceita_pontos' => (bool) $item->aceita_pontos, 'maximo_pontos_permitidos' => $item->maximo_pontos_permitidos,
                        'valor_original' => $base,
                        'valor_com_desconto' => $this->calcularValorComDesconto($base, (bool) $item->tem_promocao, $item->tipo_desconto, $item->valor_desconto),
                    ];
                });

            $produtos = Produto::with(['estabelecimento' => function ($q) {
                    $q->select('id', 'nome as name', 'foto_perfil', 'cidade', 'estado');
                }])
                ->where('estoque_disponivel', '>', 0)
                ->where(function ($q) { $q->where('somente_premium', true)->orWhere('is_promocao', true); })
                ->latest()
                ->get()
                ->map(function ($p) {
                    return [
                        'id' => $p->id, 'tipo' => 'produto', 'nome' => $p->nome, 'descricao' => $p->descricao,
                        'fotos' => Produto::decodeFotos($p->fotos), 'estabelecimento' => $p->estabelecimento,
                        'somente_premium' => (bool) $p->somente_premium, 'tem_promocao' => (bool) $p->is_promocao,
                        'valor_original' => (float) $p->valor_normal, 'valor_com_desconto' => (float) $p->valor_final,
                    ];
                });

            $marcar = function ($colecao) use ($isPremium) {
                return $colecao->map(function ($oferta) use ($isPremium) {
                    $oferta['bloqueado'] = $oferta['somente_premium'] && !$isPremium;
                    if ($oferta['bloqueado']) {
                        $oferta['valor_com_desconto'] = $oferta['valor_original'];
                    }
                    return $oferta;
                })->values();
            };

            return response()->json([
                'status' => 'success',
                'isPremium' => $isPremium,
                'planoAtual' => $user->plano_assinatura ?? null,
                'servicos' => $marcar($servicos),
                'itensAluguel' => $marcar($itensAluguel),
                'produtos' => $marcar($produtos),
            ]);
        } catch (Exception $e) {
            Log::error('[ClienteExplorarMobileController] ofertasPremium: ' . $e->getMessage(), ['exception' => $e]);
            return response()->json([
                'status' => 'error',
                'message' => 'Não foi possível carregar as ofertas agora. Tente novamente em instantes.',
            ], 500);
        }
    }

    /**
     * 🔍 EXPLORAR (Busca inteligente idêntica à versão Web)
     */
    public function index(Request $request)
    {
        $tipoBusca = $request->input('tipo_busca', 'estabelecimentos');
        $busca = $request->filled('busca') ? strip_tags(trim($request->input('busca'))) : null;
        $categoria = $request->filled('categoria') ? strip_tags(trim($request->input('categoria'))) : null;
        $perPage = 15;

        // Opções que representam "Buscar Tudo" (Trata strings vazias enviadas pelo React Native)
        $termosTudo = ['tudo', 'todos', 'todas', ''];

        // =====================================================================
        // FLUXO A: BUSCA POR ESTABELECIMENTOS
        // =====================================================================
        if ($tipoBusca === 'estabelecimentos') {
            $queryEstabelecimentos = Estabelecimento::where('ativo', true);

            if ($busca) {
                $termo = "%{$busca}%";
                $queryEstabelecimentos->where(function($q) use ($termo) {
                    $q->where('nome', 'ilike', $termo)
                      ->orWhere('cidade', 'ilike', $termo)
                      ->orWhere('estado', 'ilike', $termo);
                });
            }

            if ($categoria && !in_array(strtolower($categoria), $termosTudo)) {
                $queryEstabelecimentos->where('ramo_atuacao', 'ilike', "%{$categoria}%");
            }

            // Removido o withMin() que estava quebrando a API por relação inexistente
            $estabelecimentos = $queryEstabelecimentos->latest()->paginate($perPage);

            $estabelecimentos->getCollection()->transform(function ($est) {
                $est->valor = 0; // Fallback padronizado com a web
                return $est;
            });

            return response()->json($estabelecimentos);
        }

        // =====================================================================
        // FLUXO B & C: BUSCA POR SERVIÇOS OU RESERVAS (ITENS ALUGUEL)
        // =====================================================================
        if ($tipoBusca === 'servicos' || $tipoBusca === 'reservas') {
            
            // Usando a mesma flexibilidade da consulta Web
            $queryItens = ItemAluguel::with(['estabelecimento'])
                ->whereHas('estabelecimento');

            if ($busca) {
                $queryItens->where(function ($q) use ($busca) {
                    $termoItem = "%{$busca}%";
                    $q->where('nome', 'ilike', $termoItem)
                      ->orWhere('marca', 'ilike', $termoItem)
                      ->orWhere('modelo', 'ilike', $termoItem)
                      ->orWhere('descricao', 'ilike', $termoItem);
                });
            }

            if ($categoria && !in_array(strtolower($categoria), $termosTudo)) {
                $queryItens->where('categoria', 'ilike', "%{$categoria}%");
            }

            $itens = $queryItens->latest()->paginate($perPage);

            // Formatação Idêntica à Versão Web (Incluindo cálculos de promoção)
            $itens->getCollection()->transform(function ($item) {
                // Fotos seguras
                $fotosDecodificadas = is_string($item->fotos) ? json_decode($item->fotos, true) : $item->fotos;
                $item->fotos = is_array($fotosDecodificadas) ? $fotosDecodificadas : [];
                $item->foto_perfil = !empty($item->fotos) ? $item->fotos[0] : ($item->estabelecimento->foto_perfil ?? null);
                
                // Mapeamento para o App
                $item->ramo_atuacao = $item->categoria; 
                $item->cidade = $item->estabelecimento->cidade ?? '';
                $item->estado = $item->estabelecimento->estado ?? '';
                $item->avaliacao_media = $item->estabelecimento->avaliacao_media ?? '5.0';
                
                // CÁLCULO DE DESCONTO EXATAMENTE IGUAL AO DA WEB
                $valorBase = floatval($item->valor_diaria);
                $precoComDesconto = $valorBase;

                if ($item->tem_promocao && floatval($item->valor_desconto) > 0) {
                    if ($item->tipo_desconto === 'percentual') {
                        $precoComDesconto = $valorBase - ($valorBase * (floatval($item->valor_desconto) / 100));
                    } else {
                        $precoComDesconto = max(0, $valorBase - floatval($item->valor_desconto));
                    }
                }

                $item->valor = (float) $precoComDesconto;
                $item->preco_final_cliente = number_format($precoComDesconto, 2, '.', '');
                
                return $item;
            });

            return response()->json($itens);
        }

        return response()->json(['data' => []]);
    }

    // =====================================================================
    // MÉTODOS AUXILIARES CORRIGIDOS (Removidos withMin que causavam falhas)
    // =====================================================================
    public function destaques()
    {
        $estabelecimentos = Estabelecimento::where('ativo', true)
            ->inRandomOrder()
            ->limit(6)
            ->get()
            ->map(function ($est) {
                $est->valor = 0;
                return $est;
            });

        return response()->json(['status' => 'success', 'data' => $estabelecimentos]);
    }

    public function recentes()
    {
        $estabelecimentos = Estabelecimento::where('ativo', true)
            ->latest()
            ->limit(10)
            ->get()
            ->map(function ($est) {
                $est->valor = 0;
                return $est;
            });

        return response()->json(['status' => 'success', 'data' => $estabelecimentos]);
    }

    /**
     * 🏷️ CATEGORIAS DISPONÍVEIS (ramos de atuação com estabelecimentos ativos)
     * Alimenta o carrossel de categorias da Home/Explorar do app — o ícone de
     * cada uma é resolvido no cliente a partir do nome.
     */
    public function categorias()
    {
        $categorias = Estabelecimento::where('ativo', true)
            ->whereNotNull('ramo_atuacao')
            ->where('ramo_atuacao', '!=', '')
            ->selectRaw('ramo_atuacao as nome, count(*) as total')
            ->groupBy('ramo_atuacao')
            ->orderByDesc('total')
            ->get();

        return response()->json(['status' => 'success', 'data' => $categorias]);
    }

    public function porCidade($cidade)
    {
        $estabelecimentos = Estabelecimento::where('ativo', true)
            ->where('cidade', 'ilike', "%{$cidade}%")
            ->latest()
            ->paginate(15);

        $estabelecimentos->getCollection()->transform(function ($est) {
            $est->valor = 0;
            return $est;
        });

        return response()->json($estabelecimentos);
    }
}