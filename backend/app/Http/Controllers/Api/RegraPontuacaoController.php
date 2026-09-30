<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RegraPontuacao;
use Illuminate\Http\Request;

class RegraPontuacaoController extends Controller
{
    /**
     * Mesma checagem usada em Desconto/ContaPagamento: sem isso, qualquer
     * usuário autenticado podia criar/editar/desativar regras de pontuação
     * de QUALQUER estabelecimento.
     */
    private function garantirQueGerencia(Request $request, int $estabelecimentoId): void
    {
        $gerencia = $request->user()->estabelecimentos()
            ->where('estabelecimentos.id', $estabelecimentoId)
            ->exists();

        abort_unless($gerencia, 403, 'Você não tem permissão para gerenciar regras de pontuação deste estabelecimento.');
    }

    public function index(Request $request)
    {
        $query = RegraPontuacao::query();
        if ($request->has('estabelecimento_id')) {
            $query->where('estabelecimento_id', $request->estabelecimento_id);
        }
        return response()->json($query->where('ativo', true)->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'estabelecimento_id' => 'required|exists:estabelecimentos,id',
            'tipo' => 'required|string|max:100', // ex: fidelidade, indicacao
            'descricao' => 'nullable|string',
            'pontos_por_acao' => 'required|integer|min:1',
            'ativo' => 'boolean'
        ]);

        $this->garantirQueGerencia($request, (int) $validated['estabelecimento_id']);

        $regra = RegraPontuacao::create($validated);

        return response()->json(['message' => 'Regra criada!', 'data' => $regra], 201);
    }

    public function show(string $id)
    {
        return response()->json(RegraPontuacao::findOrFail($id));
    }

    public function update(Request $request, string $id)
    {
        $regra = RegraPontuacao::findOrFail($id);
        $this->garantirQueGerencia($request, (int) $regra->estabelecimento_id);

        $validated = $request->validate([
            'tipo' => 'sometimes|string|max:100',
            'descricao' => 'sometimes|string',
            'pontos_por_acao' => 'sometimes|integer|min:1',
            'ativo' => 'sometimes|boolean'
        ]);

        $regra->update($validated);
        return response()->json(['message' => 'Regra atualizada!', 'data' => $regra]);
    }

    public function destroy(Request $request, string $id)
    {
        $regra = RegraPontuacao::findOrFail($id);
        $this->garantirQueGerencia($request, (int) $regra->estabelecimento_id);

        $regra->update(['ativo' => false]);
        return response()->json(['message' => 'Regra inativada.']);
    }
}
