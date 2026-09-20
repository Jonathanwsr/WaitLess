<?php

namespace App\Services;

use App\Exceptions\CarteiraAsaasNaoConfiguradaException;
use App\Models\Agendamento;
use App\Models\Pagamento;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail; 

class PagamentoService
{
    /**
     * 👉 VERIFICA SE O ESTABELECIMENTO É ISENTO DA TAXA PRESENCIAL (Premium/Sócio)
     */
    private function isIsentoTaxaPresencial($estabelecimentoId)
    {
        return DB::table('estabelecimento_usuario')
            ->join('users', 'estabelecimento_usuario.usuario_id', '=', 'users.id')
            ->where('estabelecimento_usuario.estabelecimento_id', $estabelecimentoId)
            ->where(function($query) {
                // É isento se for 'socio' na pivot OU 'premium-socio' no plano_assinatura
                $query->where('estabelecimento_usuario.tipo', 'like', '%socio%')
                      ->orWhere('users.plano_assinatura', 'premium-socio');
            })
            ->exists();
    }

    /**
     * 👉 PROCESSA O PAGAMENTO PRESENCIAL (LOCAL) E GERA A DÍVIDA DE 12% SE APLICÁVEL
     * Chame esse método no seu Controller quando o cliente escolher "Pagar no local"
     */
    public function processarPagamentoLocal($agendamento)
    {
        $valorTotal = $agendamento->valor_total ?? $agendamento->valor_final;
        $estabelecimentoId = $agendamento->estabelecimento_id;
        $isAgendamento = $agendamento instanceof Agendamento;

        $pin = str_pad(mt_rand(0, 9999), 4, '0', STR_PAD_LEFT);

        // Verifica se NÃO É isento. Se não for, cobra os 12%
        if (!$this->isIsentoTaxaPresencial($estabelecimentoId)) {
            $taxaPlataforma = round($valorTotal * 0.12, 2);
            
            DB::table('estabelecimentos')
                ->where('id', $estabelecimentoId)
                ->increment('saldo_devedor', $taxaPlataforma);
        }

        if ($isAgendamento) {
            $agendamento->update([
                'status_pagamento'   => 'local',
                'codigo_verificacao' => $pin
            ]);
        } else {
            $agendamento->update([
                'status' => 'local'
            ]);
        }

        // Dispara e-mail de pagamento no local
        $this->enviarEmailNotificacao($agendamento, 'local', null, $pin);

        return ['status' => 'success', 'message' => 'Reserva local registrada.'];
    }

    public function estabelecimentoTemCarteiraAsaas($estabelecimentoId): bool
    {
        return DB::table('providers')
            ->join('estabelecimento_usuario', 'providers.user_id', '=', 'estabelecimento_usuario.usuario_id')
            ->where('estabelecimento_usuario.estabelecimento_id', $estabelecimentoId)
            ->whereNotNull('providers.asaas_wallet_id')
            ->exists();
    }

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
            throw new CarteiraAsaasNaoConfiguradaException();
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
        $isAgendamento = $agendamento instanceof Agendamento;

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

    public function estornarPagamento($idTransacaoGateway, $valorEstorno = null)
    {
        $payload = [];
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

    /**
     * 👉 CANCELAMENTO DE AGENDAMENTO COM ESTORNO AUTOMÁTICO
     *
     * Mesma regra usada em Api\ClienteAgendamentoController::cancelar (web):
     * cancelamento até 30 minutos antes do horário marcado devolve 100% do
     * valor pago; depois disso, retém 2% como taxa de cancelamento tardio e
     * estorna o restante. Também reverte os pontos de fidelidade ganhos e
     * registra a saída no extrato do prestador. Centralizado aqui para que
     * web e mobile nunca apliquem regras diferentes.
     */
    public function processarCancelamentoAgendamento(Agendamento $agendamento): array
    {
        $pagamento = Pagamento::where('agendamento_id', $agendamento->id)->first();
        $mensagem = 'Agendamento cancelado com sucesso. Sua vaga foi liberada.';

        if (in_array($agendamento->status_pagamento, ['pago', 'pago_online']) && $pagamento && $pagamento->id_transacao_gateway) {
            $dataHoraServico = \Carbon\Carbon::parse($agendamento->data_agendamento . ' ' . $agendamento->hora_agendamento);
            $limiteGratis = $dataHoraServico->copy()->subMinutes(30);
            $isCancelamentoGratis = now()->lessThanOrEqualTo($limiteGratis);

            $valorOriginal = $pagamento->valor;
            $valorEstorno = $valorOriginal;
            $taxaCancelamento = 0;

            if (!$isCancelamentoGratis) {
                $taxaCancelamento = round($valorOriginal * 0.02, 2);
                $valorEstorno = $valorOriginal - $taxaCancelamento;
                $mensagem = "Cancelamento efetuado! Como foi feito a menos de 30 minutos do horário marcado, uma taxa de 2% (R$ " . number_format($taxaCancelamento, 2, ',', '.') . ") foi retida. O restante será devolvido para a forma de pagamento original.";
            } else {
                $mensagem = 'Cancelamento gratuito efetuado com sucesso! O valor integral será devolvido para a forma de pagamento original.';
            }

            DB::beginTransaction();
            try {
                $this->estornarPagamento($pagamento->id_transacao_gateway, $valorEstorno);
                $this->reverterPontosDeFidelidade($agendamento);

                $pagamento->update(['status' => 'estornado', 'valor_liquido' => 0]);

                $provider = DB::table('providers')
                    ->join('users', 'providers.user_id', '=', 'users.id')
                    ->join('estabelecimento_usuario', 'users.id', '=', 'estabelecimento_usuario.usuario_id')
                    ->where('estabelecimento_usuario.estabelecimento_id', $agendamento->estabelecimento_id)
                    ->select('providers.id')
                    ->first();

                if ($provider) {
                    DB::table('extrato_providers')->insert([
                        'provider_id'      => $provider->id,
                        'usuario_id'       => $agendamento->usuario_id,
                        'origem_type'      => 'App\\Models\\Agendamento',
                        'origem_id'        => $agendamento->id,
                        'tipo'             => 'estorno',
                        'valor_bruto'      => $valorEstorno,
                        'taxa_plataforma'  => 0,
                        'valor_liquido'    => $valorEstorno * -1,
                        'descricao'        => $isCancelamentoGratis ? 'Estorno integral por cancelamento do cliente' : 'Estorno parcial (cliente cancelou em cima da hora)',
                        'status'           => 'estornado',
                        'codigo_transacao' => $pagamento->id_transacao_gateway,
                        'metodo_pagamento' => $pagamento->metodo_pagamento,
                        'created_at'       => now(),
                    ]);
                }

                DB::commit();
            } catch (\Exception $e) {
                DB::rollBack();
                Log::error('Falha ao estornar cancelamento de agendamento #' . $agendamento->id . ': ' . $e->getMessage());
                throw new \Exception('Não foi possível processar a devolução do valor agora. Tente novamente em alguns minutos ou fale com o suporte.');
            }
        }

        $agendamento->update([
            'status' => 'cancelado',
            'status_pagamento' => ($pagamento && $pagamento->status === 'estornado') ? 'estornado' : 'cancelado',
        ]);

        if ($pagamento && $pagamento->status !== 'estornado') {
            $pagamento->update(['status' => 'cancelado']);
        }

        return ['message' => $mensagem, 'estornado' => (bool) ($pagamento && $pagamento->status === 'estornado')];
    }

    /**
     * 👉 FUNÇÃO AUXILIAR: Remove os pontos do usuário caso ele cancele a reserva paga
     */
    public function reverterPontosDeFidelidade(Agendamento $agendamento)
    {
        $pontosGanhosNessaTransacao = DB::table('historico_pontos')
            ->where('agendamento_id', $agendamento->id)
            ->where('tipo', 'ganho')
            ->sum('quantidade');

        if ($pontosGanhosNessaTransacao > 0) {
            DB::table('pontos_usuario_estabelecimento')
                ->where('usuario_id', $agendamento->usuario_id)
                ->where('estabelecimento_id', $agendamento->estabelecimento_id)
                ->decrement('total_pontos', $pontosGanhosNessaTransacao);

            DB::table('historico_pontos')->insert([
                'usuario_id'         => $agendamento->usuario_id,
                'estabelecimento_id' => $agendamento->estabelecimento_id,
                'agendamento_id'     => $agendamento->id,
                'tipo'               => 'perda',
                'descricao'          => 'Estorno de pontos por cancelamento do cliente',
                'quantidade'         => $pontosGanhosNessaTransacao,
                'created_at'         => now(),
            ]);
        }
    }

    /**
     * 👉 REPASSE COM DESCONTO DO SALDO DEVEDOR
     */
    public function repassarSaldoPixProvedor($providerId, $valorEspecifico = null)
    {
        $provider = DB::table('providers')->where('id', $providerId)->first();

        if (!$provider || $provider->saldo <= 0 || !$provider->pix_key) {
            return false; 
        }

        $valorRepasseBruto = $valorEspecifico ? (float) $valorEspecifico : $provider->saldo;

        if ($valorRepasseBruto > $provider->saldo) {
            throw new \Exception("O valor solicitado (R$ {$valorRepasseBruto}) é maior que o saldo disponível na carteira.");
        }

        // Busca o estabelecimento associado para checar a dívida
        $estabelecimento = DB::table('estabelecimento_usuario')
            ->join('estabelecimentos', 'estabelecimento_usuario.estabelecimento_id', '=', 'estabelecimentos.id')
            ->where('estabelecimento_usuario.usuario_id', $provider->user_id)
            ->select('estabelecimentos.id', 'estabelecimentos.saldo_devedor')
            ->first();

        $saldoDevedor = $estabelecimento ? (float) $estabelecimento->saldo_devedor : 0;
        $valorLiquidoRepasse = $valorRepasseBruto;
        $valorDescontadoDaDivida = 0;

        // Calcula o desconto da dívida
        if ($saldoDevedor > 0) {
            if ($valorRepasseBruto >= $saldoDevedor) {
                $valorDescontadoDaDivida = $saldoDevedor;
                $valorLiquidoRepasse = $valorRepasseBruto - $saldoDevedor;
            } else {
                // Se a dívida for maior que o repasse, pega todo o repasse para pagar parte da dívida
                $valorDescontadoDaDivida = $valorRepasseBruto;
                $valorLiquidoRepasse = 0; 
            }
        }

        // Só faz a transferência PIX se sobrou algum valor após descontar a dívida
        if ($valorLiquidoRepasse > 0) {
            $payloadTransfer = [
                'value' => $valorLiquidoRepasse,
                'pixAddressKey' => $provider->pix_key,
                'pixAddressKeyType' => $provider->tipo_chave_pix ?? 'EVP', 
                'description' => 'Repasse WaitLess - Dívidas descontadas se aplicável',
            ];

            $response = Http::withHeaders([
                'access_token' => $provider->asaas_api_key, 
            ])->post(config('services.asaas.url') . '/transfers', $payloadTransfer);

            if (!$response->successful()) {
                Log::error("Falha ao transferir PIX", $response->json());
                return false;
            }
        }

        // Atualiza os saldos no banco de dados usando Transaction para segurança
        DB::transaction(function () use ($providerId, $valorRepasseBruto, $estabelecimento, $valorDescontadoDaDivida) {
            // Desconta do saldo total local da carteira do provider (inclui o que foi pra divida e pro PIX)
            DB::table('providers')->where('id', $providerId)->decrement('saldo', $valorRepasseBruto);
            
            // Se houve desconto de dívida, abate o valor do saldo_devedor do estabelecimento
            if ($estabelecimento && $valorDescontadoDaDivida > 0) {
                DB::table('estabelecimentos')
                    ->where('id', $estabelecimento->id)
                    ->decrement('saldo_devedor', $valorDescontadoDaDivida);
            }
        });

        Log::info("Repasse para Provider {$providerId}. Solicitado: {$valorRepasseBruto}. Retido para dívida: {$valorDescontadoDaDivida}. Enviado PIX: {$valorLiquidoRepasse}");

        /* 
           IMPORTANTE: O valor retido ($valorDescontadoDaDivida) continua fisicamente na subconta Asaas do Lojista. 
           Para a plataforma WaitLess realmente "pegar" esse dinheiro de volta para a conta principal, 
           você precisará criar um script ou job futuro que faça uma transferência da Subconta para a Carteira Principal do Asaas.
        */

        return true;
    }

    public function enviarEmailNotificacao($agendamento, $statusPagamento, $linkAsaas = null, $pin = null)
    {
        $isAgendamento = $agendamento instanceof Agendamento;
        $colunaBuscaId = $isAgendamento ? 'agendamento_id' : 'aluguel_id';

        $cliente = DB::table('users')->where('id', $isAgendamento ? $agendamento->usuario_id : $agendamento->locatario_id)->first();
        if (!$cliente || !$cliente->email) return;

        $estabelecimentoNome = DB::table('estabelecimentos')->where('id', $agendamento->estabelecimento_id)->value('nome') ?? 'WaitLess';
        
        $dono = DB::table('estabelecimento_usuario')
            ->join('users', 'estabelecimento_usuario.usuario_id', '=', 'users.id')
            ->where('estabelecimento_usuario.estabelecimento_id', $agendamento->estabelecimento_id)
            ->whereIn('users.papel', ['admin', 'proprietario', 'socio'])
            ->select('users.email', 'users.name')
            ->first();

        $nomeServico = $isAgendamento ? ($agendamento->servico->nome ?? 'Serviço') : 'Locação/Reserva';
        $dataStr = date('d/m/Y', strtotime($isAgendamento ? $agendamento->data_agendamento : $agendamento->data_inicio));
        $horaStr = substr($isAgendamento ? $agendamento->hora_agendamento : $agendamento->hora_inicio, 0, 5);
        $valorBrutoStr = number_format($agendamento->valor_final ?? $agendamento->valor_total, 2, ',', '.');
        $pinSeguranca = $pin ?? $agendamento->codigo_verificacao;

        // A tabela "itens_aluguel" não tem colunas "produto_id"/"agendamento_id"
        // — produtos extras ficam vinculados diretamente na tabela "produtos"
        // (ver Mobile\MobileAgendamentoController::checkoutMisto).
        $produtosExtras = DB::table('produtos')
            ->where($colunaBuscaId, $agendamento->id)
            ->select('nome', DB::raw('1 as quantidade'), 'valor_final as valor', 'cor', 'tamanho')
            ->get();

        $textoExtras = "";
        if ($produtosExtras->isNotEmpty()) {
            $textoExtras .= "\n🛍️ Itens Adicionais Inclusos no Pedido:\n";
            foreach ($produtosExtras as $extra) {
                $detalhes = [];
                if (!empty($extra->cor)) $detalhes[] = "Cor: {$extra->cor}";
                if (!empty($extra->tamanho)) $detalhes[] = "Tam: {$extra->tamanho}";
                
                $detalhesStr = count($detalhes) > 0 ? " (" . implode(' | ', $detalhes) . ")" : "";
                $valorFormatado = number_format($extra->valor, 2, ',', '.');
                
                $textoExtras .= " • {$extra->quantidade}x {$extra->nome}{$detalhesStr} - R$ {$valorFormatado}\n";
            }
            $textoExtras .= "\n";
        }

        $assuntoCliente = "Atualização da sua reserva - {$estabelecimentoNome}";
        $mensagemCliente = "Olá, {$cliente->name}!\n\n";

        switch ($statusPagamento) {
            case 'pendente':
                $assuntoCliente = "Ação Necessária: Pague sua reserva na {$estabelecimentoNome}";
                $mensagemCliente .= "Sua reserva de '{$nomeServico}' no dia {$dataStr} às {$horaStr} foi separada com sucesso!\n";
                $mensagemCliente .= $textoExtras;
                $mensagemCliente .= "Para garantir sua vaga, efetue o pagamento do Total de R$ {$valorBrutoStr} pelo link seguro oficial abaixo:\n";
                $mensagemCliente .= "👉 {$linkAsaas}\n\n";
                if ($pinSeguranca) $mensagemCliente .= "Seu PIN de segurança no balcão será: {$pinSeguranca}\n\n";
                break;

            case 'pago':
                $assuntoCliente = "Pagamento Confirmado! Reserva Garantida";
                $mensagemCliente .= "Recebemos o seu pagamento Total de R$ {$valorBrutoStr} referente à '{$nomeServico}' no dia {$dataStr} às {$horaStr}.\n";
                $mensagemCliente .= $textoExtras;
                $mensagemCliente .= "Sua reserva está 100% confirmada. Te esperamos no local!\n\n";
                if ($pinSeguranca) $mensagemCliente .= "Guarde o seu PIN de atendimento: {$pinSeguranca}\n\n";
                break;

            case 'local':
                $assuntoCliente = "Reserva Confirmada (Pagar no Local)";
                $mensagemCliente .= "Sua vaga para '{$nomeServico}' no dia {$dataStr} às {$horaStr} está confirmada!\n";
                $mensagemCliente .= $textoExtras;
                $mensagemCliente .= "Você optou por pagar o valor Total de R$ {$valorBrutoStr} diretamente no estabelecimento. Chegue com alguns minutos de antecedência.\n\n";
                if ($pinSeguranca) $mensagemCliente .= "Seu PIN de atendimento é: {$pinSeguranca}\n\n";
                break;
        }
        $mensagemCliente .= "Equipe WaitLess";

        $assuntoDono = "";
        $mensagemDono = "";

        if ($dono && in_array($statusPagamento, ['local', 'pago'])) {
            $mensagemDono = "Olá, {$dono->name}. O sistema WaitLess tem uma nova atualização para você:\n\n";

            if ($statusPagamento === 'local') {
                $assuntoDono = "💸 Nova Reserva (Pagar no Balcão) - {$dataStr}";
                $mensagemDono .= "O cliente {$cliente->name} acabou de agendar '{$nomeServico}' para o dia {$dataStr} às {$horaStr}.\n";
                $mensagemDono .= $textoExtras;
                $mensagemDono .= "Método escolhido: Pagar no Local.\n";
                $mensagemDono .= "Valor Total a ser cobrado no balcão: R$ {$valorBrutoStr}\n\n";
            } 
            elseif ($statusPagamento === 'pago') {
                $assuntoDono = "✅ Pagamento Recebido via App - {$dataStr}";
                $mensagemDono .= "Excelente notícia! O cliente {$cliente->name} pagou online R$ {$valorBrutoStr} pela reserva de '{$nomeServico}' no dia {$dataStr} às {$horaStr}.\n";
                $mensagemDono .= $textoExtras;
                $mensagemDono .= "O valor já está protegido na sua carteira Asaas (Custódia). Ele será liberado para saque assim que o serviço for concluído no painel usando o PIN do cliente.\n\n";
            }

            $mensagemDono .= "Acesse o painel para mais detalhes.\nSucesso nas vendas!";
        }

        try {
            Mail::raw($mensagemCliente, function ($mail) use ($cliente, $assuntoCliente) {
                $mail->to($cliente->email)->subject($assuntoCliente);
            });

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