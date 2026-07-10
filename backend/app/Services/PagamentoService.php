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
     * Processa a criação da cobrança (Asaas ou Local)
     */
    public function criarCobranca(Agendamento $agendamento, string $metodoPagamento, ?string $asaasCustomerId = null, int $parcelas = 1)
    {
        $valorTotal = $agendamento->valor_total;

        // 1. Definição das Taxas Fixas do Asaas (Exemplo aproximado de mercado)
        $taxaFixaGateway = 0.00;
        if ($metodoPagamento === 'pix') $taxaFixaGateway = 0.99;
        if ($metodoPagamento === 'boleto') $taxaFixaGateway = 1.99;
        if ($metodoPagamento === 'cartao') $taxaFixaGateway = 0.49 + ($valorTotal * 0.0299); // 2.99% + fixo

        // Se for pagamento no local, não há taxa de gateway de terceiros
        if ($metodoPagamento === 'local') {
            $taxaFixaGateway = 0.00;
        }

        // 2. Calcula a retenção da sua plataforma (12%)
        $taxaPlataforma = $valorTotal * 0.12;

        // Total de taxas descontadas do prestador
        $taxaTotalDescontada = $taxaPlataforma + $taxaFixaGateway;
        $valorLiquidoPrestador = $valorTotal - $taxaTotalDescontada;

        // Se o pagamento for no LOCAL
        if ($metodoPagamento === 'local') {
            return $this->processarPagamentoLocal($agendamento, $valorTotal, $taxaPlataforma, $valorLiquidoPrestador);
        }

        // Se for pagamento Online (Asaas)
        return $this->processarPagamentoAsaas($agendamento, $metodoPagamento, $asaasCustomerId, $parcelas, $valorTotal, $taxaTotalDescontada, $valorLiquidoPrestador);
    }

    /**
     * Fluxo Interno para Pagamento Presencial (No Local)
     */
    private function processarPagamentoLocal(Agendamento $agendamento, $valorTotal, $taxaPlataforma, $valorLiquidoPrestador)
    {
        $pagamento = Pagamento::create([
            'usuario_id'           => $agendamento->usuario_id,
            'estabelecimento_id'   => $agendamento->estabelecimento_id,
            'agendamento_id'       => $agendamento->id,
            'gateway_pagamento'    => 'Local',
            'id_transacao_gateway' => 'LOCAL_' . uniqid(),
            'valor'                => $valorTotal,
            'taxa'                 => $taxaPlataforma,
            'valor_liquido'        => $valorLiquidoPrestador,
            'status'               => 'pendente', // Será pago no local física e presencialmente
            'metodo_pagamento'     => 'local',
            'data_pagamento'       => null,
        ]);

        $agendamento->update([
            'status_pagamento'   => 'pagamento_no_local',
            'codigo_verificacao' => str_pad(mt_rand(0, 9999), 4, '0', STR_PAD_LEFT)
        ]);

        return [
            'status'      => 'success',
            'message'     => 'Agendamento configurado para pagamento no local.',
            'invoice_url' => null
        ];
    }

    /**
     * Fluxo via API Asaas
     */
    private function processarPagamentoAsaas(Agendamento $agendamento, string $metodo, ?string $customerId, int $parcelas, $valorTotal, $taxas, $valorLiquido)
    {
        $billingTypeMap = ['pix' => 'PIX', 'boleto' => 'BOLETO', 'cartao' => 'CREDIT_CARD'];
        $billingTypeAsaas = $billingTypeMap[$metodo];

        $payloadAsaas = [
            'customer'    => $customerId,
            'billingType' => $billingTypeAsaas,
            'dueDate'     => date('Y-m-d'),
            'description' => 'Serviço/Reserva #' . $agendamento->id,
        ];

        if ($metodo === 'cartao' && $parcelas > 1) {
            $payloadAsaas['installmentCount'] = $parcelas;
            $payloadAsaas['value']            = $valorTotal;
        } else {
            $payloadAsaas['value'] = $valorTotal;
        }

        $response = Http::withHeaders([
            'access_token' => env('ASAAS_API_KEY'),
        ])->post(env('ASAAS_URL') . '/payments', $payloadAsaas);

        if ($response->failed()) {
            Log::error("Erro Asaas Service", ['resposta' => $response->json()]);
            throw new \Exception('Falha na comunicação com o gateway de pagamento.');
        }

        $asaasPayment = $response->json();

        Pagamento::create([
            'usuario_id'           => $agendamento->usuario_id,
            'estabelecimento_id'   => $agendamento->estabelecimento_id,
            'agendamento_id'       => $agendamento->id,
            'gateway_pagamento'    => 'Asaas',
            'id_transacao_gateway' => $asaasPayment['id'],
            'valor'                => $valorTotal,
            'taxa'                 => $taxas,
            'valor_liquido'        => $valorLiquido,
            'status'               => 'pendente',
            'metodo_pagamento'     => $metodo,
            'data_pagamento'       => null,
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
     * Confirmação e Liquidação do Saldo Local (Chamado no Webhook ou PIN)
     */
    public function creditarSaldoPrestador(Pagamento $pagamento)
    {
        // Impede duplicidade de crédito de saldo
        if ($pagamento->status === 'pago') {
            return;
        }

        // Localiza o Provider dono do estabelecimento usando a tabela pivô informada por você
        $provider = DB::table('providers')
            ->join('users', 'providers.user_id', '=', 'users.id')
            ->join('estabelecimento_usuario', 'users.id', '=', 'estabelecimento_usuario.usuario_id')
            ->where('estabelecimento_usuario.estabelecimento_id', $pagamento->estabelecimento_id)
            ->where('users.papel', 'socio')
            ->select('providers.id', 'providers.saldo')
            ->first();

        if ($provider) {
            // Soma de forma acumulativa o valor líquido gerado para o prestador
            DB::table('providers')
                ->where('id', $provider->id)
                ->increment('saldo', $pagamento->valor_liquido);

            Log::info("Saldo somado com sucesso! Provider ID: {$provider->id}. Acréscimo: R$ {$pagamento->valor_liquido}");
        }
    }
}