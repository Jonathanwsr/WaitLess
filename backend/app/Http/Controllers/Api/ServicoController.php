<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Servico;
use Illuminate\Http\Request;

class ServicoController extends Controller
{
   
    public function index(Request $request)
    {
        $query = Servico::query();

        // Filtra os serviços apenas do estabelecimento selecionado
        if ($request->has('estabelecimento_id')) {
            $query->where('estabelecimento_id', $request->estabelecimento_id);
        }

        $servicos = $query->where('ativo', true)->get();

        return response()->json($servicos);
    }

  
    public function store(Request $request)
    {
        $validated = $request->validate([
            'estabelecimento_id' => 'required|exists:estabelecimentos,id',
            'nome' => 'required|string|max:255',
            'descricao' => 'nullable|string',
            'valor' => 'required|numeric|min:0',
            'duracao_minutos' => 'required|integer|min:1',
            'ativo' => 'boolean'
        ]);

        $servico = Servico::create($validated);

        return response()->json([
            'message' => 'Serviço adicionado com sucesso!',
            'data' => $servico
        ], 201);
    }

   
    public function show(string $id)
    {
        $servico = Servico::findOrFail($id);
        return response()->json($servico);
    }

   
    public function update(Request $request, string $id)
    {
        $servico = Servico::findOrFail($id);

        $validated = $request->validate([
            'nome' => 'sometimes|string|max:255',
            'descricao' => 'sometimes|string',
            'valor' => 'sometimes|numeric|min:0',
            'duracao_minutos' => 'sometimes|integer|min:1',
            'ativo' => 'sometimes|boolean'
        ]);

        $servico->update($validated);

        return response()->json([
            'message' => 'Serviço atualizado com sucesso!',
            'data' => $servico
        ]);
    }

    /**
     * DELETE /api/servicos/{id}
     * Remove um serviço.
     */
    public function destroy(string $id)
    {
        $servico = Servico::findOrFail($id);
        
        // Para serviços, deletar pode quebrar o histórico de agendamentos passados.
        // O ideal é apenas inativar.
        $servico->update(['ativo' => false]);

        return response()->json([
            'message' => 'Serviço inativado com sucesso!'
        ]);
    }
}