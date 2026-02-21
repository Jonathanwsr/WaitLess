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

        // 1. Pegamos as rotas originais geradas pelo Laravel
        $urlSucesso = route('pagamento.sucesso', $agendamento->id);
        $urlFalha = route('pagamento.falha', $agendamento->id);

        // 2. O GRANDE TRUQUE: Trocamos '127.0.0.1' por 'localhost'
        // Isso impede que o Mercado Pago bloqueie o retorno automático no seu computador!
        $urlSucesso = str_replace('127.0.0.1', 'localhost', $urlSucesso);
        $urlFalha = str_replace('127.0.0.1', 'localhost', $urlFalha);

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
                    'success' => $urlSucesso,
                    'failure' => $urlFalha,
                    'pending' => $urlSucesso,
                ],
                // retorno automático para a URL de sucesso, sem necessidade de ação do usuário
               
                'auto_return' => 'approved',
                
                'external_reference' => (string) $agendamento->id, 
            ]);

        if ($response->failed()) {
            throw new Exception('Erro ao comunicar com o Mercado Pago. Detalhes: ' . $response->body());
        }

        return $response->json();
    }
}