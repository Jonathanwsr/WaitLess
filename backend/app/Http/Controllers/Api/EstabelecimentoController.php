<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Estabelecimento;
use Illuminate\Http\Request;

class EstabelecimentoController extends Controller
{
    /**
     * GET /api/estabelecimentos
     * Lista todos os estabelecimentos (com paginação).
     */
    public function index()
    {
        // Traz apenas os ativos, paginados de 10 em 10
        $estabelecimentos = Estabelecimento::where('ativo', true)->paginate(10);
        return response()->json($estabelecimentos);
    }

    /**
     * POST /api/estabelecimentos
     * Cria um novo estabelecimento e já vincula o usuário logado como 'admin'.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'nome' => 'required|string|max:255',
            'ramo_atuacao' => 'nullable|string|max:255',
            'telefone' => 'nullable|string|max:20',
            'cep' => 'nullable|string|max:10',
            'rua' => 'nullable|string|max:255',
            'numero' => 'nullable|string|max:20',
            'complemento' => 'nullable|string|max:255',
            'bairro' => 'nullable|string|max:255',
            'cidade' => 'nullable|string|max:255',
            'estado' => 'nullable|string|max:2',
            'foto_perfil' => 'nullable|string', // Pode ser URL ou caminho do disco
        ]);

        // Os valores padrão (arrecadacao_total, avaliacao_media, etc) já são 0 no banco
        $estabelecimento = Estabelecimento::create($validated);

        // Opcional, mas recomendado: vincular quem criou como proprietário (Admin)
        if ($request->user()) {
            $estabelecimento->proprietarios()->attach($request->user()->id, ['tipo' => 'admin']);
        }

        return response()->json([
            'message' => 'Estabelecimento criado com sucesso!',
            'data' => $estabelecimento
        ], 201); // 201 = Created
    }

    /**
     * GET /api/estabelecimentos/{id}
     * Mostra os detalhes de um estabelecimento específico.
     */
    public function show(string $id)
    {
        // Traz o estabelecimento e já carrega os serviços e funcionários junto (Eager Loading)
        $estabelecimento = Estabelecimento::with(['servicos', 'funcionarios'])->findOrFail($id);
        
        return response()->json($estabelecimento);
    }

    /**
     * PUT ou PATCH /api/estabelecimentos/{id}
     * Atualiza os dados de um estabelecimento existente.
     */
    public function update(Request $request, string $id)
    {
        $estabelecimento = Estabelecimento::findOrFail($id);

        $validated = $request->validate([
            'nome' => 'sometimes|string|max:255',
            'ramo_atuacao' => 'sometimes|string|max:255',
            'telefone' => 'sometimes|string|max:20',
            'cep' => 'sometimes|string|max:10',
            'rua' => 'sometimes|string|max:255',
            'numero' => 'sometimes|string|max:20',
            'complemento' => 'sometimes|string|max:255',
            'bairro' => 'sometimes|string|max:255',
            'cidade' => 'sometimes|string|max:255',
            'estado' => 'sometimes|string|max:2',
            'ativo' => 'sometimes|boolean',
            'clientes_aguardando' => 'sometimes|integer' // Usado pelo sistema de filas para atualizar em tempo real
        ]);

        $estabelecimento->update($validated);

        return response()->json([
            'message' => 'Estabelecimento atualizado com sucesso!',
            'data' => $estabelecimento
        ]);
    }

    /**
     * DELETE /api/estabelecimentos/{id}
     * Remove ou inativa o estabelecimento.
     */
    public function destroy(string $id)
    {
        $estabelecimento = Estabelecimento::findOrFail($id);
        
        // Em vez de deletar do banco, em sistemas SaaS é comum apenas inativar
        $estabelecimento->update(['ativo' => false]);
        
        // Se quiser deletar definitivamente, use: $estabelecimento->delete();

        return response()->json([
            'message' => 'Estabelecimento inativado com sucesso!'
        ]);
    }
}