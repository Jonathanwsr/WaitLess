<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Agendamento;
use App\Models\Pagamento;
use App\Models\Aluguel;
use App\Services\PagamentoService; 
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;

class PagamentoController extends Controller
{
    /**
     * 1. CRIAÇÃO DA COBRANÇA (Suporta PIX, BOLETO, CARTÃO e PAGAMENTO NO LOCAL)
     */
    public function processar(Request $request, PagamentoService $pagamentoService)
    {
        $request->validate([
            'agendamento_id'    => 'required|exists:agendamentos,id',
            'asaas_customer_id' => 'required_unless:metodo_pagamento,local|string', 
            'metodo_pagamento'  => 'required|in:pix,boleto,cartao,local', 
            'parcelas'          => 'nullable|integer|min:1|max:12'
        ]);

        $agendamento = Agendamento::with(['servico', 'estabelecimento'])->findOrFail($request->agendamento_id);

        try {
            // =========================================================================
            // 👉 CASO 1: O CLIENTE ESCOLHEU PAGAR PRESENCIALMENTE (NO LOCAL)
            // =========================================================================
            if ($request->metodo_pagamento === 'local') {
                $codigoPin = str_pad(mt_rand(0, 9999), 4, '0', STR_PAD_LEFT);

                $agendamento->update([
                    'status_pagamento'   => 'local', 
                    'status'             => 'confirmado', // Entra na fila para ser atendido
                    'codigo_verificacao' => $codigoPin,
                ]);

                // Dispara e-mails simultâneos via Brevo (Cliente recebe o PIN, Dono recebe o aviso de reserva)
                $pagamentoService->enviarEmailNotificacao($agendamento, 'local');

                return response()->json([
                    'status'  => 'success',
                    'message' => 'Reserva confirmada para pagamento diretamente no estabelecimento!',
                    'metodo'  => 'local'
                ]);
            }

            // =========================================================================
            // 👉 CASO 2: PAGAMENTO ONLINE (PIX, BOLETO OU CARTÃO) VIA SERVICE
            // =========================================================================
            // O Service já cria a cobrança, divide o split (Custódia) e manda o E-mail Pendente
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
                'invoice_url' => $resultadoAsaas['invoice_url'] 
            ]);

        } catch (\Exception $e) {
            Log::error("Erro no método processar do PagamentoController: " . $e->getMessage());
            return response()->json(['error' => 'Erro interno ao processar a cobrança: ' . $e->getMessage()], 500);
        }
    }

    /**
     * 2. WEBHOOK DO ASAAS - Sincronização, Fidelidade e Notificações
     */
    public function webhookAsaas(Request $request, PagamentoService $pagamentoService)
    {
        $authToken = $request->header('asaas-access-token');
        if ($authToken && $authToken !== config('services.asaas.webhook_token')) {
            return response()->json(['error' => 'Não autorizado'], 401);
        }

        $event = $request->input('event');
        $paymentData = $request->input('payment');

        $pagamento = Pagamento::where('id_transacao_gateway', $paymentData['id'])->first();

        if (!$pagamento) {
            return response()->json(['error' => 'Pagamento local não encontrado'], 404);
        }

        try {
            DB::transaction(function () use ($pagamento, $event, $paymentData, $pagamentoService) {
                
                $metodoExtrato = match ($pagamento->metodo_pagamento) {
                    'cartao' => 'cartao_credito',
                    'pix'    => 'pix',
                    'boleto' => 'boleto',
                    default  => 'outro'
                };

                $origemType = $pagamento->agendamento_id ? 'App\Models\Agendamento' : ($pagamento->aluguel_id ? 'App\Models\Aluguel' : null);
                $origemId = $pagamento->agendamento_id ?? $pagamento->aluguel_id;

                switch ($event) {
                    
                    case 'PAYMENT_RECEIVED':
                    case 'PAYMENT_CONFIRMED':
                        if ($pagamento->status !== 'pago') {
                            $pagamento->update([
                                'status' => 'pago',
                                'data_pagamento' => now()
                            ]);

                            $entidadeRelacionada = null;

                            if ($pagamento->agendamento_id) {
                                $entidadeRelacionada = Agendamento::with('servico')->find($pagamento->agendamento_id);
                                if ($entidadeRelacionada) {
                                    $entidadeRelacionada->update([
                                        'status_pagamento' => 'pago_online',
                                        'status' => 'confirmado' 
                                    ]);
                                }
                            } elseif ($pagamento->aluguel_id) {
                                $entidadeRelacionada = Aluguel::find($pagamento->aluguel_id);
                                if ($entidadeRelacionada) {
                                    $entidadeRelacionada->update(['status' => 'pago']);
                                }
                            }

                            // 1. Incrementa o saldo do Provedor (Fica pendente/bloqueado no extrato)
                            $provider = DB::table('providers')
                                ->join('users', 'providers.user_id', '=', 'users.id')
                                ->join('estabelecimento_usuario', 'users.id', '=', 'estabelecimento_usuario.usuario_id')
                                ->where('estabelecimento_usuario.estabelecimento_id', $pagamento->estabelecimento_id)
                                ->select('providers.id')
                                ->first();

                            if ($provider) {
                                DB::table('providers')->where('id', $provider->id)->increment('saldo', $pagamento->valor_liquido);

                                DB::table('extrato_providers')->insert([
                                    'provider_id'      => $provider->id,
                                    'usuario_id'       => $pagamento->usuario_id,
                                    'origem_type'      => $origemType,
                                    'origem_id'        => $origemId,
                                    'tipo'             => 'credito',
                                    'valor_bruto'      => $pagamento->valor,
                                    'taxa_plataforma'  => $pagamento->taxa,
                                    'valor_liquido'    => $pagamento->valor_liquido,
                                    'descricao'        => $pagamento->agendamento_id ? 'Crédito por Serviço (Retido Custódia)' : 'Crédito por Locação (Retido Custódia)',
                                    'status'           => 'pendente', // Retido na API
                                    'codigo_transacao' => $paymentData['id'],
                                    'metodo_pagamento' => $metodoExtrato,
                                    'created_at'       => now()
                                ]);
                            }

                            // 2. Acumula pontos de fidelidade para o cliente
                            $pontosGanhos = floor($pagamento->valor); 
                            if ($pontosGanhos > 0) {
                                DB::table('historico_pontos')->insert([
                                    'usuario_id' => $pagamento->usuario_id,
                                    'estabelecimento_id' => $pagamento->estabelecimento_id,
                                    'agendamento_id' => $pagamento->agendamento_id,
                                    'tipo' => 'ganho',
                                    'descricao' => 'Pontos acumulados em pagamento online',
                                    'quantidade' => $pontosGanhos,
                                    'created_at' => now()
                                ]);

                                $registroPontos = DB::table('pontos_usuario_estabelecimento')
                                    ->where('usuario_id', $pagamento->usuario_id)
                                    ->where('estabelecimento_id', $pagamento->estabelecimento_id);

                                if ($registroPontos->exists()) {
                                    // Se já existe, apenas incrementa somando os pontos
                                    $registroPontos->increment('total_pontos', $pontosGanhos, ['updated_at' => now()]);
                                } else {
                                    // Se é a primeira vez, insere o registro novo
                                    DB::table('pontos_usuario_estabelecimento')->insert([
                                        'usuario_id' => $pagamento->usuario_id,
                                        'estabelecimento_id' => $pagamento->estabelecimento_id,
                                        'total_pontos' => $pontosGanhos, // Valor inicial sem soma
                                        'created_at' => now(),
                                        'updated_at' => now()
                                    ]);
                                }
                            }

                            // 3. Dispara Notificação de Confirmação
                            if ($entidadeRelacionada) {
                                $pagamentoService->enviarEmailNotificacao(
                                    $entidadeRelacionada, 
                                    'pago', 
                                    null, 
                                    $entidadeRelacionada->codigo_verificacao ?? null
                                );
                            }
                        }
                        break;

                    case 'PAYMENT_OVERDUE':
                        $pagamento->update(['status' => 'vencido']);
                        if ($pagamento->agendamento_id) {
                            Agendamento::where('id', $pagamento->agendamento_id)->update(['status' => 'cancelado', 'status_pagamento' => 'cancelado']);
                        } elseif ($pagamento->aluguel_id) {
                            Aluguel::where('id', $pagamento->aluguel_id)->update(['status' => 'cancelado']);
                        }
                        break;

                    case 'PAYMENT_REFUNDED':
                        // O bloco verifica se o status não é estornado para evitar rodar em duplicidade
                        // caso o ClienteAgendamentoController já tenha feito o estorno no banco de dados.
                        if ($pagamento->status !== 'estornado') {
                            $pagamento->update(['status' => 'estornado']);
                            
                            if ($pagamento->agendamento_id) {
                                Agendamento::where('id', $pagamento->agendamento_id)->update(['status' => 'cancelado', 'status_pagamento' => 'estornado']);
                            } elseif ($pagamento->aluguel_id) {
                                Aluguel::where('id', $pagamento->aluguel_id)->update(['status' => 'cancelado']);
                            }

                            // 👉 Retira os pontos ganhos nesta transação
                            $this->reverterPontosDeFidelidadeWebhook($pagamento);

                            $provider = DB::table('providers')
                                ->join('users', 'providers.user_id', '=', 'users.id')
                                ->join('estabelecimento_usuario', 'users.id', '=', 'estabelecimento_usuario.usuario_id')
                                ->where('estabelecimento_usuario.estabelecimento_id', $pagamento->estabelecimento_id)
                                ->select('providers.id')
                                ->first();

                            if ($provider) {
                                DB::table('providers')->where('id', $provider->id)->decrement('saldo', $pagamento->valor_liquido);

                                DB::table('extrato_providers')->insert([
                                    'provider_id'      => $provider->id,
                                    'usuario_id'       => $pagamento->usuario_id,
                                    'origem_type'      => $origemType,
                                    'origem_id'        => $origemId,
                                    'tipo'             => 'estorno',
                                    'valor_bruto'      => $pagamento->valor,
                                    'taxa_plataforma'  => $pagamento->taxa,
                                    'valor_liquido'    => $pagamento->valor_liquido * -1, // Negativo para abater
                                    'descricao'        => 'Estorno de valores processado via Gateway',
                                    'status'           => 'estornado',
                                    'codigo_transacao' => $paymentData['id'],
                                    'metodo_pagamento' => $metodoExtrato,
                                    'created_at'       => now()
                                ]);
                            }
                        }
                        break;
                }
            });

            return response()->json(['status' => 'success'], 200);

        } catch (\Exception $e) {
            Log::error("Erro ao sincronizar webhook de pagamento: " . $e->getMessage());
            return response()->json(['error' => 'Internal Error'], 500);
        }
    }

    /**
     * 👉 FUNÇÃO AUXILIAR: Remove os pontos do usuário no Webhook em caso de reembolso tardio
     */
    private function reverterPontosDeFidelidadeWebhook($pagamento)
    {
        $colunaFiltro = $pagamento->agendamento_id ? 'agendamento_id' : 'aluguel_id';
        $origemId = $pagamento->agendamento_id ?? $pagamento->aluguel_id;

        $pontosGanhosNessaTransacao = DB::table('historico_pontos')
            ->where($colunaFiltro, $origemId)
            ->where('tipo', 'ganho')
            ->sum('quantidade');

        if ($pontosGanhosNessaTransacao > 0) {
            DB::table('pontos_usuario_estabelecimento')
                ->where('usuario_id', $pagamento->usuario_id)
                ->where('estabelecimento_id', $pagamento->estabelecimento_id)
                ->decrement('total_pontos', $pontosGanhosNessaTransacao);

            DB::table('historico_pontos')->insert([
                'usuario_id'         => $pagamento->usuario_id,
                'estabelecimento_id' => $pagamento->estabelecimento_id,
                $colunaFiltro        => $origemId,
                'tipo'               => 'perda',
                'descricao'          => 'Estorno de pontos de fidelidade após cancelamento',
                'quantidade'         => $pontosGanhosNessaTransacao,
                'created_at'         => now()
            ]);
        }
    }
}