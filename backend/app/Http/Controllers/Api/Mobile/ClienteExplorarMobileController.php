<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Models\Estabelecimento;
use App\Models\ItemAluguel;
use Illuminate\Http\Request;
use Carbon\Carbon;

class ClienteExplorarMobileController extends Controller
{
    /**
     * 🔍 EXPLORAR (Busca inteligente de Estabelecimentos, Serviços e Reservas)
     */
    public function index(Request $request)
    {
        $tipoBusca = $request->input('tipo_busca', 'estabelecimentos'); 
        $busca = $request->input('busca');
        $categoria = $request->input('categoria');
        $perPage = 15;

        // =====================================================================
        // FLUXO A: BUSCA POR ESTABELECIMENTOS
        // =====================================================================
        if ($tipoBusca === 'estabelecimentos') {
            $query = Estabelecimento::where('ativo', true);

            if ($busca) {
                $termo = "%{$busca}%";
                $query->where(function($q) use ($termo) {
                    $q->where('nome', 'ilike', $termo)
                      ->orWhere('cidade', 'ilike', $termo)
                      ->orWhere('estado', 'ilike', $termo)
                      ->orWhere('ramo_atuacao', 'ilike', $termo);
                });
            }

            if ($categoria && $categoria !== 'Tudo' && $categoria !== 'tudo') {
                $query->where('ramo_atuacao', $categoria);
            }

            $estabelecimentos = $query->withMin('servicos as valor', 'valor')
                                      ->latest()
                                      ->paginate($perPage);

            return response()->json($estabelecimentos);
        }

        // =====================================================================
        // FLUXO B & C: BUSCA POR SERVIÇOS OU RESERVAS (ITENS ALUGUEL)
        // =====================================================================
        if ($tipoBusca === 'servicos' || $tipoBusca === 'reservas') {
            $queryItens = ItemAluguel::with(['estabelecimento:id,nome,foto_perfil,cidade,estado,avaliacao_media'])
                ->whereHas('estabelecimento', function($q) {
                    $q->where('ativo', true);
                });

            if ($busca) {
                $termoItem = "%{$busca}%";
                $queryItens->where(function ($q) use ($termoItem) {
                    $q->where('nome', 'ilike', $termoItem)
                      ->orWhere('descricao', 'ilike', $termoItem)
                      ->orWhere('categoria', 'ilike', $termoItem)
                      ->orWhere('marca', 'ilike', $termoItem);
                });
            }

            if ($categoria && $categoria !== 'Tudo' && $categoria !== 'tudo') {
                $queryItens->where('categoria', $categoria);
            }

            $itens = $queryItens->latest()->paginate($perPage);

            // Formatar os itens para a tela do React Native entender (Card Padrão)
            $itens->getCollection()->transform(function ($item) {
                $item->fotos = is_string($item->fotos) ? json_decode($item->fotos, true) : ($item->fotos ?? []);
                
                // Mapeia os dados do Item para as variáveis que o App lê
                $item->foto_perfil = !empty($item->fotos) ? $item->fotos[0] : ($item->estabelecimento->foto_perfil ?? null);
                $item->ramo_atuacao = $item->categoria; // App lê ramo_atuacao
                $item->cidade = $item->estabelecimento->cidade ?? '';
                $item->estado = $item->estabelecimento->estado ?? '';
                $item->avaliacao_media = $item->estabelecimento->avaliacao_media ?? 'Novo';
                
                return $item;
            });

            return response()->json($itens);
        }

        return response()->json(['data' => []]);
    }

    // ⭐ DESTAQUES (Carrossel Horizontal)
    public function destaques()
    {
        $estabelecimentos = Estabelecimento::where('ativo', true)
            ->withMin('servicos as valor', 'valor')
            ->inRandomOrder()
            ->limit(6)
            ->get();

        return response()->json(['status' => 'success', 'data' => $estabelecimentos]);
    }

    // 🆕 MAIS RECENTES
    public function recentes()
    {
        $estabelecimentos = Estabelecimento::where('ativo', true)
            ->withMin('servicos as valor', 'valor')
            ->latest()
            ->limit(10)
            ->get();

        return response()->json(['status' => 'success', 'data' => $estabelecimentos]);
    }

    // 📍 POR CIDADE
    public function porCidade($cidade)
    {
        $estabelecimentos = Estabelecimento::where('ativo', true)
            ->where('cidade', $cidade)
            ->withMin('servicos as valor', 'valor')
            ->get();

        return response()->json(['status' => 'success', 'data' => $estabelecimentos]);
    }

    // 📂 CATEGORIAS DISPONÍVEIS
    public function categorias()
    {
        $categorias = Estabelecimento::whereNotNull('ramo_atuacao')
            ->distinct()
            ->pluck('ramo_atuacao');

        return response()->json(['status' => 'success', 'data' => $categorias]);
    }

    // 🔥 DETALHE DO ESTABELECIMENTO
    public function show($id)
    {
        $estabelecimento = Estabelecimento::with(['servicos' => function ($q) {
            $q->where('ativo', true);
        }])->findOrFail($id);

        return response()->json(['status' => 'success', 'data' => $estabelecimento]);
    }
}