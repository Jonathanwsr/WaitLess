<?php

namespace App\Services;

use App\Models\Provider;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Exception;

class AsaasService
{
    protected $apiKey;
    protected $baseUrl;

    public function __construct()
    {
        $this->apiKey = env('ASAAS_API_KEY');

        $this->baseUrl = env('ASAAS_URL', 'https://sandbox.asaas.com/api/v3');
    }

    /**
     * Realiza a transferência Pix para o prestador de serviço.
     */
    public function transferToProvider(Provider $provider, float $amount, string $serviceId)
    {
        try {
            $response = Http::withHeaders([
                'access_token' => $this->apiKey,
                'Content-Type' => 'application/json',
            ])->post("{$this->baseUrl}/transfers", [
                'value' => $amount,
                'pixAddressKey' => $provider->pix_key,
                'pixAddressKeyType' => $provider->pix_key_type,
                'description' => "Repasse WaitLess - Serviço #{$serviceId}"
            ]);

            if ($response->failed()) {
                Log::error("Erro no repasse Asaas para o serviço {$serviceId}: " . $response->body());
                throw new Exception("Falha na comunicação com o gateway de pagamento.");
            }

            return $response->json();

        } catch (Exception $e) {
            Log::error("Exceção ao tentar transferir via Asaas: " . $e->getMessage());
            throw $e;
        }
    }
}