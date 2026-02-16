<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RespostaTriagem;
use Illuminate\Http\Request;

class RespostaTriagemController extends Controller
{
    public function index(Request $request)
    {
        $query = RespostaTriagem::query();
        if ($request->has('triagem_id')) {
            $query->where('triagem_id', $request->triagem_id);
        }
        return response()->json($query->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'triagem_id' => 'required|exists:triagens,id',
            'pergunta' => 'required|string|max:255',
            'resposta' => 'required|string',
        ]);

        $resposta = RespostaTriagem::create($validated);

        return response()->json(['message' => 'Resposta salva!', 'data' => $resposta], 201);
    }

    public function show(string $id)
    {
        return response()->json(RespostaTriagem::findOrFail($id));
    }

    public function update(Request $request, string $id)
    {
        $resposta = RespostaTriagem::findOrFail($id);

        $validated = $request->validate([
            'pergunta' => 'sometimes|string|max:255',
            'resposta' => 'sometimes|string',
        ]);

        $resposta->update($validated);

        return response()->json(['message' => 'Resposta atualizada.', 'data' => $resposta]);
    }

    public function destroy(string $id)
    {
        $resposta = RespostaTriagem::findOrFail($id);
        $resposta->delete(); // Aqui podemos deletar a linha fisicamente

        return response()->json(['message' => 'Resposta removida.']);
    }
}