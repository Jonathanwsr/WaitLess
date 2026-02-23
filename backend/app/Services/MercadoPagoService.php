<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Exception;

class MercadoPagoService
{
    /**
     * Gera o link de pagamento (Preference) no Mercado Pago.
     */
    public function criarCheckout($agendamento, $servico)
    {
        $token = env('MERCADOPAGO_ACCESS_TOKEN');
        
        if (!$token) {
            throw new Exception('Token do Mercado Pago não configurado no .env');
        }

      
        $urlRetorno = route('pagamento.callback');

        $response = Http::withToken($token)
            ->withoutVerifying()
            ->post('https://api.mercadopago.com/checkout/preferences', [
                'items' => [
                    [
                        'id' => (string) $servico->id,
                        'title' => 'Serviço: ' . $servico->nome,
                        'quantity' => 1,
                        'unit_price' => (float) $servico->valor,
                        'currency_id' => 'BRL'
                    ]
                ],
                'back_urls' => [
                    'success' => $urlRetorno, 
                    'failure' => $urlRetorno, 
                    'pending' => $urlRetorno, 
                ],

                'auto_return' => 'approved',
                
               
                'external_reference' => (string) $agendamento->id, 
            ]);

        if ($response->failed()) {
            throw new Exception('Erro ao comunicar com o Mercado Pago. Detalhes: ' . $response->body());
        }

        return $response->json();
    }
}