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
    /**
     * @param array|null $cartao   ['numero','titular','mes','ano','cvv'] — cartão digitado na tela de assinatura.
     *                             Vai direto para o Asaas (que guarda o cartão na assinatura); nada é salvo aqui.
     * @param array|null $titular  ['nome','email','cpf_cnpj','cep','numero','telefone'] — exigido pelo Asaas junto do cartão.
     */
    public function criarCobranca(Assinatura $assinatura, User $user, array $planoData, string $metodo, ?array $cartao = null, ?array $titular = null, ?string $ip = null)
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

        // Cartão digitado na tela: o Asaas cadastra o cartão na assinatura e cobra sozinho a cada ciclo.
        if ($billingType === 'CREDIT_CARD' && $cartao) {
            $payload['creditCard'] = [
                'holderName' => $cartao['titular'],
                'number' => preg_replace('/\D/', '', (string) $cartao['numero']),
                'expiryMonth' => str_pad((string) $cartao['mes'], 2, '0', STR_PAD_LEFT),
                'expiryYear' => strlen((string) $cartao['ano']) === 2 ? '20' . $cartao['ano'] : (string) $cartao['ano'],
                'ccv' => (string) $cartao['cvv'],
            ];
            $payload['creditCardHolderInfo'] = array_filter([
                'name' => $titular['nome'] ?? $user->name,
                'email' => $titular['email'] ?? $user->email,
                'cpfCnpj' => preg_replace('/\D/', '', (string) ($titular['cpf_cnpj'] ?? $user->cpf_cnpj)),
                'postalCode' => preg_replace('/\D/', '', (string) ($titular['cep'] ?? $user->postal_code)),
                'addressNumber' => $titular['numero'] ?? $user->address_number,
                'mobilePhone' => preg_replace('/\D/', '', (string) ($titular['telefone'] ?? $user->mobile_phone ?? $user->telefone)) ?: null,
            ]);
            $payload['remoteIp'] = $ip ?: request()->ip();
        }

        $response = Http::withHeaders([
            'access_token' => $this->key,
        ])->post($this->url . $endpoint, $payload);

        if ($response->failed()) {
            $erroAsaas = $response->json('errors')[0]['description'] ?? 'Erro de comunicação desconhecido com o Asaas.';
            throw new Exception("Falha no gateway Asaas: " . $erroAsaas);
        }

        // Tela "Pagamento": guarda a forma padrão e, se for cartão, só bandeira/final/validade.
        if ($assinatura->exists) {
            $assinatura->forceFill(['metodo_pagamento' => $billingType])->save();
            if ($billingType === 'CREDIT_CARD' && $cartao) {
                \App\Services\Assinatura\PagamentoAssinaturaService::registrarCartaoAoAssinar($assinatura, $cartao);
            }
        }

        return $response->json();
    }

    /**
     * Cobrança da assinatura que está em aberto (pendente ou vencida) e, se for Pix, o QR code para pagar.
     * O Asaas também manda essa cobrança por e-mail; aqui ela aparece na tela quando está perto de vencer.
     */
    public function cobrancaEmAberto(string $assinaturaGatewayId): ?array
    {
        $lista = Http::withHeaders(['access_token' => $this->key])->timeout(15)
            ->get("{$this->url}/subscriptions/{$assinaturaGatewayId}/payments", ['limit' => 10]);
        if ($lista->failed()) {
            return null;
        }

        $cobranca = collect($lista->json('data') ?? [])
            ->filter(fn ($p) => in_array($p['status'] ?? null, ['PENDING', 'OVERDUE'], true))
            ->sortBy('dueDate')
            ->first();
        if (!$cobranca) {
            return null;
        }

        $dados = [
            'id' => $cobranca['id'],
            'valor' => (float) ($cobranca['value'] ?? 0),
            'vencimento' => $cobranca['dueDate'] ?? null,
            'vencida' => ($cobranca['status'] ?? null) === 'OVERDUE',
            'forma' => $cobranca['billingType'] ?? null,
            'link' => $cobranca['invoiceUrl'] ?? null,
            'pix' => null,
        ];

        if (($cobranca['billingType'] ?? null) === 'PIX') {
            $qr = Http::withHeaders(['access_token' => $this->key])->timeout(15)
                ->get("{$this->url}/payments/{$cobranca['id']}/pixQrCode");
            if ($qr->successful()) {
                $dados['pix'] = [
                    'imagem' => $qr->json('encodedImage'),
                    'copia_e_cola' => $qr->json('payload'),
                    'expira_em' => $qr->json('expirationDate'),
                ];
            }
        }

        return $dados;
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