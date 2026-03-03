<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use App\Models\Assinatura;
use App\Models\User;

class MercadoPagoAssinaturaService
{
   
    public function criarLinkAssinatura(Assinatura $assinatura, User $user)
    {
        $token = env('MERCADOPAGO_ACCESS_TOKEN');

        if (!$token) {
            Log::error('MERCADOPAGO_ACCESS_TOKEN não está definido no .env');
            throw new \Exception("Erro de configuração do Mercado Pago. Contate o suporte.");
        }

      
        $payload = [
            'reason' => 'Plano WaitLess ' . ucfirst($assinatura->nome_plano),
            'auto_recurring' => [
                'frequency' => 1,
                'frequency_type' => 'months',
                'transaction_amount' => (float) $assinatura->valor_mensal,
                'currency_id' => 'BRL',
            ],
            'payer_email' => $user->email,
            
          
            'back_url' => route('cliente.carteira'),
            
            'status' => 'pending',
        ];

       
        $response = Http::withToken($token)
            ->post('https://api.mercadopago.com/preapproval', $payload);

      
        if ($response->successful()) {
            $data = $response->json();
            
          
            $assinatura->update([
                'gateway_assinatura_id' => $data['id']
            ]);

        
            return $data['init_point'];
        }

      
        Log::error(' Erro ao criar assinatura no Mercado Pago', [
            'status' => $response->status(),
            'body' => $response->json()
        ]);

        throw new \Exception('Não foi possível gerar o link de pagamento. Tente novamente mais tarde.');
    }
}