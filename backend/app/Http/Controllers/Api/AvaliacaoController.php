<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Avaliacao;
use Illuminate\Http\Request;

class AvaliacaoController extends Controller
{
    /**
     * GET /api/avaliacoes?estabelecimento_id=1
     * Lista avaliações públicas de um local (Para mostrar na tela do App).
     */
    public function index(Request $request)
    {
        $query = Avaliacao::with('usuario:id,name,foto_perfil'); // Traz só o nome e foto do user

        if ($request->has('estabelecimento_id')) {
            $query->where('estabelecimento_id', $request->estabelecimento_id);
        }

        // Mostra apenas as públicas
        return response()->json($query->where('publica', true)->latest()->paginate(15));
    }

    /**
     * POST /api/avaliacoes
     * O cliente avalia o atendimento.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'estabelecimento_id' => 'required|exists:estabelecimentos,id',
            'agendamento_id' => 'nullable|exists:agendamentos,id',
            'nota' => 'required|integer|min:1|max:5',
            'comentario' => 'nullable|string',
            'publica' => 'boolean'
        ]);

        $validated['usuario_id'] = $request->user()->id; // Quem está logado avaliando

        $avaliacao = Avaliacao::create($validated);

        // BÔNUS ARQUITETURAL: Aqui você poderia disparar um evento para 
        // recalcular a `avaliacao_media` na tabela `estabelecimentos`.

        return response()->json([
            'message' => 'Avaliação enviada. Obrigado!',
            'data' => $avaliacao
        ], 201);
    }

    /**
     * GET /api/avaliacoes/{id}
     */
    public function show(string $id)
    {
        return response()->json(Avaliacao::findOrFail($id));
    }

    /**
     * PUT/PATCH /api/avaliacoes/{id}
     * O usuário quer alterar o comentário ou alguém deu "curtir" na avaliação.
     */
    public function update(Request $request, string $id)
    {
        $avaliacao = Avaliacao::findOrFail($id);

        $validated = $request->validate([
            'nota' => 'sometimes|integer|min:1|max:5',
            'comentario' => 'sometimes|string',
            'publica' => 'sometimes|boolean',
            'curtidas' => 'sometimes|integer' // Ex: Incrementar curtidas
        ]);

        $avaliacao->update($validated);

        return response()->json([
            'message' => 'Avaliação atualizada.',
            'data' => $avaliacao
        ]);
    }

    /**
     * DELETE /api/avaliacoes/{id}
     * Remove a avaliação (geralmente só o dono do comentário ou o Admin do sistema pode fazer).
     */
    public function destroy(string $id)
    {
        $avaliacao = Avaliacao::findOrFail($id);
        $avaliacao->delete(); // Aqui podemos deletar fisicamente, ou usar SoftDelete do Laravel

        return response()->json(['message' => 'Avaliação removida!']);
    }
}