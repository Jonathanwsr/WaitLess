<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HistoricoPonto;
use App\Models\PontoUsuarioEstabelecimento;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class HistoricoPontoController extends Controller
{
    /**
     * GET /api/historico-pontos
     * Mostra o extrato de pontos do utilizador.
     */
    public function index(Request $request)
    {
        $query = HistoricoPonto::query();

        if ($request->has('usuario_id')) {
            $query->where('usuario_id', $request->usuario_id);
        }
        if ($request->has('estabelecimento_id')) {
            $query->where('estabelecimento_id', $request->estabelecimento_id);
        }

        return response()->json($query->orderBy('created_at', 'desc')->paginate(20));
    }

    /**
     * POST /api/historico-pontos
     * Adiciona ou remove pontos e atualiza o saldo total do utilizador.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'usuario_id' => 'required|exists:users,id',
            'estabelecimento_id' => 'required|exists:estabelecimentos,id',
            'agendamento_id' => 'nullable|exists:agendamentos,id',
            'tipo' => 'required|in:ganho,uso',
            'descricao' => 'required|string',
            'quantidade' => 'required|integer|min:1',
        ]);

        // DB::transaction garante que ou salva no histórico E no saldo, ou cancela tudo se der erro
        $historico = DB::transaction(function () use ($validated) {
            
            // 1. Cria o registo no histórico
            $registo = HistoricoPonto::create($validated);

            // 2. Procura a carteira de pontos do utilizador neste estabelecimento (se não existir, cria com saldo 0)
            $carteira = PontoUsuarioEstabelecimento::firstOrCreate(
                [
                    'usuario_id' => $validated['usuario_id'],
                    'estabelecimento_id' => $validated['estabelecimento_id']
                ],
                ['total_pontos' => 0]
            );

            // 3. Atualiza o saldo
            if ($validated['tipo'] === 'ganho') {
                $carteira->total_pontos += $validated['quantidade'];
            } else {
                $carteira->total_pontos -= $validated['quantidade'];
            }
            $carteira->save();

            return $registo;
        });

        return response()->json([
            'message' => 'Pontos registados com sucesso!',
            'data' => $historico
        ], 201);
    }

    public function show(string $id)
    {
        return response()->json(HistoricoPonto::findOrFail($id));
    }

    public function update(Request $request, string $id)
    {
        // Em sistemas de fidelidade estritos, o histórico não deve ser editado diretamente.
        return response()->json(['message' => 'A edição de histórico de pontos não é permitida.'], 403);
    }

    public function destroy(string $id)
    {
        // Mesma lógica: o extrato não deve poder ser apagado.
        return response()->json(['message' => 'A exclusão do histórico não é permitida.'], 403);
    }
}