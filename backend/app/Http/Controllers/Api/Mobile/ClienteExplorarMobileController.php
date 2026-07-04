<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Models\Estabelecimento;
use Illuminate\Http\Request;

class ClienteExplorarMobileController extends Controller
{

    public function index(Request $request)
    {
        $query = Estabelecimento::where('ativo', true);

        if ($request->filled('busca')) {
            $termo = '%' . $request->busca . '%';

            $query->where(function ($q) use ($termo) {
                $q->where('nome', 'ilike', $termo)
                  ->orWhere('cidade', 'ilike', $termo);
            });
        }

        if ($request->filled('categoria')) {
            $query->where('ramo_atuacao', $request->categoria);
        }

        $estabelecimentos = $query
            ->withMin('servicos', 'valor') 
            ->latest()
            ->paginate(10);

        return response()->json($estabelecimentos);
    }

    // ⭐ DESTAQUES (home tipo iFood)
    public function destaques()
    {
        $estabelecimentos = Estabelecimento::where('ativo', true)
            ->withMin('servicos', 'valor')
            ->inRandomOrder()
            ->limit(6)
            ->get();

        return response()->json($estabelecimentos);
    }

    // 🆕 MAIS RECENTES
    public function recentes()
    {
        $estabelecimentos = Estabelecimento::where('ativo', true)
            ->withMin('servicos', 'valor')
            ->latest()
            ->limit(10)
            ->get();

        return response()->json($estabelecimentos);
    }

    // 📍 POR CIDADE
    public function porCidade($cidade)
    {
        $estabelecimentos = Estabelecimento::where('ativo', true)
            ->where('cidade', $cidade)
            ->withMin('servicos', 'valor')
            ->get();

        return response()->json($estabelecimentos);
    }

    // 📂 CATEGORIAS DISPONÍVEIS
    public function categorias()
    {
        $categorias = Estabelecimento::whereNotNull('ramo_atuacao')
            ->distinct()
            ->pluck('ramo_atuacao');

        return response()->json($categorias);
    }

    // 🔥 DETALHE DO ESTABELECIMENTO (com serviços + fotos)
    public function show($id)
    {
        $estabelecimento = Estabelecimento::with(['servicos' => function ($q) {
            $q->where('ativo', true);
        }])->findOrFail($id);

        return response()->json($estabelecimento);
    }
}
