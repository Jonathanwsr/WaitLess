<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Pagamento;
use Illuminate\Http\Request;

class PagamentoController extends Controller
{
    /**
     * GET /api/pagamentos
     * Lista pagamentos. Pode filtrar por estabelecimento ou por cliente.
     */
    public function index(Request $request)
    {
        $query = Pagamento::with(['usuario:id,name', 'agendamento:id,data_agendamento']);

        if ($request->has('estabelecimento_id')) {
            $query->where('estabelecimento_id', $request->estabelecimento_id);
        }

        if ($request->has('usuario_id')) {
            $query->where('usuario_id', $request->usuario_id);
        }

        return response()->json($query->latest()->paginate(20));
    }

    /**
     * POST /api/pagamentos
     * Gera uma nova intenção de pagamento (ex: quando o cliente agenda um serviço pago antecipadamente).
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'estabelecimento_id' => 'required|exists:estabelecimentos,id',
            'agendamento_id' => 'nullable|exists:agendamentos,id',
            'valor' => 'required|numeric|min:0.01',
            'metodo_pagamento' => 'required|string', // pix, cartao, etc
        ]);

        $validated['usuario_id'] = $request->user()->id;
        $validated['status'] = 'pendente';
        
        // Num cenário real, a taxa viria da configuração do Gateway
        $validated['taxa'] = 0; 
        $validated['valor_liquido'] = $validated['valor'] - $validated['taxa'];

        $pagamento = Pagamento::create($validated);

        return response()->json([
            'message' => 'Cobrança gerada com sucesso!',
            'data' => $pagamento
        ], 201);
    }

    /**
     * GET /api/pagamentos/{id}
     */
    public function show(string $id)
    {
        return response()->json(Pagamento::findOrFail($id));
    }

    /**
     * PUT/PATCH /api/pagamentos/{id}
     * Atualiza o estado (Muito usado por Webhooks do Stripe/Asaas para confirmar que o PIX caiu).
     */
    public function update(Request $request, string $id)
    {
        $pagamento = Pagamento::findOrFail($id);

        $validated = $request->validate([
            'status' => 'sometimes|in:pendente,pago,cancelado,estornado',
            'gateway_pagamento' => 'sometimes|string',
            'id_transacao_gateway' => 'sometimes|string',
            'taxa' => 'sometimes|numeric',
        ]);

        // Se o status mudar para pago, regista a data/hora exata do pagamento
        if (isset($validated['status']) && $validated['status'] === 'pago' && $pagamento->status !== 'pago') {
            $validated['data_pagamento'] = now();
        }

        if (isset($validated['taxa'])) {
            $validated['valor_liquido'] = $pagamento->valor - $validated['taxa'];
        }

        $pagamento->update($validated);

        return response()->json([
            'message' => 'Estado do pagamento atualizado.',
            'data' => $pagamento
        ]);
    }

    /**
     * DELETE /api/pagamentos/{id}
     * Não apaga do banco, apenas cancela a cobrança.
     */
    public function destroy(string $id)
    {
        $pagamento = Pagamento::findOrFail($id);
        $pagamento->update(['status' => 'cancelado']);

        return response()->json(['message' => 'Cobrança cancelada.']);
    }
}