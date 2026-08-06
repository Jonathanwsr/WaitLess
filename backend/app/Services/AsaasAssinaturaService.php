<?php

namespace App\Services;

use App\Models\Assinatura;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Exception;

class AsaasAssinaturaService
{
    private $url;
    private $key;

    public function __construct()
    {
        $this->url = config('services.asaas.url');
        $this->key = config('services.asaas.key');
    }

    /**
     * Cria a cobrança no Asaas (Assinatura Recorrente ou Avulsa)
     */
    public function criarCobranca(Assinatura $assinatura, User $user, array $planoData, string $metodo)
    {
        $billingType = $metodo === 'pix' ? 'PIX' : 'CREDIT_CARD';
        
        $payload = [
            'customer' => $user->asaas_customer_id,
            'billingType' => $billingType,
            'value' => $planoData['valor'],
        ];

        // Se for anual ou mensal, cria uma "Subscription"
        if ($planoData['ciclo'] !== 'avulso') {
            $payload['cycle'] = $planoData['ciclo'] === 'anual' ? 'YEARLY' : 'MONTHLY';
            $payload['nextDueDate'] = now()->format('Y-m-d');
            $endpoint = '/subscriptions';
        } else {
            // Se for "Flex de 1 mês" operando como operadora (pré-pago avulso)
            $payload['dueDate'] = now()->format('Y-m-d');
            $endpoint = '/payments';
        }

        $response = Http::withHeaders([
            'access_token' => $this->key,
        ])->post($this->url . $endpoint, $payload);

        if ($response->failed()) {
            throw new Exception("Falha no gateway: " . ($response->json('errors')[0]['description'] ?? 'Erro desconhecido.'));
        }

        return $response->json();
    }

    /**
     * Cancela a assinatura direto no Asaas
     */
    public function cancelarNoGateway(string $gatewayId)
    {
        $response = Http::withHeaders([
            'access_token' => $this->key,
        ])->delete("{$this->url}/subscriptions/{$gatewayId}");

        if ($response->failed()) throw new Exception("Falha ao cancelar no Asaas.");
        return true;
    }
}