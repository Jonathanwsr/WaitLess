<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Gamificacao;
use Illuminate\Http\Request;

class GamificacaoController extends Controller
{
    public function index(Request $request)
    {
        $query = Gamificacao::where('ativo', true);

        if ($request->has('estabelecimento_id')) {
            $query->where('estabelecimento_id', $request->estabelecimento_id);
        }

        return response()->json($query->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'estabelecimento_id' => 'required|exists:estabelecimentos,id',
            'nome_sistema' => 'required|string|max:255',
            'descricao' => 'nullable|string',
            'ativo' => 'boolean'
        ]);

        $gamificacao = Gamificacao::create($validated);

        return response()->json(['message' => 'Sistema de Gamificação criado!', 'data' => $gamificacao], 201);
    }

    public function show(string $id)
    {
        return response()->json(Gamificacao::findOrFail($id));
    }

    public function update(Request $request, string $id)
    {
        $gamificacao = Gamificacao::findOrFail($id);

        $validated = $request->validate([
            'nome_sistema' => 'sometimes|string|max:255',
            'descricao' => 'sometimes|string',
            'ativo' => 'sometimes|boolean'
        ]);

        $gamificacao->update($validated);

        return response()->json(['message' => 'Sistema atualizado.', 'data' => $gamificacao]);
    }

    public function destroy(string $id)
    {
        $gamificacao = Gamificacao::findOrFail($id);
        $gamificacao->update(['ativo' => false]);

        return response()->json(['message' => 'Gamificação desativada.']);
    }
}