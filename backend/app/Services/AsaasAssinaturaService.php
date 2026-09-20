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
        // Converte o método recebido do frontend para o padrão da API do Asaas (apenas PIX ou Cartão de Crédito)
        $billingType = match ($metodo) {
            'pix'         => 'PIX',
            'credit_card' => 'CREDIT_CARD',
            default       => 'PIX'
        };
        
        $payload = [
            'customer'    => $user->asaas_customer_id,
            'billingType' => $billingType,
            'value'       => $planoData['valor'],
            'description' => "Assinatura Lokyva: Plano " . strtoupper($planoData['nome'])
        ];

        // Se for anual ou mensal, cria uma "Subscription"
        if ($planoData['ciclo'] !== 'avulso') {
            // Identifica se o ciclo é Anual (YEARLY) ou Mensal (MONTHLY)
            $payload['cycle'] = $planoData['ciclo'] === 'anual' ? 'YEARLY' : 'MONTHLY';
            
            // Define o início da cobrança dinamicamente (7 dias de trial ou agendamento de mudança de plano)
            $payload['nextDueDate'] = $planoData['data_cobranca']->format('Y-m-d');
            $endpoint = '/subscriptions';
        } else {
            // Se for pré-pago avulso
            $payload['dueDate'] = $planoData['data_cobranca']->format('Y-m-d');
            $endpoint = '/payments';
        }

        $response = Http::withHeaders([
            'access_token' => $this->key,
        ])->post($this->url . $endpoint, $payload);

        if ($response->failed()) {
            $erroAsaas = $response->json('errors')[0]['description'] ?? 'Erro de comunicação desconhecido com o Asaas.';
            throw new Exception("Falha no gateway Asaas: " . $erroAsaas);
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

        if ($response->failed()) {
            throw new Exception("Falha ao tentar cancelar a assinatura diretamente no Asaas.");
        }
        
        return true;
    }
}