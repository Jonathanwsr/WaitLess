<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ContaPagamentoEstabelecimento;
use Illuminate\Http\Request;

class ContaPagamentoEstabelecimentoController extends Controller
{
    /**
     * Confere se o usuário logado de fato administra o estabelecimento
     * informado. Sem isso, qualquer conta autenticada (inclusive cliente)
     * podia criar/editar/desativar a conta bancária/PIX de recebimento de
     * QUALQUER estabelecimento — bastava adivinhar o id.
     */
    private function garantirQueGerencia(Request $request, int $estabelecimentoId): void
    {
        $gerencia = $request->user()->estabelecimentos()
            ->where('estabelecimentos.id', $estabelecimentoId)
            ->exists();

        abort_unless($gerencia, 403, 'Você não tem permissão para gerenciar os dados bancários deste estabelecimento.');
    }

    public function index(Request $request)
    {
        $query = ContaPagamentoEstabelecimento::where('ativo', true);

        if ($request->has('estabelecimento_id')) {
            $this->garantirQueGerencia($request, (int) $request->estabelecimento_id);
            $query->where('estabelecimento_id', $request->estabelecimento_id);
        } else {
            // Sem filtro explícito, só devolve as contas dos estabelecimentos que o usuário gerencia.
            $meusIds = $request->user()->estabelecimentos()->pluck('estabelecimentos.id');
            $query->whereIn('estabelecimento_id', $meusIds);
        }

        return response()->json($query->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'estabelecimento_id' => 'required|exists:estabelecimentos,id',
            'gateway' => 'required|string|max:100', // ex: asaas, stripe, mercadopago, pix_direto
            'id_conta_gateway' => 'nullable|string|max:255',
            'chave_pix' => 'nullable|string|max:255',
            'ativo' => 'boolean'
        ]);

        $this->garantirQueGerencia($request, (int) $validated['estabelecimento_id']);

        $conta = ContaPagamentoEstabelecimento::create($validated);

        return response()->json(['message' => 'Configuração de pagamento salva!', 'data' => $conta], 201);
    }

    public function show(Request $request, string $id)
    {
        $conta = ContaPagamentoEstabelecimento::findOrFail($id);
        $this->garantirQueGerencia($request, (int) $conta->estabelecimento_id);

        return response()->json($conta);
    }

    public function update(Request $request, string $id)
    {
        $conta = ContaPagamentoEstabelecimento::findOrFail($id);
        $this->garantirQueGerencia($request, (int) $conta->estabelecimento_id);

        $validated = $request->validate([
            'gateway' => 'sometimes|string|max:100',
            'id_conta_gateway' => 'sometimes|nullable|string|max:255',
            'chave_pix' => 'sometimes|nullable|string|max:255',
            'ativo' => 'sometimes|boolean'
        ]);

        $conta->update($validated);

        return response()->json(['message' => 'Configuração bancária atualizada!', 'data' => $conta]);
    }

    public function destroy(Request $request, string $id)
    {
        $conta = ContaPagamentoEstabelecimento::findOrFail($id);
        $this->garantirQueGerencia($request, (int) $conta->estabelecimento_id);

        $conta->update(['ativo' => false]);

        return response()->json(['message' => 'Conta bancária desativada.']);
    }
}
