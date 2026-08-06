<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Models\Estabelecimento;
use App\Models\ItemAluguel;
use Illuminate\Http\Request;

class ClienteExplorarMobileController extends Controller
{
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