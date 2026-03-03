<?php

namespace App\Services;

use App\Models\User;
use App\Models\Assinatura;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class MercadoPagoAssinaturaService
{
    public function criarLinkAssinatura(Assinatura $assinatura, User $user)
    {
        $token = env('MERCADOPAGO_ACCESS_TOKEN');

        $response = Http::withToken($token)->post('https://api.mercadopago.com/preapproval', [
            'reason' => 'WaitLess - Plano ' . ucfirst($assinatura->nome_plano),
            'auto_recurring' => [
                'frequency' => 1,
                'frequency_type' => 'months',
                'transaction_amount' => (float) $assinatura->valor_mensal,
                'currency_id' => 'BRL'
            ],
            'back_url' => route('dashboard'), 
            'payer_email' => $user->email,
            'external_reference' => (string) $assinatura->id
        ]);

        if ($response->successful()) {
            $dados = $response->json();
            $assinatura->update(['gateway_assinatura_id' => $dados['id']]);
            return $dados['init_point']; 
        }

        Log::error('Erro ao criar assinatura MP: ' . $response->body());
        throw new \Exception('Não foi possível gerar o link de pagamento. Tente novamente.');
    }

    // 👉 NOVA FUNÇÃO: Cancela a cobrança automática no Mercado Pago
    public function cancelarAssinaturaNoMP($assinaturaIdMP)
    {
        $token = env('MERCADOPAGO_ACCESS_TOKEN');

        $response = Http::withToken($token)->put("https://api.mercadopago.com/preapproval/{$assinaturaIdMP}", [
            'status' => 'cancelled'
        ]);

        if (!$response->successful()) {
            Log::error('Erro ao cancelar assinatura MP: ' . $response->body());
            throw new \Exception('Não foi possível cancelar a assinatura no Mercado Pago.');
        }

        return true;
    }
}