<?php

namespace App\Services;

use App\Models\Agendamento;
use App\Models\Pagamento;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail; // Adicionado para envio de e-mails

class PagamentoService
{
    public function criarCobrancaAsaas($agendamento, string $metodo, ?string $asaasCustomerId, int $parcelas = 1)
    {
        $valorTotal = $agendamento->valor_total ?? $agendamento->valor_final;

        $taxaPlataforma = round($valorTotal * 0.12, 2);
        $valorLiquidoPrestador = round($valorTotal - $taxaPlataforma, 2);

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

        $nomeServico = $agendamento->servico->nome ?? (isset($agendamento->item_aluguel_id) ? 'Locação de Item' : 'Reserva');
        $nomeEstabelecimento = DB::table('estabelecimentos')->where('id', $agendamento->estabelecimento_id)->value('nome') ?? 'WaitLess';
        $descricaoProfissional = "Reserva: {$nomeServico} em {$nomeEstabelecimento}";

        $payloadAsaas = [
            'customer'    => $asaasCustomerId,
            'billingType' => $billingTypeAsaas,
            'dueDate'     => date('Y-m-d'),
            'description' => $descricaoProfissional,
            'value'       => $valorTotal,
            'escrow'      => true, 
            'split' => [
                [
                    'walletId' => $provider->asaas_wallet_id,
                    'percentualValue' => 88.00 
                ]
            ]
        ];

        if ($metodo === 'cartao') {
            $payloadAsaas['installmentCount'] = $parcelas;
            $payloadAsaas['installmentValue'] = round($valorTotal / $parcelas, 2); 
        }

        $response = Http::withHeaders([
            'access_token' => config('services.asaas.key'), 
        ])->post(config('services.asaas.url') . '/payments', $payloadAsaas);

        if ($response->failed()) {
            Log::error("Erro Asaas Service", ['resposta' => $response->json()]);
            throw new \Exception('Falha na comunicação com o gateway de pagamento.');
        }

        $asaasPayment = $response->json();
        $isAgendamento = isset($agendamento->servico_id);

        $novoPagamento = Pagamento::create([
            'usuario_id'           => $isAgendamento ? $agendamento->usuario_id : $agendamento->locatario_id,
            'estabelecimento_id'   => $agendamento->estabelecimento_id,
            'agendamento_id'       => $isAgendamento ? $agendamento->id : null,
            'aluguel_id'           => $isAgendamento ? null : $agendamento->id,
            'gateway_pagamento'    => 'Asaas',
            'id_transacao_gateway' => $asaasPayment['id'],
            'valor'                => $valorTotal,
            'taxa'                 => $taxaPlataforma,
            'valor_liquido'        => $valorLiquidoPrestador,
            'status'               => 'pendente',
            'metodo_pagamento'     => $metodo,
        ]);

        $pin = str_pad(mt_rand(0, 9999), 4, '0', STR_PAD_LEFT);

        if ($isAgendamento) {
            $agendamento->update([
                'status_pagamento'   => 'aguardando_pagamento',
                'codigo_verificacao' => $pin,
                'pagamento_id'       => $novoPagamento->id 
            ]);
        } else {
            $agendamento->update([
                'status'       => 'aguardando_pagamento',
                'pagamento_id' => $novoPagamento->id
            ]);
        }

        // 👉 DISPARA O E-MAIL DE PAGAMENTO PENDENTE
        $this->enviarEmailNotificacao($agendamento, 'pendente', $asaasPayment['invoiceUrl'], $pin);

        return [
            'status'      => 'success',
            'payment_id'  => $asaasPayment['id'],
            'pix_qr_code' => $asaasPayment['pixQrCode'] ?? null,
            'invoice_url' => $asaasPayment['invoiceUrl']
        ];
    }

    public function liberarCustodiaAsaas($idTransacaoGateway)
    {
        $response = Http::withHeaders([
            'access_token' => config('services.asaas.key'),
        ])->post(config('services.asaas.url') . "/payments/{$idTransacaoGateway}/releaseEscrow");

        if ($response->failed()) {
            Log::error("Falha ao liberar custódia no Asaas", ['resposta' => $response->json()]);
            return false;
        }

        return true;
    }

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

    public function repassarSaldoPixProvedor($providerId, $valorEspecifico = null)
    {
        $provider = DB::table('providers')->where('id', $providerId)->first();

        if (!$provider || $provider->saldo <= 0 || !$provider->pix_key) {
            return false; 
        }

        $valorRepasse = $valorEspecifico ? (float) $valorEspecifico : $provider->saldo;

        if ($valorRepasse > $provider->saldo) {
            throw new \Exception("O valor solicitado (R$ {$valorRepasse}) é maior que o saldo disponível na carteira.");
        }

        $payloadTransfer = [
            'value' => $valorRepasse,
            'pixAddressKey' => $provider->pix_key,
            'pixAddressKeyType' => $provider->tipo_chave_pix ?? 'EVP', 
            'description' => 'Repasse WaitLess',
        ];

        $response = Http::withHeaders([
            'access_token' => $provider->asaas_api_key, 
        ])->post(config('services.asaas.url') . '/transfers', $payloadTransfer);

        if ($response->successful()) {
            DB::table('providers')->where('id', $providerId)->decrement('saldo', $valorRepasse);
            Log::info("Repasse PIX solicitado para Provider {$providerId}. Valor: R$ {$valorRepasse}");
            return true;
        }

        Log::error("Falha ao transferir PIX", $response->json());
        return false;
    }

    /**
     * 👉 SISTEMA CENTRAL DE NOTIFICAÇÕES POR E-MAIL PARA O CLIENTE
     */
    public function enviarEmailNotificacao($agendamento, $statusPagamento, $linkAsaas = null, $pin = null)
    {
        // Garante que temos os dados do cliente
        $cliente = DB::table('users')->where('id', $agendamento->usuario_id ?? $agendamento->locatario_id)->first();
        if (!$cliente || !$cliente->email) return;

        $nomeServico = $agendamento->servico->nome ?? 'sua reserva';
        $dataStr = date('d/m/Y', strtotime($agendamento->data_agendamento ?? $agendamento->data_inicio));
        $horaStr = substr($agendamento->hora_agendamento ?? $agendamento->hora_inicio, 0, 5);

        $assunto = "Atualização da sua reserva na WaitLess";
        $mensagem = "Olá, {$cliente->name}!\n\n";

        switch ($statusPagamento) {
            case 'pendente':
                $assunto = "Ação Necessária: Pague sua reserva WaitLess";
                $mensagem .= "Sua reserva para o serviço '{$nomeServico}' no dia {$dataStr} às {$horaStr} foi gerada com sucesso.\n\n";
                $mensagem .= "Para confirmar seu agendamento, realize o pagamento acessando a fatura oficial no link abaixo:\n";
                $mensagem .= "👉 {$linkAsaas}\n\n";
                if ($pin) {
                    $mensagem .= "O seu PIN de segurança para apresentar no balcão é: {$pin}\n\n";
                }
                break;

            case 'pago':
                $assunto = "Pagamento Confirmado! Reserva Garantida";
                $mensagem .= "Recebemos o seu pagamento referente ao serviço '{$nomeServico}' no dia {$dataStr} às {$horaStr}.\n\n";
                $mensagem .= "Sua reserva está 100% confirmada. Te esperamos no local!\n\n";
                if ($pin) {
                    $mensagem .= "Não esqueça o seu PIN de segurança: {$pin}\n\n";
                }
                break;

            case 'local':
                $assunto = "Reserva Confirmada (Pagamento no Local)";
                $mensagem .= "Sua reserva para o serviço '{$nomeServico}' no dia {$dataStr} às {$horaStr} foi confirmada!\n\n";
                $mensagem .= "Você escolheu a opção de pagar no estabelecimento. Lembre-se de chegar com alguns minutos de antecedência.\n\n";
                break;
        }

        $mensagem .= "Equipe WaitLess";

        try {
            Mail::raw($mensagem, function ($mail) use ($cliente, $assunto) {
                $mail->to($cliente->email)->subject($assunto);
            });
        } catch (\Exception $e) {
            Log::error("Erro ao enviar email para o cliente: " . $e->getMessage());
        }
    }
}