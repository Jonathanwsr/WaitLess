<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Camada única para consultas somente-leitura à API do Asaas usadas pelo
 * painel do admin (saldo de carteira por lojista, status real de um
 * pagamento, status real de uma assinatura). Centraliza aqui porque antes
 * cada controller fazia sua própria chamada Http:: inline com nomes de
 * variável de ambiente diferentes — isso mantém uma única fonte de verdade
 * para URL base e timeouts.
 */
class AsaasWalletService
{
    protected string $baseUrl;
    protected ?string $masterKey;

    public function __construct()
    {
        $this->baseUrl = rtrim(config('services.asaas.url'), '/');
        $this->masterKey = config('services.asaas.key');
    }

    /**
     * Saldo real disponível na subconta Asaas de um prestador (usa a
     * própria asaas_api_key do provider, não a chave mestra da plataforma).
     */
    public function saldoProvider(?string $apiKeyProvider): ?array
    {
        if (!$apiKeyProvider) {
            return null;
        }

        try {
            $response = Http::withHeaders(['access_token' => $apiKeyProvider])
                ->timeout(6)
                ->get("{$this->baseUrl}/finance/balance");

            if ($response->failed()) {
                Log::warning('AsaasWalletService: falha ao buscar saldo do provider. ' . $response->body());
                return null;
            }

            return $response->json();
        } catch (\Exception $e) {
            Log::warning('AsaasWalletService: exceção ao buscar saldo do provider. ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Status real (na origem) de um pagamento pela conta mãe da plataforma —
     * os pagamentos usam Split e pertencem à conta mãe, não à subconta do lojista.
     */
    public function consultarPagamento(?string $idTransacaoGateway): ?array
    {
        if (!$idTransacaoGateway || !$this->masterKey) {
            return null;
        }

        try {
            $response = Http::withHeaders(['access_token' => $this->masterKey])
                ->timeout(6)
                ->get("{$this->baseUrl}/payments/{$idTransacaoGateway}");

            if ($response->failed()) {
                return null;
            }

            return $response->json();
        } catch (\Exception $e) {
            Log::warning('AsaasWalletService: exceção ao consultar pagamento. ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Status real de uma assinatura recorrente (planos premium do app),
     * também criada pela conta mãe (ver AsaasAssinaturaService).
     */
    public function consultarAssinatura(?string $gatewayAssinaturaId): ?array
    {
        if (!$gatewayAssinaturaId || !$this->masterKey) {
            return null;
        }

        try {
            $response = Http::withHeaders(['access_token' => $this->masterKey])
                ->timeout(6)
                ->get("{$this->baseUrl}/subscriptions/{$gatewayAssinaturaId}");

            if ($response->failed()) {
                return null;
            }

            return $response->json();
        } catch (\Exception $e) {
            Log::warning('AsaasWalletService: exceção ao consultar assinatura. ' . $e->getMessage());
            return null;
        }
    }
}
