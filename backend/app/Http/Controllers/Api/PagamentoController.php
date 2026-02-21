<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
// Removemos as chamadas diretas ao MercadoPagoConfig e PaymentClient para evitar o erro 500
use App\Models\Agendamento;
use App\Models\Pagamento;
use App\Services\MercadoPagoService;

class PagamentoController extends Controller
{
    protected $mpService;

    // Injetamos o Service que você criou
    public function __construct(MercadoPagoService $mpService)
    {
        $this->mpService = $mpService;
    }

    public function processar(Request $request)
    {
        // 1. Busca o agendamento no banco
        $agendamento = Agendamento::findOrFail($request->agendamento_id);

        try {
            // 2. Chamamos o Service para processar o pagamento via API (Sem depender da SDK travada)
            // Passamos todos os dados (token, valor, payer) para o Service
            $payment = $this->mpService->processarPagamentoBrick($request->all(), $agendamento);

            // 3. Salva o resultado no seu banco de dados (Mantendo sua lógica original)
            Pagamento::create([
                'agendamento_id' => $agendamento->id,
                'transacao_id'   => $payment->id,
                'metodo'         => $request->payment_method_id,
                'status'         => $payment->status, 
                'valor'          => $payment->transaction_amount
            ]);

            // VARIÁVEL PARA ARMAZENAR O PIN
            $codigoPin = null;

            // 4. Atualiza o status do agendamento se for aprovado (Mantendo sua lógica original)
            if ($payment->status === 'approved') {
                // GERAÇÃO DO PIN DE 4 DÍGITOS
                $codigoPin = str_pad(mt_rand(0, 9999), 4, '0', STR_PAD_LEFT);

                $agendamento->update([
                    'status_pagamento' => 'pago',
                    'status' => 'pendente',
                    'codigo_verificacao' => $codigoPin
                ]);
            }

            return response()->json([
                'status'   => $payment->status,
                'message'  => 'Pagamento processado com sucesso!',
                'id'       => $payment->id,
                'codigo_pin' => $codigoPin 
            ]);

        } catch (\Exception $e) {
            // Caso o Service retorne erro (ex: token inválido ou cartão recusado)
            return response()->json([
                'status'  => 'error',
                'message' => 'Erro ao processar pagamento: ' . $e->getMessage()
            ], 400);
        }
    }
}