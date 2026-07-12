<?php

namespace App\Services;

use App\Models\Agendamento;
use App\Models\Pagamento;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class PagamentoService
{
    /**
     * Processa a criação da cobrança Online (Asaas) com Split de 12%
     */
    public function criarCobrancaAsaas($agendamento, string $metodo, ?string $asaasCustomerId, int $parcelas = 1)
    {
        $valorTotal = $agendamento->valor_total ?? $agendamento->valor_final;

        // Calcula a retenção da plataforma WaitLess (12%) e o valor do prestador (88%)
        $taxaPlataforma = round($valorTotal * 0.12, 2);
        $valorLiquidoPrestador = round($valorTotal - $taxaPlataforma, 2);

        // Busca a Wallet (Subconta) do proprietário do estabelecimento
        $provider = DB::table('providers')
            ->join('users', 'providers.user_id', '=', 'users.id')
            ->join('estabelecimento_usuario', 'users.id', '=', 'estabelecimento_usuario.usuario_id')
            ->where('estabelecimento_usuario.estabelecimento_id', $agendamento->estabelecimento_id)
            ->select('providers.id', 'providers.asaas_wallet_id') // Supondo que você salvou a wallet aqui
            ->first();

        if (!$provider || !$provider->asaas_wallet_id) {
            throw new \Exception('O estabelecimento não possui uma carteira Asaas configurada.');
        }

        $billingTypeMap = ['pix' => 'PIX', 'boleto' => 'BOLETO', 'cartao' => 'CREDIT_CARD'];
        $billingTypeAsaas = $billingTypeMap[$metodo];

        $payloadAsaas = [
            'customer'    => $asaasCustomerId,
            'billingType' => $billingTypeAsaas,
            'dueDate'     => date('Y-m-d'),
            'description' => 'Serviço/Reserva WaitLess #' . $agendamento->id,
            'value'       => $valorTotal,
            // A mágica do Split acontece aqui
            'split' => [
                [
                    'walletId' => $provider->asaas_wallet_id,
                    'percentualValue' => 88.00 // 88% vai para o proprietário
                ]
                // Os 12% restantes ficam automaticamente na sua conta principal Asaas
            ]
        ];

        if ($metodo === 'cartao' && $parcelas > 1) {
            $payloadAsaas['installmentCount'] = $parcelas;
        }

        $response = Http::withHeaders([
            'access_token' => env('ASAAS_KEY'), // Alterado conforme solicitado
        ])->post(env('ASAAS_URL') . '/payments', $payloadAsaas);

        if ($response->failed()) {
            Log::error("Erro Asaas Service", ['resposta' => $response->json()]);
            throw new \Exception('Falha na comunicação com o gateway de pagamento.');
        }

        $asaasPayment = $response->json();

        // Salva na sua tabela de pagamentos
        Pagamento::create([
            'usuario_id'           => $agendamento->usuario_id,
            'estabelecimento_id'   => $agendamento->estabelecimento_id,
            'agendamento_id'       => $agendamento->id,
            'gateway_pagamento'    => 'Asaas',
            'id_transacao_gateway' => $asaasPayment['id'],
            'valor'                => $valorTotal,
            'taxa'                 => $taxaPlataforma,
            'valor_liquido'        => $valorLiquidoPrestador,
            'status'               => 'pendente',
            'metodo_pagamento'     => $metodo,
        ]);

        $agendamento->update([
            'status_pagamento'   => 'aguardando_pagamento',
            'codigo_verificacao' => str_pad(mt_rand(0, 9999), 4, '0', STR_PAD_LEFT)
        ]);

        return [
            'status'      => 'success',
            'payment_id'  => $asaasPayment['id'],
            'pix_qr_code' => $asaasPayment['pixQrCode'] ?? null,
            'invoice_url' => $asaasPayment['invoiceUrl']
        ];
    }

    /**
     * Serviço a ser rodado a cada 7 dias para repassar o saldo via PIX
     */
    public function repassarSaldoPixProvedor($providerId)
    {
        $provider = DB::table('providers')->where('id', $providerId)->first();

        if (!$provider || $provider->saldo <= 0 || !$provider->chave_pix) {
            return false; // Nada a transferir
        }

        $valorRepasse = $provider->saldo;

        $payloadTransfer = [
            'value' => $valorRepasse,
            'pixAddressKey' => $provider->chave_pix,
            'pixAddressKeyType' => $provider->tipo_chave_pix, // CPF, CNPJ, EMAIL, PHONE, EVP
            'description' => 'Repasse Semanal WaitLess',
        ];

        // É necessário usar a API Key da Subconta (Wallet) do provider para fazer o saque do lado dele
        $response = Http::withHeaders([
            'access_token' => $provider->asaas_api_key, // Salvo quando você criou a subconta
        ])->post(env('ASAAS_URL') . '/transfers', $payloadTransfer);

        if ($response->successful()) {
            // Zera o saldo do provedor após solicitar o repasse
            DB::table('providers')->where('id', $providerId)->update(['saldo' => 0]);
            Log::info("Repasse PIX solicitado para Provider {$providerId}. Valor: R$ {$valorRepasse}");
            return true;
        }

        Log::error("Falha ao transferir PIX", $response->json());
        return false;
    }
}