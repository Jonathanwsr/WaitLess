<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CustoOperacional;
use App\Services\AdminRelatorioService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class AdminRelatorioController extends Controller
{
    public function __construct(private AdminRelatorioService $service)
    {
    }

    public function index(Request $request)
    {
        $mes = $request->query('mes'); // 'Y-m', opcional — filtra o resumo/evolução/custos por competência

        return Inertia::render('Admin/Relatorios', [
            'mes' => $mes,
            'resumo' => $this->service->resumoFinanceiro($mes),
            'evolucaoMensal' => $this->service->evolucaoMensal(6),
            'repasses' => $this->service->repassesPorProprietario(),
            'estornos' => $this->service->resumoEstornos(),
            'clientes' => $this->service->resumoClientes(),
            'custos' => $this->service->custosOperacionais($mes),
            'custosPorCategoria' => $this->service->custosPorCategoria($mes),
            'categoriasCusto' => CustoOperacional::CATEGORIAS,
        ]);
    }

    public function storeCusto(Request $request)
    {
        $validated = $request->validate([
            'categoria' => 'required|string|in:' . implode(',', array_keys(CustoOperacional::CATEGORIAS)),
            'descricao' => 'required|string|max:255',
            'valor' => 'required|numeric|min:0.01',
            'competencia' => 'required|date',
            'recorrente' => 'boolean',
        ]);

        CustoOperacional::create([
            ...$validated,
            'recorrente' => $validated['recorrente'] ?? false,
            'criado_por' => Auth::id(),
        ]);

        return back()->with('success', 'Custo operacional lançado.');
    }

    public function updateCusto(Request $request, CustoOperacional $custo)
    {
        $validated = $request->validate([
            'categoria' => 'required|string|in:' . implode(',', array_keys(CustoOperacional::CATEGORIAS)),
            'descricao' => 'required|string|max:255',
            'valor' => 'required|numeric|min:0.01',
            'competencia' => 'required|date',
            'recorrente' => 'boolean',
        ]);

        $custo->update([
            ...$validated,
            'recorrente' => $validated['recorrente'] ?? false,
        ]);

        return back()->with('success', 'Custo operacional atualizado.');
    }

    public function destroyCusto(CustoOperacional $custo)
    {
        $custo->delete();

        return back()->with('success', 'Custo operacional removido.');
    }
}
