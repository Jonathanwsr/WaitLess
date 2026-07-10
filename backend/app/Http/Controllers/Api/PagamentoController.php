<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Agendamento;
use App\Models\Pagamento;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;

class PagamentoController extends Controller
{
    /**
     * 1. CRIAÇÃO DA COBRANÇA (Suporta PIX, BOLETO e CARTÃO PARCELADO)
     */
    public function processar(Request $request)
    {
        $request->validate([
            'agendamento_id' => 'required|exists:agendamentos,id',
            'asaas_customer_id' => 'required|string',
            'metodo_pagamento' => 'required|in:pix,boleto,cartao',
            'parcelas' => 'nullable|integer|min:1|max:12'
        ]);

        $agendamento = Agendamento::findOrFail($request->agendamento_id);
        $valorTotal = $agendamento->valor_total; 

        // Calcula os valores da Custódia (12% Plataforma / 88% Prestador)
        $taxaPlataforma = $valorTotal * 0.12; 
        $valorPrestador = $valorTotal - $taxaPlataforma; 

        // Mapeia o método enviado pelo seu App para o padrão aceito pelo Asaas
        $billingTypeMap = [
            'pix' => 'PIX',
            'boleto' => 'BOLETO',
            'cartao' => 'CREDIT_CARD'
        ];
        $billingTypeAsaas = $billingTypeMap[$request->metodo_pagamento];

        try {
            // Monta o payload básico para o Asaas
            $payloadAsaas = [
                'customer' => $request->asaas_customer_id, 
                'billingType' => $billingTypeAsaas,
                'dueDate' => date('Y-m-d'),
                'description' => 'Reserva/Serviço #' . $agendamento->id,
            ];

            // Se for cartão e houver solicitação de parcelamento
            if ($request->metodo_pagamento === 'cartao' && $request->input('parcelas', 1) > 1) {
                $payloadAsaas['installmentCount'] = $request->parcelas;
                $payloadAsaas['value'] = $valorTotal; // O Asaas dividirá este valor total pelo número de parcelas
            } else {
                $payloadAsaas['value'] = $valorTotal;
            }

            // Chama a API do Asaas para criar a cobrança (Link de pagamento / Emissão)
            $response = Http::withHeaders([
                'access_token' => env('ASAAS_API_KEY'),
            ])->post(env('ASAAS_URL') . '/payments', $payloadAsaas);

            if ($response->failed()) {
                Log::error("Falha ao gerar cobrança no Asaas", ['response' => $response->json()]);
                return response()->json(['error' => 'Falha ao gerar cobrança no gateway.'], 400);
            }

            $asaasPayment = $response->json();

            // Registra a movimentação financeira inicial na sua nova estrutura de tabela
            $pagamento = Pagamento::create([
                'usuario_id'             => $agendamento->usuario_id ?? Auth::id(), // ID de quem está pagando
                'estabelecimento_id'     => $agendamento->estabelecimento_id,       // ID de quem vai receber
                'agendamento_id'         => $agendamento->id,
                'gateway_pagamento'       => 'Asaas',
                'id_transacao_gateway'   => $asaasPayment['id'], 
                'valor'                  => $valorTotal,
                'taxa'                   => $taxaPlataforma,
                'valor_liquido'          => $valorPrestador,
                'status'                 => 'pendente',
                'metodo_pagamento'       => $request->metodo_pagamento,
                'data_pagamento'         => null,
            ]);

            // Geração antecipada do PIN de Segurança
            $codigoPin = str_pad(mt_rand(0, 9999), 4, '0', STR_PAD_LEFT);

            $agendamento->update([
                'status_pagamento' => 'aguardando_pagamento', 
                'codigo_verificacao' => $codigoPin
            ]);

            return response()->json([
                'status'      => 'success',
                'message'     => 'Cobrança gerada com sucesso!',
                'payment_id'  => $asaasPayment['id'],
                'pix_qr_code' => $asaasPayment['pixQrCode'] ?? null, 
                'invoice_url' => $asaasPayment['invoiceUrl'] // URL para o cliente pagar/digitar o cartão com segurança
            ]);

        } catch (\Exception $e) {
            Log::error("Erro no método processar do PagamentoController: " . $e->getMessage());
            return response()->json([
                'status'  => 'error',
                'message' => 'Erro interno ao processar o pagamento.'
            ], 500);
        }
    }

    /**
     * 2. WEBHOOK DO ASAAS (Captura a confirmação do pagamento e alimenta o SALDO LOCAL)
     */
    public function webhookAsaas(Request $request)
    {
        $authToken = $request->header('asaas-access-token');
        if ($authToken && $authToken !== env('ASAAS_WEBHOOK_TOKEN')) {
            return response()->json(['error' => 'Não autorizado'], 401);
        }

        $event = $request->input('event');
        $paymentData = $request->input('payment');

        Log::info("Webhook Asaas recebido", ['evento' => $event, 'payment_id' => $paymentData['id'] ?? null]);

        // Verifica se o pagamento foi recebido ou confirmado pelo banco do cliente
        if ($event === 'PAYMENT_RECEIVED' || $event === 'PAYMENT_CONFIRMED') {
            
            // Busca o pagamento usando a coluna correta: id_transacao_gateway
            $pagamento = Pagamento::where('id_transacao_gateway', $paymentData['id'])->first();

            if ($pagamento && $pagamento->status !== 'pago') {
                
                // 1. Atualiza a tabela de pagamentos local para 'pago'
                $pagamento->update([
                    'status' => 'pago',
                    'data_pagamento' => now()
                ]);

                // 2. Busca e atualiza o agendamento vinculado
                $agendamento = Agendamento::find($pagamento->agendamento_id);
                if ($agendamento) {
                    $agendamento->update([
                        'status_pagamento' => 'pago',
                        'status' => 'confirmado' 
                    ]);
                }

                // 3. ENTRADA DO DINHEIRO NO BANCO LOCAL (Atualiza a nova coluna 'saldo')
                // Faz a busca do Provedor (Sócio) dono do estabelecimento através da tabela pivô
                $provider = DB::table('providers')
                    ->join('users', 'providers.user_id', '=', 'users.id')
                    ->join('estabelecimento_usuario', 'users.id', '=', 'estabelecimento_usuario.usuario_id')
                    ->where('estabelecimento_usuario.estabelecimento_id', $pagamento->estabelecimento_id)
                    ->where('users.papel', 'socio')
                    ->select('providers.id')
                    ->first();

                if ($provider) {
                    // Soma o valor líquido (já descontando os 12% da plataforma) direto no saldo do prestador
                    DB::table('providers')
                        ->where('id', $provider->id)
                        ->increment('saldo', $pagamento->valor_liquido);
                    
                    Log::info("Saldo local incrementado para o provider ID: {$provider->id}. Valor adicionado: R$ {$pagamento->valor_liquido}");
                }

                return response()->json(['status' => 'success', 'message' => 'Pagamento e saldo local processados.'], 200);
            }
        }

        return response()->json(['status' => 'ignored'], 200);
    }

    /**
     * 3. CONFIRMAÇÃO DO SERVIÇO POR PIN
     */
    public function confirmarServicoPin(Request $request)
    {
        $request->validate([
            'agendamento_id' => 'required|exists:agendamentos,id',
            'codigo_pin' => 'required|string|size:4'
        ]);

        $agendamento = Agendamento::findOrFail($request->agendamento_id);

        if ($agendamento->status_pagamento !== 'pago') {
            return response()->json(['error' => 'Este serviço ainda não consta como pago.'], 400);
        }

        if ($agendamento->status === 'concluido') {
            return response()->json(['error' => 'Este serviço já foi encerrado.'], 400);
        }

        if ($agendamento->codigo_verificacao !== $request->codigo_pin) {
            return response()->json(['error' => 'Código de verificação incorreto.'], 400);
        }

        $agendamento->update([
            'status' => 'concluido',
            'concluido_em' => now()
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Código validado com sucesso! O serviço foi finalizado.'
        ]);
    }
}