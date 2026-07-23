<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Models\Estabelecimento;
use Illuminate\Http\Request;

class ClienteExplorarMobileController extends Controller
{
    // 🔍 EXPLORAR (Lista principal com paginação e filtros)
    public function index(Request $request)
    {
        $query = Estabelecimento::where('ativo', true);

        // Busca por texto digitado (Nome ou Cidade)
        if ($request->filled('busca')) {
            $termo = '%' . $request->busca . '%';

            $query->where(function ($q) use ($termo) {
                $q->where('nome', 'ilike', $termo)
                  ->orWhere('cidade', 'ilike', $termo);
            });
        }

        // Filtro por Categoria (Só filtra se vier preenchido E for diferente de 'Tudo')
        if ($request->filled('categoria') && $request->categoria !== 'Tudo') {
            // Supondo que a coluna no banco seja 'ramo_atuacao' ou 'categoria_tipo'
            $query->where('ramo_atuacao', $request->categoria);
        }

        // Busca as informações e cria um campo virtual 'valor' contendo o menor valor dos serviços
        $estabelecimentos = $query
            ->withMin('servicos as valor', 'valor') 
            ->latest()
            ->paginate(10); // O paginate já empacota o array dentro de "data", o que o front já entende

        return response()->json($estabelecimentos);
    }

    // ⭐ DESTAQUES (Carrossel Horizontal)
    public function destaques()
    {
        $estabelecimentos = Estabelecimento::where('ativo', true)
            ->withMin('servicos as valor', 'valor') // Pega o menor preço para o front exibir
            ->inRandomOrder() // Mistura para sempre exibir opções diferentes
            ->limit(6) // Limite de itens no carrossel
            ->get();

        // Retorna dentro de 'data' para padronizar a leitura no frontend
        return response()->json([
            'status' => 'success',
            'data' => $estabelecimentos
        ]);
    }

    // 🆕 MAIS RECENTES
    public function recentes()
    {
        $estabelecimentos = Estabelecimento::where('ativo', true)
            ->withMin('servicos as valor', 'valor')
            ->latest()
            ->limit(10)
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $estabelecimentos
        ]);
    }

    // 📍 POR CIDADE
    public function porCidade($cidade)
    {
        $estabelecimentos = Estabelecimento::where('ativo', true)
            ->where('cidade', $cidade)
            ->withMin('servicos as valor', 'valor')
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $estabelecimentos
        ]);
    }

    // 📂 CATEGORIAS DISPONÍVEIS NO BANCO
    public function categorias()
    {
        $categorias = Estabelecimento::whereNotNull('ramo_atuacao')
            ->distinct()
            ->pluck('ramo_atuacao');

        return response()->json([
            'status' => 'success',
            'data' => $categorias
        ]);
    }

    // 🔥 DETALHE DO ESTABELECIMENTO (com serviços + fotos)
    public function show($id)
    {
        $estabelecimento = Estabelecimento::with(['servicos' => function ($q) {
            // Traz apenas os serviços/produtos que estão ativos
            $q->where('ativo', true);
        }])->findOrFail($id);

        return response()->json([
            'status' => 'success',
            'data' => $estabelecimento
        ]);
    }
}