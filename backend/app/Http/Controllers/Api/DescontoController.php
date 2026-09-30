<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Desconto;
use Illuminate\Http\Request;

class DescontoController extends Controller
{
    /**
     * Confere se o usuário logado administra o estabelecimento informado.
     * Sem isso, qualquer conta autenticada podia criar/editar/desativar
     * descontos e recompensas de QUALQUER estabelecimento — inclusive de
     * concorrentes — só sabendo/adivinhando o id.
     */
    private function garantirQueGerencia(Request $request, int $estabelecimentoId): void
    {
        $gerencia = $request->user()->estabelecimentos()
            ->where('estabelecimentos.id', $estabelecimentoId)
            ->exists();

        abort_unless($gerencia, 403, 'Você não tem permissão para gerenciar descontos deste estabelecimento.');
    }

    /**
     * GET /api/descontos
     */
    public function index(Request $request)
    {
        $query = Desconto::query()->where('ativo', true);

        if ($request->has('estabelecimento_id')) {
            $query->where('estabelecimento_id', $request->estabelecimento_id);
        }

        // Retorna apenas descontos que estão dentro da validade
        $query->where(function ($q) {
            $q->whereNull('data_fim')->orWhere('data_fim', '>=', now()->toDateString());
        });

        return response()->json($query->get());
    }

    /**
     * POST /api/descontos
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'estabelecimento_id' => 'required|exists:estabelecimentos,id',
            'titulo' => 'required|string|max:255',
            'descricao' => 'nullable|string',
            'tipo' => 'required|in:percentual,fixo,pontos',
            'valor' => 'required|numeric|min:0',
            'pontos_necessarios' => 'nullable|integer|min:0',
            'data_inicio' => 'nullable|date',
            'data_fim' => 'nullable|date|after_or_equal:data_inicio',
            'ativo' => 'boolean'
        ]);

        $this->garantirQueGerencia($request, (int) $validated['estabelecimento_id']);

        $desconto = Desconto::create($validated);

        return response()->json([
            'message' => 'Desconto/Recompensa criado!',
            'data' => $desconto
        ], 201);
    }

    public function show(string $id)
    {
        return response()->json(Desconto::findOrFail($id));
    }

    public function update(Request $request, string $id)
    {
        $desconto = Desconto::findOrFail($id);
        $this->garantirQueGerencia($request, (int) $desconto->estabelecimento_id);

        $validated = $request->validate([
            'titulo' => 'sometimes|string|max:255',
            'descricao' => 'sometimes|string',
            'tipo' => 'sometimes|in:percentual,fixo,pontos',
            'valor' => 'sometimes|numeric|min:0',
            'pontos_necessarios' => 'sometimes|nullable|integer',
            'data_inicio' => 'sometimes|nullable|date',
            'data_fim' => 'sometimes|nullable|date',
            'ativo' => 'sometimes|boolean'
        ]);

        $desconto->update($validated);

        return response()->json(['message' => 'Desconto atualizado', 'data' => $desconto]);
    }

    public function destroy(Request $request, string $id)
    {
        $desconto = Desconto::findOrFail($id);
        $this->garantirQueGerencia($request, (int) $desconto->estabelecimento_id);

        $desconto->update(['ativo' => false]);

        return response()->json(['message' => 'Desconto inativado.']);
    }
}
