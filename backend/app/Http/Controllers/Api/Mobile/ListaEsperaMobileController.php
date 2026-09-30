<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Models\Servico;
use App\Services\ListaEsperaService;
use Illuminate\Http\Request;

/** Lista de espera de vagas para o cliente. */
class ListaEsperaMobileController extends Controller
{
    public function __construct(private ListaEsperaService $lista)
    {
    }

    public function index(Request $request)
    {
        return response()->json(['itens' => $this->lista->minhas($request->user())]);
    }

    public function store(Request $request)
    {
        $dados = $request->validate([
            'servico_id' => 'required|integer|exists:servicos,id',
            'data' => 'required|date',
            'hora' => 'nullable|date_format:H:i',
        ]);

        $servico = Servico::findOrFail($dados['servico_id']);

        try {
            $r = $this->lista->entrar($request->user(), $servico, $dados['data'], $dados['hora'] ?? null);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['error' => $e->getMessage(), 'message' => $e->getMessage()], 422);
        }

        return response()->json([
            'message' => 'Pronto! Avisamos você assim que abrir uma vaga.',
            'id' => $r['id'],
        ], 201);
    }

    public function destroy(Request $request, $id)
    {
        if (!$this->lista->sair($request->user(), (int) $id)) {
            return response()->json(['error' => 'Item não encontrado.', 'message' => 'Item não encontrado.'], 404);
        }

        return response()->json(['message' => 'Você saiu da lista de espera.']);
    }
}
