<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Agendamento;
use App\Models\Pagamento;
use App\Models\Aluguel;
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
                $payloadAsaas['installmentValue'] = round($valorTotal / $request->parcelas, 2); // Exigência do Asaas
            } else {
                $payloadAsaas['value'] = $valorTotal;
            }

            // Chama a API do Asaas usando a função config() para evitar bugs de cache do .env
            $response = Http::withHeaders([
                'access_token' => config('services.asaas.key'),
            ])->post(config('services.asaas.url') . '/payments', $payloadAsaas);

            if ($response->failed()) {
                Log::error("Falha ao gerar cobrança no Asaas", ['response' => $response->json()]);
                return response()->json(['error' => 'Falha ao gerar cobrança no gateway.'], 400);
            }

            $asaasPayment = $response->json();

            // Registra a movimentação financeira inicial na sua nova estrutura de tabela
            $pagamento = Pagamento::create([
                'usuario_id'             => $agendamento->usuario_id ?? Auth::id(), 
                'estabelecimento_id'     => $agendamento->estabelecimento_id,       
                'agendamento_id'         => $agendamento->id,
                'gateway_pagamento'      => 'Asaas',
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
                'codigo_verificacao' => $codigoPin,
                'pagamento_id' => $pagamento->id // Vincula o id do pagamento
            ]);

            return response()->json([
                'status'      => 'success',
                'message'     => 'Cobrança gerada com sucesso!',
                'payment_id'  => $asaasPayment['id'],
                'pix_qr_code' => $asaasPayment['pixQrCode'] ?? null, 
                'invoice_url' => $asaasPayment['invoiceUrl'] 
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
     * 2. WEBHOOK DO ASAAS (Blindado com Transações, Logs e Atualização de Aluguéis/Agendamentos)
     */
    /**
     * WEBHOOK DO ASAAS - Atualização Automática de Status
     */
    public function webhookAsaas(Request $request)
    {
        // Validação de segurança com o token do config
        $authToken = $request->header('asaas-access-token');
        if ($authToken && $authToken !== config('services.asaas.webhook_token')) {
            return response()->json(['error' => 'Não autorizado'], 401);
        }

        $event = $request->input('event');
        $paymentData = $request->input('payment');

        // Busca o pagamento local usando o ID do Asaas
        $pagamento = Pagamento::where('id_transacao_gateway', $paymentData['id'])->first();

        if (!$pagamento) {
            return response()->json(['error' => 'Pagamento local não encontrado'], 404);
        }

        try {
            DB::transaction(function () use ($pagamento, $event, $paymentData) {
                
                // Mapeia o que fazer de acordo com o evento enviado pelo Asaas
                switch ($event) {
                    
                    // 1. DINHEIRO ENTROU (PIX recebido, Boleto compensado ou Cartão aprovado)
                    case 'PAYMENT_RECEIVED':
                    case 'PAYMENT_CONFIRMED':
                        if ($pagamento->status !== 'pago') {
                            $pagamento->update([
                                'status' => 'pago',
                                'data_pagamento' => now()
                            ]);

                            // Atualiza Agendamento (Serviço)
                            if ($pagamento->agendamento_id) {
                                $agendamento = Agendamento::find($pagamento->agendamento_id);
                                if ($agendamento) {
                                    $agendamento->update([
                                        'status_pagamento' => 'pago_online',
                                        'status' => 'confirmado' 
                                    ]);
                                }
                            } 
                            // Atualiza Aluguel (Reserva)
                            elseif ($pagamento->aluguel_id) {
                                $aluguel = \App\Models\Aluguel::find($pagamento->aluguel_id);
                                if ($aluguel) {
                                    $aluguel->update(['status' => 'pago']);
                                }
                            }

                            // Alimenta o saldo acumulado do Provedor (os 88% do split)
                            $provider = DB::table('providers')
                                ->join('users', 'providers.user_id', '=', 'users.id')
                                ->join('estabelecimento_usuario', 'users.id', '=', 'estabelecimento_usuario.usuario_id')
                                ->where('estabelecimento_usuario.estabelecimento_id', $pagamento->estabelecimento_id)
                                ->select('providers.id')
                                ->first();

                            if ($provider) {
                                DB::table('providers')->where('id', $provider->id)->increment('saldo', $pagamento->valor_liquido);
                            }
                        }
                        break;

                    // 2. CLIENTE COMPROU POR CARTÃO PARCELADO E FOI REPROVADO OU DEU ERRO
                    case 'PAYMENT_DUNNING_RECEIVED':
                    case 'PAYMENT_CHARGEBACK_REQUESTED':
                        $pagamento->update(['status' => 'contestação_erro']);
                        break;

                    // 3. O BOLETO OU PIX VENCEU E O CLIENTE NÃO PAGOU NO PRAZO
                    case 'PAYMENT_OVERDUE':
                        $pagamento->update(['status' => 'vencido']);
                        
                        if ($pagamento->agendamento_id) {
                            Agendamento::where('id', $pagamento->agendamento_id)->update(['status' => 'cancelado', 'status_pagamento' => 'cancelado']);
                        } elseif ($pagamento->aluguel_id) {
                            \App\Models\Aluguel::where('id', $pagamento->aluguel_id)->update(['status' => 'cancelado']);
                        }
                        break;

                    // 4. O PAGAMENTO FOI DEVOLVIDO/REEMBOLSADO (ESTORNADO) VIA PAINEL OU SERVIÇO
                    case 'PAYMENT_REFUNDED':
                        $pagamento->update(['status' => 'estornado']);
                        
                        if ($pagamento->agendamento_id) {
                            Agendamento::where('id', $pagamento->agendamento_id)->update(['status' => 'cancelado', 'status_pagamento' => 'estornado']);
                        } elseif ($pagamento->aluguel_id) {
                            \App\Models\Aluguel::where('id', $pagamento->aluguel_id)->update(['status' => 'cancelado']);
                        }

                        // Se o dinheiro já tinha entrado no saldo do provedor antes, deduz o estorno do saldo dele
                        $provider = DB::table('providers')
                            ->join('users', 'providers.user_id', '=', 'users.id')
                            ->join('estabelecimento_usuario', 'users.id', '=', 'estabelecimento_usuario.usuario_id')
                            ->where('estabelecimento_usuario.estabelecimento_id', $pagamento->estabelecimento_id)
                            ->select('providers.id')
                            ->first();

                        if ($provider) {
                            DB::table('providers')->where('id', $provider->id)->decrement('saldo', $pagamento->valor_liquido);
                        }
                        break;

                    // 5. A COBRANÇA FOI APENAS GERADA (IGUALE AO SEU ERRO ANTERIOR, EVITA TIMEOUT)
                    case 'PAYMENT_CREATED':
                        // Apenas ignora e responde 200 rápido pro Asaas
                        break;
                }
            });

            return response()->json(['status' => 'success', 'message' => 'Status sincronizado com sucesso.'], 200);

        } catch (\Exception $e) {
            Log::error("Erro ao sincronizar webhook de pagamento: " . $e->getMessage());
            return response()->json(['error' => 'Internal Error'], 500);
        }
    }
}