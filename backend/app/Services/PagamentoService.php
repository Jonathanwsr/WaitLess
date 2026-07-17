<?php

namespace App\Services;

use App\Models\Agendamento;
use App\Models\Pagamento;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail; 

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

        // 👉 DISPARA O E-MAIL DE PAGAMENTO PENDENTE (Apenas Cliente)
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

    /**
     * 👉 ESTORNO DE PAGAMENTO (Suporta estorno parcial para retenção de taxas)
     */
    public function estornarPagamento($idTransacaoGateway, $valorEstorno = null)
    {
        $payload = [];
        
        // Se foi passado um valor específico (menor que o total), manda pro Asaas
        if ($valorEstorno) {
            $payload['value'] = round($valorEstorno, 2);
        }

        $response = Http::withHeaders([
            'access_token' => config('services.asaas.key'),
        ])->post(config('services.asaas.url') . "/payments/{$idTransacaoGateway}/refund", $payload);

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
     * 👉 SISTEMA CENTRAL DE NOTIFICAÇÕES POR E-MAIL (CLIENTE E PROPRIETÁRIO)
     */
    public function enviarEmailNotificacao($agendamento, $statusPagamento, $linkAsaas = null, $pin = null)
    {
        $isAgendamento = isset($agendamento->servico_id);

        // 1. DADOS DO CLIENTE
        $cliente = DB::table('users')->where('id', $isAgendamento ? $agendamento->usuario_id : $agendamento->locatario_id)->first();
        if (!$cliente || !$cliente->email) return;

        // 2. DADOS DO ESTABELECIMENTO E PROPRIETÁRIO
        $estabelecimentoNome = DB::table('estabelecimentos')->where('id', $agendamento->estabelecimento_id)->value('nome') ?? 'WaitLess';
        
        // Busca o email do dono do estabelecimento (admin/proprietario)
        $dono = DB::table('estabelecimento_usuario')
            ->join('users', 'estabelecimento_usuario.usuario_id', '=', 'users.id')
            ->where('estabelecimento_usuario.estabelecimento_id', $agendamento->estabelecimento_id)
            ->whereIn('users.papel', ['admin', 'proprietario', 'socio'])
            ->select('users.email', 'users.name')
            ->first();

        // 3. VARIÁVEIS DO SERVIÇO/RESERVA
        $nomeServico = $isAgendamento ? ($agendamento->servico->nome ?? 'Serviço') : 'Locação/Reserva';
        $dataStr = date('d/m/Y', strtotime($isAgendamento ? $agendamento->data_agendamento : $agendamento->data_inicio));
        $horaStr = substr($isAgendamento ? $agendamento->hora_agendamento : $agendamento->hora_inicio, 0, 5);
        $valorBrutoStr = number_format($agendamento->valor_final ?? $agendamento->valor_total, 2, ',', '.');
        $pinSeguranca = $pin ?? $agendamento->codigo_verificacao;

        // ==========================================
        // TEXTOS PARA O CLIENTE
        // ==========================================
        $assuntoCliente = "Atualização da sua reserva - {$estabelecimentoNome}";
        $mensagemCliente = "Olá, {$cliente->name}!\n\n";

        switch ($statusPagamento) {
            case 'pendente':
                $assuntoCliente = "Ação Necessária: Pague sua reserva na {$estabelecimentoNome}";
                $mensagemCliente .= "Sua reserva de '{$nomeServico}' no dia {$dataStr} às {$horaStr} foi separada com sucesso!\n\n";
                $mensagemCliente .= "Para garantir sua vaga, efetue o pagamento de R$ {$valorBrutoStr} pelo link seguro oficial abaixo:\n";
                $mensagemCliente .= "👉 {$linkAsaas}\n\n";
                if ($pinSeguranca) $mensagemCliente .= "Seu PIN de segurança no balcão será: {$pinSeguranca}\n\n";
                break;

            case 'pago':
                $assuntoCliente = "Pagamento Confirmado! Reserva Garantida";
                $mensagemCliente .= "Recebemos o seu pagamento de R$ {$valorBrutoStr} referente à '{$nomeServico}' no dia {$dataStr} às {$horaStr}.\n\n";
                $mensagemCliente .= "Sua reserva está 100% confirmada. Te esperamos no local!\n\n";
                if ($pinSeguranca) $mensagemCliente .= "Guarde o seu PIN de atendimento: {$pinSeguranca}\n\n";
                break;

            case 'local':
                $assuntoCliente = "Reserva Confirmada (Pagar no Local)";
                $mensagemCliente .= "Sua vaga para '{$nomeServico}' no dia {$dataStr} às {$horaStr} está confirmada!\n\n";
                $mensagemCliente .= "Você optou por pagar o valor de R$ {$valorBrutoStr} diretamente no estabelecimento. Chegue com alguns minutos de antecedência.\n\n";
                if ($pinSeguranca) $mensagemCliente .= "Seu PIN de atendimento é: {$pinSeguranca}\n\n";
                break;
        }
        $mensagemCliente .= "Equipe WaitLess";

        // ==========================================
        // TEXTOS PARA O PROPRIETÁRIO/LOJISTA
        // ==========================================
        $assuntoDono = "";
        $mensagemDono = "";

        if ($dono && in_array($statusPagamento, ['local', 'pago'])) {
            $mensagemDono = "Olá, {$dono->name}. O sistema WaitLess tem uma nova atualização para você:\n\n";

            if ($statusPagamento === 'local') {
                $assuntoDono = "💸 Nova Reserva (Pagar no Balcão) - {$dataStr}";
                $mensagemDono .= "O cliente {$cliente->name} acabou de agendar '{$nomeServico}' para o dia {$dataStr} às {$horaStr}.\n";
                $mensagemDono .= "Método escolhido: Pagar no Local.\n";
                $mensagemDono .= "Valor a ser cobrado no balcão: R$ {$valorBrutoStr}\n\n";
            } 
            elseif ($statusPagamento === 'pago') {
                $assuntoDono = "✅ Pagamento Recebido via App - {$dataStr}";
                $mensagemDono .= "Excelente notícia! O cliente {$cliente->name} pagou online R$ {$valorBrutoStr} pela reserva de '{$nomeServico}' no dia {$dataStr} às {$horaStr}.\n";
                $mensagemDono .= "O valor já está protegido na sua carteira Asaas (Custódia). Ele será liberado para saque assim que o serviço for concluído no painel usando o PIN do cliente.\n\n";
            }

            $mensagemDono .= "Acesse o painel para mais detalhes.\nSucesso nas vendas!";
        }

        // ==========================================
        // DISPARO SIMULTÂNEO (BREVO SMTP)
        // ==========================================
        try {
            // Envia para o Cliente
            Mail::raw($mensagemCliente, function ($mail) use ($cliente, $assuntoCliente) {
                $mail->to($cliente->email)->subject($assuntoCliente);
            });

            // Envia para o Dono (Apenas quando Confirmado/Local)
            if ($dono && $mensagemDono !== "") {
                Mail::raw($mensagemDono, function ($mail) use ($dono, $assuntoDono) {
                    $mail->to($dono->email)->subject($assuntoDono);
                });
            }

        } catch (\Exception $e) {
            Log::error("Erro ao enviar emails de notificação (Brevo): " . $e->getMessage());
        }
    }
}