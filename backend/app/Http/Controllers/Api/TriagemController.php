<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Triagem;
use Illuminate\Http\Request;

class TriagemController extends Controller
{
    /**
     * GET /api/triagens
     * Lista as triagens. Os funcionários usam para ver quem precisa ser avaliado.
     */
    public function index(Request $request)
    {
        // Traz a triagem já com as respostas e o nome do cliente
        $query = Triagem::with(['respostas', 'usuario:id,name']);

        if ($request->has('estabelecimento_id')) {
            $query->where('estabelecimento_id', $request->estabelecimento_id);
        }
        if ($request->has('status')) { // pendente, aprovado, recusado
            $query->where('status', $request->status);
        }

        return response()->json($query->latest()->paginate(15));
    }

    /**
     * POST /api/triagens
     * Cria uma nova ficha de triagem para um usuário.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'estabelecimento_id' => 'required|exists:estabelecimentos,id',
            'agendamento_id' => 'nullable|exists:agendamentos,id',
            'observacoes' => 'nullable|string',
        ]);

        $validated['usuario_id'] = $request->user()->id; // Quem está preenchendo (cliente)
        $validated['status'] = 'pendente';

        $triagem = Triagem::create($validated);

        return response()->json([
            'message' => 'Triagem iniciada com sucesso!',
            'data' => $triagem
        ], 201);
    }

    /**
     * GET /api/triagens/{id}
     */
    public function show(string $id)
    {
        $triagem = Triagem::with(['respostas', 'usuario'])->findOrFail($id);
        return response()->json($triagem);
    }

    /**
     * PUT/PATCH /api/triagens/{id}
     * O funcionário aprova ou recusa a triagem e adiciona observações.
     */
    public function update(Request $request, string $id)
    {
        $triagem = Triagem::findOrFail($id);

        $validated = $request->validate([
            'observacoes' => 'sometimes|string',
            'status' => 'sometimes|in:pendente,aprovado,recusado'
        ]);

        $triagem->update($validated);

        return response()->json([
            'message' => 'Status da triagem atualizado!',
            'data' => $triagem
        ]);
    }

    /**
     * DELETE /api/triagens/{id}
     */
    public function destroy(string $id)
    {
        $triagem = Triagem::findOrFail($id);
        // Em vez de apagar, podemos apenas mudar o status para não perder histórico médico/técnico
        $triagem->update(['status' => 'recusado', 'observacoes' => 'Cancelado pelo sistema/usuário']);

        return response()->json(['message' => 'Triagem cancelada.']);
    }
}