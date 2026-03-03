<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;
use App\Models\Assinatura;
use App\Models\User;
use Illuminate\Support\Facades\Mail;
use App\Mail\BemVindoAssinaturaMail;
// Supondo que você crie estes e-mails depois:
// use App\Mail\RenovacaoAssinaturaMail; 
// use App\Mail\CancelamentoAssinaturaMail;

class WebhookController extends Controller
{
    public function mercadopago(Request $request)
    {
        Log::info('🔔 Webhook Mercado Pago Recebido:', $request->all());

        $topic = $request->input('type') ?? $request->input('topic');
        $dataId = $request->input('data.id');

        if (!$dataId) {
            return response()->json(['status' => 'ignorado'], 200);
        }

        try {
            // 1. EVENTO: CRIAÇÃO OU ALTERAÇÃO DE ASSINATURA
            if ($topic === 'subscription_preapproval') {
                $this->processarAssinatura($dataId);
            } 
            // 2. EVENTO: PAGAMENTO MENSAL (RENOVAÇÃO)
            elseif ($topic === 'subscription_authorized_payment') {
                $this->processarPagamentoRecorrente($dataId);
            }
            // 3. EVENTO: PAGAMENTOS AVULSOS (Agendamentos)
            elseif ($topic === 'payment') {
                // Aqui entraria a lógica se você quiser dar baixa automática num agendamento
                // $this->processarPagamentoAvulso($dataId);
            }

            return response()->json(['status' => 'sucesso'], 200);

        } catch (\Exception $e) {
            Log::error('❌ Erro no Webhook MP: ' . $e->getMessage());
            return response()->json(['status' => 'erro'], 500);
        }
    }

    /**
     * Processa o status geral da assinatura (Ativada, Pausada, Cancelada)
     */
    private function processarAssinatura($assinaturaMpId)
    {
        $assinatura = Assinatura::where('gateway_assinatura_id', $assinaturaMpId)->first();

        if (!$assinatura) return;

        // É sempre mais seguro consultar o MP para saber o status real
        $token = env('MERCADOPAGO_ACCESS_TOKEN');
        $response = Http::withToken($token)->get("https://api.mercadopago.com/preapproval/{$assinaturaMpId}");

        if ($response->successful()) {
            $dadosMp = $response->json();
            $statusMp = $dadosMp['status']; // authorized, paused, cancelled
            $user = $assinatura->user;

            // ATIVAÇÃO (A primeira vez)
            if ($statusMp === 'authorized' && $assinatura->status === 'pendente') {
                $assinatura->update([
                    'status' => 'ativa',
                    'data_inicio' => now(),
                    'data_vencimento' => now()->addMonth()
                ]);

                $user->update([
                    'plano_assinatura' => $assinatura->nome_plano,
                    'plano_expira_em' => now()->addMonth()
                ]);

                Mail::to($user->email)->send(new BemVindoAssinaturaMail($user, $assinatura->nome_plano));
                Log::info("✅ Assinatura {$assinatura->id} ATIVADA e E-mail enviado.");
            }
            // CANCELAMENTO
            elseif ($statusMp === 'cancelled' && $assinatura->status === 'ativa') {
                $assinatura->update(['status' => 'cancelada']);
                $user->update(['plano_assinatura' => 'gratuito']);

                // Mail::to($user->email)->send(new CancelamentoAssinaturaMail($user));
                Log::info("💔 Assinatura {$assinatura->id} CANCELADA.");
            }
        }
    }

    /**
     * Processa o pagamento que cai todo o mês para renovar os 30 dias
     */
    private function processarPagamentoRecorrente($paymentId)
    {
        $token = env('MERCADOPAGO_ACCESS_TOKEN');
        $response = Http::withToken($token)->get("https://api.mercadopago.com/preapproval_payment/{$paymentId}");

        if ($response->successful()) {
            $dadosPagamento = $response->json();
            $assinaturaMpId = $dadosPagamento['preapproval_id'];
            $status = $dadosPagamento['status']; // approved

            if ($status === 'approved') {
                $assinatura = Assinatura::where('gateway_assinatura_id', $assinaturaMpId)->first();
                
                if ($assinatura) {
                    // Adiciona mais um mês de validade!
                    $assinatura->update(['data_vencimento' => now()->addMonth()]);
                    $assinatura->user->update(['plano_expira_em' => now()->addMonth()]);

                    // Mail::to($assinatura->user->email)->send(new RenovacaoAssinaturaMail($assinatura->user));
                    Log::info("🔄 Assinatura {$assinatura->id} RENOVADA por mais um mês!");
                }
            }
        }
    }
}