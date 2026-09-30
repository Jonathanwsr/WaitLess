<?php

namespace App\Services;

use App\Exceptions\CarteiraAsaasNaoConfiguradaException;
use App\Exceptions\CobrancaRecusadaException;
use App\Models\User;
use App\Models\Agendamento;
use App\Models\Pagamento;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail; 

class PagamentoService
{
    /** Parcelamento no cartão sem juros para o cliente (o lojista absorve a taxa do Asaas). */
    public const PARCELAS_MAXIMAS = 12;
    public const PARCELA_MINIMA = 20.00;

    /**
     * Opções de parcelamento válidas para um valor: no máximo 12x e nunca uma
     * parcela abaixo de R$ 20. É a regra única — o mesmo cálculo valida o envio da cobrança.
     */
    public function opcoesParcelamento(float $total): array
    {
        $total = round($total, 2);
        if ($total <= 0) return [];

        $maximo = (int) max(1, min(self::PARCELAS_MAXIMAS, floor($total / self::PARCELA_MINIMA)));

        $opcoes = [];
        for ($n = 1; $n <= $maximo; $n++) {
            $opcoes[] = [
                'parcelas' => $n,
                'valor_parcela' => round($total / $n, 2),
                'total' => $total,
            ];
        }
        return $opcoes;
    }

    public function maximoParcelas(float $total): int
    {
        $opcoes = $this->opcoesParcelamento($total);
        return $opcoes ? end($opcoes)['parcelas'] : 1;
    }

    /** Garante que o cliente exista no Asaas (contas antigas podem não ter o id salvo). */
    public function garantirClienteAsaas(User $user): string
    {
        if ($user->asaas_customer_id) return $user->asaas_customer_id;

        $cpf = preg_replace('/\D/', '', (string) $user->cpf_cnpj);
        if (strlen($cpf) < 11) {
            throw new CobrancaRecusadaException('Complete seu CPF/CNPJ no perfil para pagar online.');
        }

        $resp = Http::withHeaders(['access_token' => config('services.asaas.key')])
            ->post(config('services.asaas.url') . '/customers', array_filter([
                'name' => $user->name,
                'email' => $user->email,
                'cpfCnpj' => $cpf,
                'mobilePhone' => preg_replace('/\D/', '', (string) $user->mobile_phone) ?: null,
                'postalCode' => preg_replace('/\D/', '', (string) $user->postal_code) ?: null,
                'addressNumber' => $user->address_number,
            ]));

        if ($resp->failed() || empty($resp->json('id'))) {
            Log::error('Asaas: falha ao criar cliente', ['user' => $user->id, 'resposta' => $resp->json()]);
            throw new CobrancaRecusadaException($resp->json('errors.0.description') ?: 'Não foi possível validar seus dados de pagamento.');
        }

        $user->forceFill(['asaas_customer_id' => $resp->json('id')])->save();
        return $user->asaas_customer_id;
    }

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
     * 👉 PROCESSA O PAGAMENTO PRESENCIAL (LOCAL) E GERA A DÍVIDA DA TAXA DA PLATAFORMA SE APLICÁVEL
     * Chame esse método no seu Controller quando o cliente escolher "Pagar no local"
     */
    public function processarPagamentoLocal($agendamento)
    {
        $valorTotal = $agendamento->valor_total ?? $agendamento->valor_final;
        $estabelecimentoId = $agendamento->estabelecimento_id;
        $isAgendamento = $agendamento instanceof Agendamento;

        $pin = str_pad(mt_rand(0, 9999), 4, '0', STR_PAD_LEFT);

        // Verifica se NÃO É isento. Se não for, cobra a taxa da plataforma
        if (!$this->isIsentoTaxaPresencial($estabelecimentoId)) {
            $taxaPlataforma = \App\Support\Taxas::sobre($valorTotal);
            
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

    /**
     * @param array|null $cartao  ['numero','titular','mes','ano','cvv'] — quando informado, o cartão é
     *                            cobrado na hora pelo Asaas (sem sair da página). Os dados do cartão
     *                            nunca são gravados aqui.
     */
    public function criarCobrancaAsaas($agendamento, string $metodo, ?string $asaasCustomerId, int $parcelas = 1, ?array $cartao = null, ?User $titular = null, ?string $ip = null)
    {
        $valorTotal = $agendamento->valor_total ?? $agendamento->valor_final;

        $taxaPlataforma = \App\Support\Taxas::sobre($valorTotal);
        $valorLiquidoPrestador = round($valorTotal - $taxaPlataforma, 2);

        // Locação avulsa (Aluguel): `estabelecimento_id` guarda o id do DONO (users.id), então a
        // carteira é a do próprio dono. Para agendamentos, a carteira vem do vínculo com o estabelecimento.
        $provider = null;
        if ($agendamento instanceof \App\Models\Aluguel && $agendamento->proprietario_id) {
            $provider = DB::table('providers')
                ->where('user_id', $agendamento->proprietario_id)
                ->whereNotNull('asaas_wallet_id')
                ->select('id', 'asaas_wallet_id')
                ->first();
        }

        $provider ??= DB::table('providers')
            ->join('users', 'providers.user_id', '=', 'users.id')
            ->join('estabelecimento_usuario', 'users.id', '=', 'estabelecimento_usuario.usuario_id')
            ->where('estabelecimento_usuario.estabelecimento_id', $agendamento->estabelecimento_id)
            ->select('providers.id', 'providers.asaas_wallet_id')
            ->first();

        if (!$provider || !$provider->asaas_wallet_id) {
            throw new CarteiraAsaasNaoConfiguradaException();
        }

        if ($metodo === 'cartao' && $parcelas > $this->maximoParcelas((float) $valorTotal)) {
            throw new CobrancaRecusadaException('Parcelamento acima do permitido para este valor.');
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
                    'percentualValue' => \App\Support\Taxas::parteDoLocalPercentual()
                ]
            ]
        ];

        if ($metodo === 'cartao' && $parcelas > 1) {
            // Parcelado: o Asaas quer o total + nº de parcelas (não `value`).
            unset($payloadAsaas['value']);
            $payloadAsaas['installmentCount'] = $parcelas;
            $payloadAsaas['totalValue'] = round($valorTotal, 2);
        }

        if ($metodo === 'cartao' && $cartao && $titular) {
            $payloadAsaas['creditCard'] = [
                'holderName' => $cartao['titular'],
                'number' => preg_replace('/\D/', '', $cartao['numero']),
                'expiryMonth' => str_pad((string) $cartao['mes'], 2, '0', STR_PAD_LEFT),
                'expiryYear' => strlen((string) $cartao['ano']) === 2 ? '20' . $cartao['ano'] : (string) $cartao['ano'],
                'ccv' => $cartao['cvv'],
            ];
            $payloadAsaas['creditCardHolderInfo'] = array_filter([
                'name' => $titular->name,
                'email' => $titular->email,
                'cpfCnpj' => preg_replace('/\D/', '', (string) $titular->cpf_cnpj),
                'postalCode' => preg_replace('/\D/', '', (string) $titular->postal_code),
                'addressNumber' => $titular->address_number,
                'mobilePhone' => preg_replace('/\D/', '', (string) $titular->mobile_phone) ?: null,
            ]);
            $payloadAsaas['remoteIp'] = $ip ?: request()->ip();
        }

        $response = Http::withHeaders([
            'access_token' => config('services.asaas.key'), 
        ])->post(config('services.asaas.url') . '/payments', $payloadAsaas);

        if ($response->failed()) {
            // Nunca logar o payload: contém o cartão.
            Log::error("Erro Asaas Service", ['resposta' => $response->json(), 'metodo' => $metodo]);
            if ($metodo === 'cartao' && $response->status() === 400) {
                throw new CobrancaRecusadaException($response->json('errors.0.description') ?: 'Cartão recusado. Confira os dados ou use outro cartão.');
            }
            throw new \Exception('Falha na comunicação com o gateway de pagamento.');
        }

        $asaasPayment = $response->json();
        $cartaoAprovado = $metodo === 'cartao' && $cartao && in_array($asaasPayment['status'] ?? '', ['CONFIRMED', 'RECEIVED'], true);
        $isAgendamento = $agendamento instanceof Agendamento;

        $novoPagamento = Pagamento::create([
            'usuario_id'           => $isAgendamento ? $agendamento->usuario_id : $agendamento->locatario_id,
            // Locação avulsa: o "estabelecimento" do aluguel é o dono (users.id); só grava se ele tiver um local de verdade.
            'estabelecimento_id'   => $isAgendamento
                ? $agendamento->estabelecimento_id
                : DB::table('estabelecimento_usuario')->where('usuario_id', $agendamento->proprietario_id)->value('estabelecimento_id'),
            'agendamento_id'       => $isAgendamento ? $agendamento->id : null,
            'aluguel_id'           => $isAgendamento ? null : $agendamento->id,
            'gateway_pagamento'    => 'Asaas',
            'id_transacao_gateway' => $asaasPayment['id'],
            'valor'                => $valorTotal,
            'taxa'                 => $taxaPlataforma,
            'valor_liquido'        => $valorLiquidoPrestador,
            'status'               => $cartaoAprovado ? 'pago' : 'pendente',
            'metodo_pagamento'     => $metodo,
        ]);

        $pin = str_pad(mt_rand(0, 9999), 4, '0', STR_PAD_LEFT);

        if ($cartaoAprovado) {
            if ($isAgendamento) {
                $agendamento->update(['status_pagamento' => 'pago', 'status' => 'confirmado', 'codigo_verificacao' => $pin, 'pagamento_id' => $novoPagamento->id]);
            } else {
                $agendamento->update(['status' => 'confirmado', 'pagamento_id' => $novoPagamento->id]);
            }
        } elseif ($isAgendamento) {
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

        $this->enviarEmailNotificacao($agendamento, $cartaoAprovado ? 'pago' : 'pendente', $asaasPayment['invoiceUrl'], $pin);

        return [
            'status'      => 'success',
            'payment_id'  => $asaasPayment['id'],
            'pix_qr_code' => $asaasPayment['pixQrCode'] ?? null,
            'invoice_url' => $asaasPayment['invoiceUrl'],
            'aprovado'    => $cartaoAprovado,
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
                $taxaCancelamento = round($valorOriginal * \App\Support\Taxas::cancelamentoTardioPercentual() / 100, 2);
                $valorEstorno = $valorOriginal - $taxaCancelamento;
                $mensagem = "Cancelamento efetuado! Como foi feito a menos de 30 minutos do horário marcado, uma taxa de " . \App\Support\Taxas::cancelamentoTardioPercentual() . "% (R$ " . number_format($taxaCancelamento, 2, ',', '.') . ") foi retida. O restante será devolvido para a forma de pagamento original.";
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
                // historico_pontos.tipo só aceita 'ganho'/'uso' (CHECK constraint) —
                // 'perda' não existe e derrubava todo o cancelamento com erro de banco.
                'tipo'               => 'uso',
                'descricao'          => 'Estorno de pontos por cancelamento do cliente',
                'quantidade'         => $pontosGanhosNessaTransacao,
                'created_at'         => now(),
            ]);
        }
    }

    /**
     * Repasse com desconto do saldo devedor. A regra e o registro de cada tentativa
     * (tabela transferencias_carteira) ficam no CarteiraService; aqui só devolvemos
     * true quando o dinheiro foi aceito pelo Asaas e false quando não foi.
     */
    public function repassarSaldoPixProvedor($providerId, $valorEspecifico = null, string $origem = 'automatico')
    {
        $transferencia = app(\App\Services\Carteira\CarteiraService::class)
            ->repasseSemanal((int) $providerId, $valorEspecifico !== null ? (float) $valorEspecifico : null, $origem);

        return $transferencia !== null && $transferencia->status !== 'falhou';
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
            // Na fila: a confirmação de pagamento não pode ficar esperando o e-mail sair.
            Mail::to($cliente->email)->queue(new \App\Mail\NotificacaoTexto($assuntoCliente, $mensagemCliente));

            if ($dono && $mensagemDono !== "") {
                Mail::to($dono->email)->queue(new \App\Mail\NotificacaoTexto($assuntoDono, $mensagemDono));
            }
        } catch (\Exception $e) {
            Log::error("Erro ao enviar emails de notificação (Brevo): " . $e->getMessage());
        }
    }
}