<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agendamento;
use Illuminate\Http\Request;

class AgendamentoController extends Controller
{
    /**
     * GET /api/agendamentos
     * Pode ser usado pelo Cliente (ver seus agendamentos) ou pelo Estabelecimento (ver a fila).
     */
    public function index(Request $request)
    {
        // Eager loading: já traz os dados relacionados para não fazer N+1 queries
        $query = Agendamento::with(['usuario', 'servico', 'funcionario']);

        // Se o cliente quiser ver o histórico dele: ?usuario_id=1
        if ($request->has('usuario_id')) {
            $query->where('usuario_id', $request->usuario_id);
        }

        // Se o painel quiser ver a fila de hoje: ?estabelecimento_id=1&data=YYYY-MM-DD
        if ($request->has('estabelecimento_id')) {
            $query->where('estabelecimento_id', $request->estabelecimento_id);
        }
        if ($request->has('data')) {
            $query->whereDate('data_agendamento', $request->data);
        }

        return response()->json($query->orderBy('hora_agendamento', 'asc')->get());
    }

    /**
     * POST /api/agendamentos
     * O cliente (ou a recepção) cria um novo agendamento/entra na fila.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'estabelecimento_id' => 'required|exists:estabelecimentos,id',
            'servico_id' => 'required|exists:servicos,id',
            'funcionario_id' => 'nullable|exists:funcionarios,id', // Opcional, pode ser 'qualquer um'
            'data_agendamento' => 'required|date',
            'hora_agendamento' => 'required|date_format:H:i',
        ]);

        // Associa o agendamento ao usuário logado na API
        $validated['usuario_id'] = $request->user()->id;
        $validated['status'] = 'pendente'; // Status inicial padrão

        $agendamento = Agendamento::create($validated);

        return response()->json([
            'message' => 'Agendamento confirmado com sucesso!',
            'data' => $agendamento
        ], 201);
    }

    /**
     * GET /api/agendamentos/{id}
     * Detalhes de um agendamento específico.
     */
    public function show(string $id)
    {
        $agendamento = Agendamento::with(['usuario', 'servico', 'estabelecimento'])->findOrFail($id);
        return response()->json($agendamento);
    }

    /**
     * PUT ou PATCH /api/agendamentos/{id}
     * Atualiza o agendamento (Ex: O funcionário finaliza o atendimento).
     */
    public function update(Request $request, string $id)
    {
        $agendamento = Agendamento::findOrFail($id);

        $validated = $request->validate([
            'status' => 'sometimes|in:pendente,confirmado,finalizado,cancelado',
            'funcionario_id' => 'sometimes|nullable|exists:funcionarios,id', // Quem assumiu o atendimento
            'foi_realizado' => 'sometimes|boolean',
            'hora_finalizacao' => 'sometimes|date_format:H:i',
            'valor_final' => 'sometimes|numeric|min:0',
        ]);

        // Se o status mudar para finalizado, podemos preencher automaticamente a hora e quem finalizou
        if (isset($validated['status']) && $validated['status'] === 'finalizado') {
            $validated['foi_realizado'] = true;
            $validated['hora_finalizacao'] = $validated['hora_finalizacao'] ?? now()->format('H:i');
            $validated['finalizado_por'] = $request->user()->id; 
        }

        $agendamento->update($validated);

        return response()->json([
            'message' => 'Status do agendamento atualizado!',
            'data' => $agendamento
        ]);
    }

    /**
     * DELETE /api/agendamentos/{id}
     * Cancela o agendamento em vez de deletar do banco.
     */
    public function destroy(string $id)
    {
        $agendamento = Agendamento::findOrFail($id);
        
        $agendamento->update(['status' => 'cancelado']);

        return response()->json(['message' => 'Agendamento cancelado com sucesso!']);
    }
}