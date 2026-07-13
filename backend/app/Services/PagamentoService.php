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
        // Aceita tanto Agendamento (serviços) quanto Aluguel (reservas)
        $valorTotal = $agendamento->valor_total ?? $agendamento->valor_final;

        // Calcula a retenção da plataforma WaitLess (12%) e o valor do prestador (88%)
        $taxaPlataforma = round($valorTotal * 0.12, 2);
        $valorLiquidoPrestador = round($valorTotal - $taxaPlataforma, 2);

        // Busca a Wallet (Subconta) do proprietário do estabelecimento
        $provider = DB::table('providers')
            ->join('users', 'providers.user_id', '=', 'users.id')
            ->join('estabelecimento_usuario', 'users.id', '=', 'estabelecimento_usuario.usuario_id')
            ->where('estabelecimento_usuario.estabelecimento_id', $agendamento->estabelecimento_id)
            ->select('providers.id', 'providers.asaas_wallet_id')
            ->first();

        if (!$provider || !$provider->asaas_wallet_id) {
            throw new \Exception('O estabelecimento não possui uma carteira Asaas configurada.');
        }

        $billingTypeMap = ['pix' => 'PIX', 'boleto' => 'BOLETO', 'cartao' => 'CREDIT_CARD'];
        $billingTypeAsaas = $billingTypeMap[$metodo];

        // Identifica se é Agendamento ou Aluguel para a descrição
        $tipoReserva = isset($agendamento->servico_id) ? 'Serviço' : 'Locação';

        $payloadAsaas = [
            'customer'    => $asaasCustomerId,
            'billingType' => $billingTypeAsaas,
            'dueDate'     => date('Y-m-d'),
            'description' => "{$tipoReserva} WaitLess #" . $agendamento->id,
            'value'       => $valorTotal,
            // Split de Pagamento
            'split' => [
                [
                    'walletId' => $provider->asaas_wallet_id,
                    'percentualValue' => 88.00 // 88% vai para o proprietário
                ]
            ]
        ];

        // 👉 CORREÇÃO CRÍTICA PARA CARTÃO DE CRÉDITO NO ASAAS
        if ($metodo === 'cartao') {
            $payloadAsaas['installmentCount'] = $parcelas;
            $payloadAsaas['installmentValue'] = round($valorTotal / $parcelas, 2); 
        }

        $response = Http::withHeaders([
            // Lê do arquivo config para evitar problemas com cache de .env
            'access_token' => config('services.asaas.key'), 
        ])->post(config('services.asaas.url') . '/payments', $payloadAsaas);

        if ($response->failed()) {
            Log::error("Erro Asaas Service", ['resposta' => $response->json()]);
            throw new \Exception('Falha na comunicação com o gateway de pagamento.');
        }

        $asaasPayment = $response->json();

        // Determina se a transação veio da tabela agendamentos ou alugueis
        $isAgendamento = isset($agendamento->servico_id);

        // Salva na sua tabela de pagamentos
        $novoPagamento = Pagamento::create([
            'usuario_id'           => $isAgendamento ? $agendamento->usuario_id : $agendamento->locatario_id,
            'estabelecimento_id'   => $agendamento->estabelecimento_id,
            'agendamento_id'       => $isAgendamento ? $agendamento->id : null,
            'aluguel_id'           => $isAgendamento ? null : $agendamento->id, // Usa coluna nova se for aluguel
            'gateway_pagamento'    => 'Asaas',
            'id_transacao_gateway' => $asaasPayment['id'],
            'valor'                => $valorTotal,
            'taxa'                 => $taxaPlataforma,
            'valor_liquido'        => $valorLiquidoPrestador,
            'status'               => 'pendente',
            'metodo_pagamento'     => $metodo,
        ]);

        if ($isAgendamento) {
            $agendamento->update([
                'status_pagamento'   => 'aguardando_pagamento',
                'codigo_verificacao' => str_pad(mt_rand(0, 9999), 4, '0', STR_PAD_LEFT),
                'pagamento_id'       => $novoPagamento->id // Adiciona o ID do pagamento gerado
            ]);
        } else {
            // Atualiza os dados de locação (Aluguel)
            $agendamento->update([
                'status'       => 'aguardando_pagamento',
                'pagamento_id' => $novoPagamento->id
            ]);
        }

        return [
            'status'      => 'success',
            'payment_id'  => $asaasPayment['id'],
            'pix_qr_code' => $asaasPayment['pixQrCode'] ?? null,
            'invoice_url' => $asaasPayment['invoiceUrl']
        ];
    }

    /**
     * Estorna (cancela/devolve) um pagamento diretamente no Asaas
     */
    public function estornarPagamento($idTransacaoGateway)
    {
        $response = Http::withHeaders([
            'access_token' => config('services.asaas.key'),
        ])->post(config('services.asaas.url') . "/payments/{$idTransacaoGateway}/refund");

        if ($response->failed()) {
            Log::error("Erro ao estornar pagamento no Asaas", ['resposta' => $response->json()]);
            throw new \Exception('Falha ao tentar estornar o pagamento no gateway Asaas.');
        }

        return true;
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
            'access_token' => $provider->asaas_api_key, 
        ])->post(config('services.asaas.url') . '/transfers', $payloadTransfer);

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