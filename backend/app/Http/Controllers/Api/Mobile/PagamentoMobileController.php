<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Agendamento;
use App\Services\PagamentoService;
use Illuminate\Support\Facades\Log;

class PagamentoMobileController extends Controller
{
    /**
     * 👉 ROTA MOBILE: Processa a criação da cobrança e retorna os dados para o Flutter
     */
    public function processar(Request $request, PagamentoService $pagamentoService)
    {
        $request->validate([
            'agendamento_id'    => 'required|exists:agendamentos,id',
            'asaas_customer_id' => 'required_unless:metodo_pagamento,local|string', 
            'metodo_pagamento'  => 'required|in:pix,boleto,cartao,local', 
            'parcelas'          => 'nullable|integer|min:1|max:12'
        ]);

        $agendamento = Agendamento::with(['servico', 'estabelecimento'])->find($request->agendamento_id);

        if (!$agendamento) {
            return response()->json(['error' => 'Agendamento não encontrado.'], 404);
        }

        try {
            // =========================================================================
            // 👉 CASO 1: PAGAMENTO NO LOCAL (O App Flutter mostra a tela de sucesso direto)
            // =========================================================================
            if ($request->metodo_pagamento === 'local') {
                $codigoPin = str_pad(mt_rand(0, 9999), 4, '0', STR_PAD_LEFT);

                $agendamento->update([
                    'status_pagamento'   => 'local', 
                    'status'             => 'confirmado', // Já entra na fila do profissional
                    'codigo_verificacao' => $codigoPin,
                ]);

                // Dispara os e-mails em background
                $pagamentoService->enviarEmailNotificacao($agendamento, 'local');

                return response()->json([
                    'status'  => 'success',
                    'message' => 'Reserva confirmada! Pagamento será feito no local.',
                    'metodo'  => 'local',
                    'pin'     => $codigoPin // Retorna o PIN pro Flutter exibir na tela de sucesso
                ], 200);
            }

            // =========================================================================
            // 👉 CASO 2: PAGAMENTO ONLINE (O App Flutter abre a WebView com a invoice_url)
            // =========================================================================
            $resultadoAsaas = $pagamentoService->criarCobrancaAsaas(
                $agendamento,
                $request->metodo_pagamento,
                $request->asaas_customer_id,
                $request->input('parcelas', 1)
            );

            return response()->json([
                'status'      => 'success',
                'message'     => 'Cobrança gerada com sucesso!',
                'payment_id'  => $resultadoAsaas['payment_id'],
                'pix_qr_code' => $resultadoAsaas['pix_qr_code'], 
                'invoice_url' => $resultadoAsaas['invoice_url'] // Link para o Flutter abrir
            ], 200);

        } catch (\Exception $e) {
            Log::error("Erro no PagamentoMobileController: " . $e->getMessage());
            return response()->json([
                'status'  => 'error',
                'message' => 'Erro interno ao processar a cobrança.',
                'details' => $e->getMessage()
            ], 500);
        }
    }
}