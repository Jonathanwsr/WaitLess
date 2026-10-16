<?php

namespace App\Services\Assinatura;

use App\Models\Assinatura;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

/**
 * Tela "Pagamento" da assinatura, com dados reais do Asaas:
 * - forma de pagamento padrão (cartão com bandeira/final/validade, Pix ou boleto);
 * - faturas da assinatura (pagas, pendentes, vencidas) com PDF;
 * - pagar uma fatura em aberto: QR Code + copia e cola (Pix) ou linha digitável + PDF (boleto);
 * - trocar o cartão ou passar a pagar por Pix/boleto.
 *
 * Número do cartão e CVV vão direto para o Asaas; aqui fica só bandeira, 4 últimos dígitos e validade.
 */
class PagamentoAssinaturaService
{
    public const STATUS = [
        'RECEIVED' => ['Pago', 'pago'],
        'CONFIRMED' => ['Pago', 'pago'],
        'RECEIVED_IN_CASH' => ['Pago', 'pago'],
        'PENDING' => ['Pendente', 'pendente'],
        'AWAITING_RISK_ANALYSIS' => ['Em análise', 'pendente'],
        'OVERDUE' => ['Vencida', 'vencida'],
        'REFUNDED' => ['Estornada', 'estornada'],
        'REFUND_REQUESTED' => ['Estorno solicitado', 'estornada'],
        'REFUND_IN_PROGRESS' => ['Estornando', 'estornada'],
        'CHARGEBACK_REQUESTED' => ['Contestada', 'vencida'],
        'CHARGEBACK_DISPUTE' => ['Contestada', 'vencida'],
        'DUNNING_REQUESTED' => ['Em cobrança', 'vencida'],
    ];

    public const FORMAS = ['CREDIT_CARD' => 'Cartão de crédito', 'PIX' => 'Pix', 'BOLETO' => 'Boleto', 'UNDEFINED' => 'A definir'];

    private string $url;
    private ?string $key;

    public function __construct()
    {
        $this->url = rtrim((string) config('services.asaas.url'), '/');
        $this->key = config('services.asaas.key');
    }

    private function http()
    {
        return Http::withHeaders(['access_token' => $this->key])->acceptJson()->timeout(20);
    }

    private static function erro($resposta, string $padrao): string
    {
        return $resposta?->json('errors.0.description') ?: $padrao;
    }

    /** Assinatura do usuário que tem cobrança no Asaas (a mais recente). */
    public function assinaturaDe(User $user): ?Assinatura
    {
        return Assinatura::where('user_id', $user->id)
            ->whereIn('status', ['ativa', 'pendente', 'atrasada'])
            ->whereNotNull('gateway_assinatura_id')
            ->latest()
            ->first();
    }

    /** Tudo da tela: forma padrão + faturas. */
    public function painel(Assinatura $a): array
    {
        $faturas = $this->faturas($a);

        return [
            'forma' => $this->forma($a, $faturas['cartao_da_ultima_cobranca'] ?? null),
            'faturas' => $faturas['lista'],
            'erro' => $faturas['erro'],
        ];
    }

    /** Forma de pagamento padrão da assinatura (o Asaas é a fonte; o resumo do cartão vem do nosso registro). */
    public function forma(Assinatura $a, ?array $cartaoDaCobranca = null): array
    {
        $tipo = strtoupper((string) $a->metodo_pagamento) ?: null;
        $sub = $this->http()->get("{$this->url}/subscriptions/{$a->gateway_assinatura_id}");
        if ($sub->successful() && $sub->json('billingType')) {
            $tipo = $sub->json('billingType');
            if ($tipo !== strtoupper((string) $a->metodo_pagamento)) {
                $a->forceFill(['metodo_pagamento' => $tipo])->save();
            }
        }
        $tipo = match ($tipo) { 'CREDIT_CARD', 'CARTAO', 'CARTÃO' => 'CREDIT_CARD', 'PIX' => 'PIX', 'BOLETO' => 'BOLETO', default => $tipo ?: 'UNDEFINED' };

        $cartao = null;
        if ($tipo === 'CREDIT_CARD') {
            $cartao = [
                'bandeira' => $a->cartao_bandeira ?? $cartaoDaCobranca['bandeira'] ?? null,
                'final' => $a->cartao_final ?? $cartaoDaCobranca['final'] ?? null,
                'validade' => $a->cartao_validade,
            ];
        }

        return ['tipo' => $tipo, 'rotulo' => self::FORMAS[$tipo] ?? $tipo, 'cartao' => $cartao];
    }

    /** Faturas da assinatura no Asaas, mais recentes primeiro. */
    public function faturas(Assinatura $a, int $limite = 24): array
    {
        $r = $this->http()->get("{$this->url}/subscriptions/{$a->gateway_assinatura_id}/payments", ['limit' => $limite]);
        if ($r->failed()) {
            return ['lista' => [], 'erro' => 'Não conseguimos carregar as faturas agora. Tente de novo em instantes.', 'cartao_da_ultima_cobranca' => null];
        }

        $lista = collect($r->json('data') ?? [])
            ->sortByDesc(fn ($p) => $p['dueDate'] ?? '')
            ->values();
        $comCartao = $lista->first(fn ($p) => !empty($p['creditCard']['creditCardNumber']));

        return [
            'erro' => null,
            'cartao_da_ultima_cobranca' => $comCartao ? [
                'bandeira' => self::bandeiraBonita($comCartao['creditCard']['creditCardBrand'] ?? null),
                'final' => substr((string) $comCartao['creditCard']['creditCardNumber'], -4),
            ] : null,
            'lista' => $lista->map(function ($p) {
                [$rotulo, $tom] = self::STATUS[$p['status'] ?? ''] ?? [ucfirst(strtolower((string) ($p['status'] ?? ''))), 'pendente'];
                $pago = $tom === 'pago';
                $data = $pago && !empty($p['paymentDate']) ? $p['paymentDate'] : ($p['dueDate'] ?? null);

                return [
                    'id' => $p['id'],
                    'data' => $data,
                    'data_formatada' => $data ? Carbon::parse($data)->locale('pt_BR')->translatedFormat('d \d\e M. \d\e Y') : null,
                    'vencimento' => $p['dueDate'] ?? null,
                    'valor' => (float) ($p['value'] ?? 0),
                    'status' => $rotulo,
                    'tom' => $tom,
                    'forma' => self::FORMAS[$p['billingType'] ?? ''] ?? null,
                    'tipo' => $p['billingType'] ?? null,
                    'em_aberto' => in_array($p['status'] ?? null, ['PENDING', 'OVERDUE'], true),
                    // PDF: comprovante quando pago; boleto quando for boleto; senão a fatura do Asaas.
                    'pdf' => $pago ? ($p['transactionReceiptUrl'] ?? $p['invoiceUrl'] ?? null) : ($p['bankSlipUrl'] ?? $p['invoiceUrl'] ?? null),
                    'fatura' => $p['invoiceUrl'] ?? null,
                ];
            })->all(),
        ];
    }

    /** Como pagar uma fatura em aberto: Pix (QR + copia e cola) ou boleto (linha digitável + PDF). */
    public function pagar(Assinatura $a, string $paymentId): array
    {
        $p = $this->http()->get("{$this->url}/payments/{$paymentId}");
        // Só faturas desta assinatura (evita abrir cobranças de outra pessoa trocando o id).
        abort_unless($p->successful() && $p->json('subscription') === $a->gateway_assinatura_id, 404, 'Fatura não encontrada.');
        abort_unless(in_array($p->json('status'), ['PENDING', 'OVERDUE'], true), 422, 'Esta fatura não está em aberto.');

        $tipo = $p->json('billingType');
        $saida = ['id' => $paymentId, 'valor' => (float) $p->json('value'), 'vencimento' => $p->json('dueDate'), 'tipo' => $tipo, 'fatura' => $p->json('invoiceUrl'), 'pix' => null, 'boleto' => null];

        // Pix sempre pode ser gerado; boleto quando a fatura é boleto (ou indefinida).
        if (in_array($tipo, ['PIX', 'UNDEFINED', 'BOLETO'], true)) {
            $qr = $this->http()->get("{$this->url}/payments/{$paymentId}/pixQrCode");
            if ($qr->successful()) {
                $saida['pix'] = ['imagem' => $qr->json('encodedImage'), 'copia_e_cola' => $qr->json('payload'), 'expira_em' => $qr->json('expirationDate')];
            }
        }
        if (in_array($tipo, ['BOLETO', 'UNDEFINED'], true)) {
            $linha = $this->http()->get("{$this->url}/payments/{$paymentId}/identificationField");
            $saida['boleto'] = [
                'linha_digitavel' => $linha->successful() ? $linha->json('identificationField') : null,
                'pdf' => $p->json('bankSlipUrl'),
            ];
        }

        return $saida;
    }

    /** Passa a pagar por Pix ou boleto (as faturas em aberto também mudam). */
    public function usarPixOuBoleto(Assinatura $a, string $tipo): void
    {
        $r = $this->http()->post("{$this->url}/subscriptions/{$a->gateway_assinatura_id}", ['billingType' => $tipo, 'updatePendingPayments' => true]);
        if ($r->failed()) {
            throw ValidationException::withMessages(['forma' => self::erro($r, 'Não foi possível mudar a forma de pagamento agora.')]);
        }
        $a->forceFill(['metodo_pagamento' => $tipo, 'cartao_bandeira' => null, 'cartao_final' => null, 'cartao_validade' => null])->save();
    }

    /**
     * Cadastra/atualiza o cartão da assinatura no Asaas (sem cobrar agora). Se a assinatura estava em
     * Pix/boleto, passa a ser no cartão. Guarda aqui só bandeira, final e validade.
     *
     * @param array{numero:string,titular:string,mes:int|string,ano:int|string,cvv:string} $cartao
     * @param array{cpf_cnpj?:string,cep?:string,numero?:string,telefone?:string} $titular
     */
    public function usarCartao(Assinatura $a, User $user, array $cartao, array $titular, ?string $ip): array
    {
        $numero = preg_replace('/\D/', '', $cartao['numero']);
        $ano = strlen((string) $cartao['ano']) === 2 ? '20' . $cartao['ano'] : (string) $cartao['ano'];
        $mes = str_pad((string) $cartao['mes'], 2, '0', STR_PAD_LEFT);
        if (Carbon::createFromDate((int) $ano, (int) $mes, 1)->endOfMonth()->isPast()) {
            throw ValidationException::withMessages(['cartao.mes' => 'Este cartão está vencido.']);
        }

        $dadosCartao = ['holderName' => $cartao['titular'], 'number' => $numero, 'expiryMonth' => $mes, 'expiryYear' => $ano, 'ccv' => (string) $cartao['cvv']];
        $titularAsaas = array_filter([
            'name' => $cartao['titular'] ?: $user->name,
            'email' => $user->email,
            'cpfCnpj' => preg_replace('/\D/', '', (string) ($titular['cpf_cnpj'] ?? $user->cpf_cnpj)),
            'postalCode' => preg_replace('/\D/', '', (string) ($titular['cep'] ?? $user->postal_code)),
            'addressNumber' => $titular['numero'] ?? $user->address_number,
            'mobilePhone' => preg_replace('/\D/', '', (string) ($titular['telefone'] ?? $user->mobile_phone ?? $user->telefone)) ?: null,
        ]);
        if (empty($titularAsaas['cpfCnpj']) || empty($titularAsaas['postalCode']) || empty($titularAsaas['addressNumber'])) {
            throw ValidationException::withMessages(['titular' => 'Informe CPF/CNPJ, CEP e número do endereço do titular do cartão.']);
        }

        // Se a assinatura não é no cartão, primeiro muda a forma de pagamento.
        $sub = $this->http()->get("{$this->url}/subscriptions/{$a->gateway_assinatura_id}");
        if ($sub->successful() && $sub->json('billingType') !== 'CREDIT_CARD') {
            $troca = $this->http()->post("{$this->url}/subscriptions/{$a->gateway_assinatura_id}", ['billingType' => 'CREDIT_CARD', 'updatePendingPayments' => true]);
            if ($troca->failed()) {
                throw ValidationException::withMessages(['cartao' => self::erro($troca, 'Não foi possível mudar para cartão agora.')]);
            }
        }

        // Atualiza o cartão da assinatura sem gerar cobrança agora (as próximas usam este cartão).
        $r = $this->http()->put("{$this->url}/subscriptions/{$a->gateway_assinatura_id}/creditCard", [
            'creditCard' => $dadosCartao,
            'creditCardHolderInfo' => $titularAsaas,
            'remoteIp' => $ip ?: request()->ip(),
        ]);
        if ($r->failed()) {
            Log::info('Asaas recusou o cartão da assinatura: ' . $r->body());
            throw ValidationException::withMessages(['cartao' => self::erro($r, 'O cartão foi recusado. Confira os dados ou use outro cartão.')]);
        }

        $resumo = [
            'metodo_pagamento' => 'CREDIT_CARD',
            'cartao_bandeira' => self::bandeiraBonita($r->json('creditCard.creditCardBrand')) ?? self::bandeiraPeloNumero($numero),
            'cartao_final' => substr($numero, -4),
            'cartao_validade' => "{$mes}/{$ano}",
        ];
        $a->forceFill($resumo)->save();

        return $resumo;
    }

    /** Guarda o resumo do cartão usado ao assinar (o cartão em si fica no Asaas). */
    public static function registrarCartaoAoAssinar(Assinatura $a, ?array $cartao): void
    {
        if (!$cartao || empty($cartao['numero'])) {
            return;
        }
        $numero = preg_replace('/\D/', '', (string) $cartao['numero']);
        $ano = strlen((string) $cartao['ano']) === 2 ? '20' . $cartao['ano'] : (string) $cartao['ano'];
        $a->forceFill([
            'metodo_pagamento' => 'CREDIT_CARD',
            'cartao_bandeira' => self::bandeiraPeloNumero($numero),
            'cartao_final' => substr($numero, -4),
            'cartao_validade' => str_pad((string) $cartao['mes'], 2, '0', STR_PAD_LEFT) . '/' . $ano,
        ])->save();
    }

    public static function bandeiraBonita(?string $marca): ?string
    {
        if (!$marca) {
            return null;
        }
        $m = strtoupper($marca);

        return match (true) {
            str_contains($m, 'MASTER') => 'Mastercard',
            str_contains($m, 'VISA') => 'Visa',
            str_contains($m, 'AMEX') || str_contains($m, 'AMERICAN') => 'American Express',
            str_contains($m, 'ELO') => 'Elo',
            str_contains($m, 'HIPER') => 'Hipercard',
            str_contains($m, 'DINERS') => 'Diners',
            default => ucfirst(strtolower($marca)),
        };
    }

    public static function bandeiraPeloNumero(string $numero): string
    {
        return match (true) {
            (bool) preg_match('/^(4011|4312|4389|4514|4576|5041|5066|5067|509|6277|6362|6363|650|6516|6550)/', $numero) => 'Elo',
            (bool) preg_match('/^(606282|3841)/', $numero) => 'Hipercard',
            (bool) preg_match('/^3[47]/', $numero) => 'American Express',
            (bool) preg_match('/^(5[1-5]|2[2-7])/', $numero) => 'Mastercard',
            (bool) preg_match('/^4/', $numero) => 'Visa',
            (bool) preg_match('/^3(0[0-5]|[68])/', $numero) => 'Diners',
            default => 'Cartão',
        };
    }
}
