<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Exception;

class MercadoPagoService
{
    
    public function criarCheckout($agendamento, $servico, $taxaPlataforma = 0, $tokenSalao = null)
    {
       
        $tokenToUse = $tokenSalao ? $tokenSalao : env('MERCADOPAGO_ACCESS_TOKEN');
        
        if (!$tokenToUse) {
            throw new Exception('Token do Mercado Pago não configurado.');
        }

        $urlRetorno = route('pagamento.callback');

       
        $payload = [
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
        ];

        
        if ($tokenSalao && $taxaPlataforma > 0) {
            $payload['marketplace_fee'] = (float) $taxaPlataforma;
        }

        $response = Http::withToken($tokenToUse)
            ->withoutVerifying()
            ->post('https://api.mercadopago.com/checkout/preferences', $payload);

        if ($response->failed()) {
            throw new Exception('Erro ao criar checkout no MP: ' . $response->body());
        }

        return $response->json();
    }

    
    public function estornarPagamento($paymentId, $tokenSalao = null)
    {
        $tokenToUse = $tokenSalao ? $tokenSalao : env('MERCADOPAGO_ACCESS_TOKEN');

        $response = Http::withToken($tokenToUse)
            ->withoutVerifying()
            ->post("https://api.mercadopago.com/v1/payments/{$paymentId}/refunds");

        if ($response->failed()) {
            throw new Exception('Erro ao tentar estornar: ' . $response->body());
        }

        return $response->json();
    }

    
}