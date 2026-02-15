<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Funcionario;
use Illuminate\Http\Request;

class FuncionarioController extends Controller
{
    /**
     * GET /api/funcionarios?estabelecimento_id=1
     * Lista os funcionários ativos de um estabelecimento.
     */
    public function index(Request $request)
    {
        $query = Funcionario::query();

        if ($request->has('estabelecimento_id')) {
            $query->where('estabelecimento_id', $request->estabelecimento_id);
        }

        return response()->json($query->where('ativo', true)->get());
    }

    /**
     * POST /api/funcionarios
     * Cadastra um novo funcionário.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'estabelecimento_id' => 'required|exists:estabelecimentos,id',
            'usuario_id' => 'nullable|exists:users,id', // Se o funcionário tiver login no sistema
            'nome' => 'required|string|max:255',
            'telefone' => 'nullable|string|max:20',
            'cargo' => 'nullable|string|max:255',
            'ativo' => 'boolean'
        ]);

        $funcionario = Funcionario::create($validated);

        return response()->json([
            'message' => 'Funcionário cadastrado com sucesso!',
            'data' => $funcionario
        ], 201);
    }

    /**
     * GET /api/funcionarios/{id}
     * Detalhes de um funcionário específico.
     */
    public function show(string $id)
    {
        $funcionario = Funcionario::findOrFail($id);
        return response()->json($funcionario);
    }

    /**
     * PUT ou PATCH /api/funcionarios/{id}
     * Atualiza dados (ex: mudou de telefone ou de cargo).
     */
    public function update(Request $request, string $id)
    {
        $funcionario = Funcionario::findOrFail($id);

        $validated = $request->validate([
            'usuario_id' => 'sometimes|nullable|exists:users,id',
            'nome' => 'sometimes|string|max:255',
            'telefone' => 'sometimes|nullable|string|max:20',
            'cargo' => 'sometimes|nullable|string|max:255',
            'ativo' => 'sometimes|boolean'
        ]);

        $funcionario->update($validated);

        return response()->json([
            'message' => 'Dados do funcionário atualizados!',
            'data' => $funcionario
        ]);
    }

    /**
     * DELETE /api/funcionarios/{id}
     * Inativa o funcionário (Soft Delete lógico).
     */
    public function destroy(string $id)
    {
        $funcionario = Funcionario::findOrFail($id);
        $funcionario->update(['ativo' => false]); // Preserva o histórico de atendimentos dele

        return response()->json(['message' => 'Funcionário inativado com sucesso!']);
    }
}