<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Agendamento;
use App\Models\Pagamento;
use App\Models\Aluguel;
use App\Models\Assinatura;
use App\Models\PedidoEntrega;
use App\Services\PagamentoService;
use App\Services\PlanoService;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Mail;
use App\Events\FilaAtualizada;

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

        $agendamento = Agendamento::with(['servico', 'estabelecimento'])->find($request->agendamento_id);

        // Sem isso, qualquer usuário autenticado podia informar o agendamento_id de
        // OUTRA pessoa e confirmar/pagar em nome dela (o equivalente mobile deste
        // mesmo endpoint já tinha essa checagem — aqui na web estava faltando).
        if (!$agendamento || $agendamento->usuario_id !== $request->user()->id) {
            return response()->json(['error' => 'Não foi possível localizar este pedido.'], 404);
        }

        if (in_array($agendamento->status_pagamento, ['pago', 'pago_online', 'local', 'presencial'], true)) {
            return response()->json(['error' => 'Este pedido já está pago, não é possível pagar novamente.'], 409);
        }

        try {
            // =========================================================================
            // 👉 CASO 1: O CLIENTE ESCOLHEU PAGAR PRESENCIALMENTE (NO LOCAL)
            // =========================================================================
            if ($request->metodo_pagamento === 'local') {
                
                // Chama o service que gera o PIN, envia e-mail e CALCULA A TAXA DA PLATAFORMA (se não for premium)
                $pagamentoService->processarPagamentoLocal($agendamento);

                // Assegura que o status geral do agendamento fique como 'confirmado' para entrar na fila
                $agendamento->update([
                    'status' => 'confirmado'
                ]);

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
            return response()->json(['error' => 'Não foi possível gerar a cobrança agora. Tente novamente em instantes.'], 500);
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

        // Eventos de nota fiscal (INVOICE_*): atualizam status, número, PDF e XML da nota.
        if (is_array($request->input('invoice')) && str_starts_with((string) $event, 'INVOICE_')) {
            app(\App\Services\NotaFiscalService::class)->atualizarPeloAsaas($request->input('invoice'));

            return response()->json(['message' => 'Nota fiscal atualizada.'], 200);
        }

        // 👉 CORREÇÃO AQUI: Verifica se o payload realmente tem os dados de 'payment'.
        // Webhooks de assinaturas (como SUBSCRIPTION_CREATED) vêm com 'subscription' em vez de 'payment'.
        // Retornar 200 limpa o erro no Asaas e faz ele parar de tentar reenviar esse payload.
        if (!$paymentData || !isset($paymentData['id'])) {
            return response()->json(['message' => 'Evento ignorado neste controller. Não possui array payment válido.'], 200);
        }

        $pagamento = Pagamento::where('id_transacao_gateway', $paymentData['id'])->first();

        // Não achar o pagamento localmente não é erro do nosso lado (pode ser
        // webhook de teste do Asaas, ou cobrança de outro ambiente). Devolver
        // 4xx/5xx aqui faz o Asaas ficar reenviando e penalizando o endpoint
        // até desativar o webhook — então só logamos e confirmamos o recebimento.
        if (!$pagamento) {
            // Cobranças de ASSINATURA (recorrente) nunca criam uma linha em
            // "pagamentos" — esse pagamento é gerado pelo próprio Asaas a
            // partir da subscription, não por criarCobrancaAsaas(). Sem este
            // bloco, nenhuma assinatura era ativada/renovada sozinha: o plano
            // premium só virava realidade se um admin clicasse manualmente em
            // "Marcar como pago" no painel — então nenhum assinante pagante de
            // verdade recebia o plano, os pontos ou qualquer benefício.
            // Parcela de cobrança parcelada (criada por sócio): não tem linha em "pagamentos".
            if (app(\App\Services\CobrancaParceladaService::class)->aplicarEventoAsaas($event, (string) $paymentData['id'], $paymentData['paymentDate'] ?? null)) {
                return response()->json(['message' => 'Parcela de cobrança atualizada.'], 200);
            }

            if (!empty($paymentData['subscription'])) {
                $this->processarPagamentoAssinatura($event, $paymentData);
            } else {
                Log::warning("Webhook Asaas: pagamento local não encontrado para id_transacao_gateway={$paymentData['id']}");
            }
            return response()->json(['message' => 'Pagamento local não encontrado, evento ignorado.'], 200);
        }

        try {
            DB::transaction(function () use ($pagamento, $event, $paymentData, $pagamentoService) {
                
                $metodoExtrato = match ($pagamento->metodo_pagamento) {
                    'cartao' => 'cartao_credito',
                    'pix'    => 'pix',
                    'boleto' => 'boleto',
                    default  => 'outro'
                };

                $origemType = $pagamento->agendamento_id
                    ? 'App\Models\Agendamento'
                    : ($pagamento->aluguel_id ? 'App\Models\Aluguel' : ($pagamento->pedido_entrega_id ? 'App\Models\PedidoEntrega' : null));
                $origemId = $pagamento->agendamento_id ?? $pagamento->aluguel_id ?? $pagamento->pedido_entrega_id;

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
                                    $entidadeRelacionada->update(['status' => 'confirmado']);
                                }
                            } elseif ($pagamento->pedido_entrega_id) {
                                // PIX/boleto de um pedido de entrega só confirma aqui — o
                                // pagamento com cartão já marca "pago" na hora, sem depender do webhook.
                                PedidoEntrega::where('id', $pagamento->pedido_entrega_id)->update(['status' => 'pago']);
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

                            // 2. Acumula pontos de fidelidade para o cliente — só quando o
                            // pagamento está ligado a um Estabelecimento de verdade (locação/produto
                            // avulso não tem um "estabelecimento_id" pra acumular pontos contra, e
                            // pontos_usuario_estabelecimento.estabelecimento_id é NOT NULL).
                            $pontosGanhos = $pagamento->estabelecimento_id ? floor($pagamento->valor) : 0;
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

                            // 4. Notas fiscais: comissão da Lokyva para o sócio e, no Sócio Premium, a venda para o cliente.
                            // Nunca deve derrubar a confirmação de pagamento: qualquer falha fica
                            // registrada na própria nota fiscal, não propaga exceção pro webhook.
                            try {
                                app(\App\Services\NotaFiscalService::class)->emitirParaPagamento($pagamento);
                            } catch (\Throwable $e) {
                                Log::error('Falha ao acionar emissão de nota fiscal: ' . $e->getMessage());
                            }
                        }
                        break;

                    case 'PAYMENT_OVERDUE':
                        // A coluna pagamentos.status só aceita pendente/pago/cancelado/estornado
                        // (CHECK constraint) — 'vencido' não é um valor válido e derrubava esta
                        // atualização com erro de banco, o que cancelava a transação inteira: o
                        // agendamento NUNCA chegava a ser cancelado quando o PIX/boleto vencia.
                        $pagamento->update(['status' => 'cancelado']);
                        if ($pagamento->agendamento_id) {
                            Agendamento::where('id', $pagamento->agendamento_id)->update(['status' => 'cancelado', 'status_pagamento' => 'cancelado']);
                            
                            // 👉 DEVOLVE O ESTOQUE DOS PRODUTOS CASO O CLIENTE NÃO PAGUE O BOLETO/PIX
                            $itens = DB::table('itens_aluguel')->where('agendamento_id', $pagamento->agendamento_id)->get();
                            foreach($itens as $item) {
                                if (isset($item->produto_id) && $item->produto_id) {
                                    DB::table('produtos')->where('id', $item->produto_id)->increment('estoque_disponivel', $item->quantidade);
                                    if (\Illuminate\Support\Facades\Schema::hasColumn('produtos', 'quantidade_vendida')) {
                                        DB::table('produtos')->where('id', $item->produto_id)->decrement('quantidade_vendida', $item->quantidade);
                                    }
                                }
                            }

                        } elseif ($pagamento->aluguel_id) {
                            Aluguel::where('id', $pagamento->aluguel_id)->update(['status' => 'cancelado']);
                        } elseif ($pagamento->pedido_entrega_id) {
                            $pedidoVencido = PedidoEntrega::find($pagamento->pedido_entrega_id);
                            if ($pedidoVencido) {
                                $pedidoVencido->update(['status' => 'cancelado', 'data_cancelamento' => now()]);
                                DB::table('produtos_entrega')->where('id', $pedidoVencido->produto_entrega_id)
                                    ->increment('estoque_disponivel', $pedidoVencido->quantidade);
                            }
                        }
                        break;

                    case 'PAYMENT_REFUNDED':
                        // O bloco verifica se o status não é estornado para evitar rodar em duplicidade
                        if ($pagamento->status !== 'estornado') {
                            $pagamento->update(['status' => 'estornado']);
                            
                            if ($pagamento->agendamento_id) {
                                Agendamento::where('id', $pagamento->agendamento_id)->update(['status' => 'cancelado', 'status_pagamento' => 'estornado']);
                                
                                // 👉 DEVOLVE O ESTOQUE DOS PRODUTOS QUANDO HÁ ESTORNO (REFUND)
                                $itens = DB::table('itens_aluguel')->where('agendamento_id', $pagamento->agendamento_id)->get();
                                foreach($itens as $item) {
                                    if (isset($item->produto_id) && $item->produto_id) {
                                        DB::table('produtos')->where('id', $item->produto_id)->increment('estoque_disponivel', $item->quantidade);
                                        if (\Illuminate\Support\Facades\Schema::hasColumn('produtos', 'quantidade_vendida')) {
                                            DB::table('produtos')->where('id', $item->produto_id)->decrement('quantidade_vendida', $item->quantidade);
                                        }
                                    }
                                }

                            } elseif ($pagamento->aluguel_id) {
                                Aluguel::where('id', $pagamento->aluguel_id)->update(['status' => 'cancelado']);
                            } elseif ($pagamento->pedido_entrega_id) {
                                $pedidoEstornado = PedidoEntrega::find($pagamento->pedido_entrega_id);
                                if ($pedidoEstornado) {
                                    $pedidoEstornado->update(['status' => 'estornado']);
                                    DB::table('produtos_entrega')->where('id', $pedidoEstornado->produto_entrega_id)
                                        ->increment('estoque_disponivel', $pedidoEstornado->quantidade);
                                }
                            }

                            // 👉 Retira os pontos ganhos nesta transação
                            $this->reverterPontosDeFidelidadeWebhook($pagamento);

                            // Venda desfeita: cancela as notas da venda e da comissão Lokyva.
                            try {
                                app(\App\Services\NotaFiscalService::class)->cancelarNotasDoPagamento($pagamento);
                            } catch (\Throwable $e) {
                                Log::error('Falha ao cancelar notas fiscais do estorno: ' . $e->getMessage());
                            }

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

            // Avisa em tempo real (web + mobile) que o status de pagamento mudou —
            // sem isso, quem está esperando confirmação de PIX/boleto só veria a
            // atualização ao atualizar a página manualmente. Nunca pode derrubar
            // o webhook: se o broadcast falhar (ex.: Reverb fora do ar), o status
            // no banco já está correto de qualquer forma.
            if (in_array($event, ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED', 'PAYMENT_OVERDUE', 'PAYMENT_REFUNDED'], true)) {
                try {
                    event(new FilaAtualizada($pagamento->estabelecimento_id));
                } catch (\Throwable $e) {
                    Log::warning('Falha ao notificar mudança de status de pagamento em tempo real: ' . $e->getMessage());
                }
            }

            return response()->json(['status' => 'success'], 200);

        } catch (\Exception $e) {
            Log::error("Erro ao sincronizar webhook de pagamento: " . $e->getMessage());
            return response()->json(['error' => 'Internal Error'], 500);
        }
    }

    /**
     * 👉 ATIVAÇÃO/RENOVAÇÃO AUTOMÁTICA DE ASSINATURA (plano premium)
     *
     * O Asaas gera esse "payment" sozinho a partir da subscription (trial de
     * 7 dias vencendo, ou renovação mensal/anual) — não existe uma linha em
     * "pagamentos" pra ele, então o fluxo normal do webhook nunca encontrava
     * nada e o assinante ficava parado no plano "pendente" pra sempre, a
     * menos que um admin entrasse no painel e marcasse manualmente como pago.
     */
    private function processarPagamentoAssinatura(string $event, array $paymentData): void
    {
        if (!in_array($event, ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'], true)) {
            return;
        }

        $assinatura = Assinatura::where('gateway_assinatura_id', $paymentData['subscription'])->first();
        if (!$assinatura) {
            Log::warning("Webhook Asaas: assinatura não encontrada para subscription={$paymentData['subscription']}");
            return;
        }

        try {
            DB::transaction(function () use ($assinatura, $paymentData) {
                // Trava a linha e confere de novo lá dentro — o Asaas costuma
                // mandar PAYMENT_RECEIVED e PAYMENT_CONFIRMED pro mesmo
                // pagamento, e sem isso os pontos e o próximo vencimento
                // seriam concedidos duas vezes pro mesmo ciclo.
                $assinaturaTravada = Assinatura::whereKey($assinatura->id)->lockForUpdate()->first();
                if (!$assinaturaTravada || $assinaturaTravada->fatura_id === $paymentData['id']) {
                    return;
                }

                $user = $assinaturaTravada->user;
                if (!$user) {
                    return;
                }

                $isAnual = str_contains($assinaturaTravada->nome_plano, 'anual');
                $proximoVencimento = $isAnual ? now()->addYear() : now()->addMonth();

                $assinaturaTravada->update([
                    'status' => 'ativa',
                    'data_inicio' => $assinaturaTravada->data_inicio ?? now(),
                    'data_vencimento' => $proximoVencimento,
                    'fatura_id' => $paymentData['id'],
                ]);

                $user->update([
                    'plano_assinatura' => $assinaturaTravada->nome_plano,
                    'plano_expira_em' => $proximoVencimento,
                    'asaas_subscription_status' => 'ACTIVE',
                    'asaas_subscription_id' => $assinaturaTravada->gateway_assinatura_id,
                ]);

                app(PlanoService::class)->distribuirPontosAssinatura($user, $assinaturaTravada->nome_plano);

                try {
                    Mail::to($user->email)->queue(new \App\Mail\BemVindoAssinaturaMail($user, $assinaturaTravada->nome_plano));
                } catch (\Throwable $e) {
                    Log::error('Erro ao enviar e-mail de boas-vindas da assinatura: ' . $e->getMessage());
                }

                Log::info("✅ Assinatura {$assinaturaTravada->id} ativada/renovada via webhook Asaas (plano {$assinaturaTravada->nome_plano}).");
            });
        } catch (\Throwable $e) {
            Log::error('Erro ao processar pagamento de assinatura no webhook: ' . $e->getMessage());
            return;
        }

        // Nota fiscal da própria plataforma pro assinante — nunca deve
        // impedir a ativação do plano, que já foi concluída acima.
        try {
            $assinaturaAtualizada = $assinatura->fresh();
            if ($assinaturaAtualizada && $assinaturaAtualizada->user) {
                app(\App\Services\NotaFiscalService::class)->emitirParaAssinatura($assinaturaAtualizada, $assinaturaAtualizada->user);
            }
        } catch (\Throwable $e) {
            Log::error('Falha ao acionar emissão de nota fiscal da assinatura: ' . $e->getMessage());
        }
    }

    /**
     * 👉 FUNÇÃO AUXILIAR: Remove os pontos do usuário no Webhook em caso de reembolso tardio
     */
    private function reverterPontosDeFidelidadeWebhook($pagamento)
    {
        // historico_pontos só se liga a agendamentos (não tem coluna aluguel_id): consultar outra
        // coluna derrubava o estorno inteiro de locações e pedidos de entrega com erro de banco.
        if (!$pagamento->agendamento_id) {
            return;
        }
        $colunaFiltro = 'agendamento_id';
        $origemId = $pagamento->agendamento_id;

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
                // historico_pontos.tipo só aceita 'ganho'/'uso' (CHECK constraint) —
                // 'perda' não existe e derrubava todo o estorno com erro de banco.
                'tipo'               => 'uso',
                'descricao'          => 'Estorno de pontos de fidelidade após cancelamento',
                'quantidade'         => $pontosGanhosNessaTransacao,
                'created_at'         => now()
            ]);
        }
    }
}