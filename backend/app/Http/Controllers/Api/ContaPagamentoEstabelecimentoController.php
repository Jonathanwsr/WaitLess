<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ContaPagamentoEstabelecimento;
use Illuminate\Http\Request;

class ContaPagamentoEstabelecimentoController extends Controller
{
    public function index(Request $request)
    {
        $query = ContaPagamentoEstabelecimento::where('ativo', true);

        if ($request->has('estabelecimento_id')) {
            $query->where('estabelecimento_id', $request->estabelecimento_id);
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

        $conta = ContaPagamentoEstabelecimento::create($validated);

        return response()->json(['message' => 'Configuração de pagamento salva!', 'data' => $conta], 201);
    }

    public function show(string $id)
    {
        return response()->json(ContaPagamentoEstabelecimento::findOrFail($id));
    }

    public function update(Request $request, string $id)
    {
        $conta = ContaPagamentoEstabelecimento::findOrFail($id);

        $validated = $request->validate([
            'gateway' => 'sometimes|string|max:100',
            'id_conta_gateway' => 'sometimes|nullable|string|max:255',
            'chave_pix' => 'sometimes|nullable|string|max:255',
            'ativo' => 'sometimes|boolean'
        ]);

        $conta->update($validated);

        return response()->json(['message' => 'Configuração bancária atualizada!', 'data' => $conta]);
    }

    public function destroy(string $id)
    {
        $conta = ContaPagamentoEstabelecimento::findOrFail($id);
        $conta->update(['ativo' => false]); 

        return response()->json(['message' => 'Conta bancária desativada.']);
    }
}
