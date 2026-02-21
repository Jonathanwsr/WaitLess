<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Estabelecimento;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ClienteExplorarController extends Controller
{
    public function index(Request $request)
    {
        $query = Estabelecimento::where('ativo', true);

        if ($request->filled('busca')) {
            $termo = '%' . $request->busca . '%';
            $query->where(function($q) use ($termo) {
                $q->where('nome', 'ilike', $termo)
                  ->orWhere('cidade', 'ilike', $termo);
            });
        }

        if ($request->filled('categoria')) {
            $query->where('ramo_atuacao', $request->categoria);
        }

        $estabelecimentos = $query->latest()->paginate(12)->withQueryString();

        return Inertia::render('Cliente/Explorar', [
            'estabelecimentos' => $estabelecimentos,
            'filtros' => $request->only(['busca', 'categoria'])
        ]);
    }
}