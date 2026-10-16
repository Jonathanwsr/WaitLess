<?php

namespace Tests\Feature;

use App\Models\Assinatura;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AssinaturaPagamentoTest extends TestCase
{
    use DatabaseTransactions;

    private string $formaAtual = 'CREDIT_CARD';

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.asaas.url' => 'https://asaas.teste/v3', 'services.asaas.key' => 'chave']);
    }

    private function assinante(): array
    {
        $user = User::create(['name' => 'Maria', 'email' => uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'user',
            'plano_assinatura' => 'premium', 'plano_expira_em' => now()->addMonth(), 'cpf_cnpj' => '52998224725', 'asaas_customer_id' => 'cus_1']);
        $a = Assinatura::create(['user_id' => $user->id, 'nome_plano' => 'premium', 'tipo_publico' => 'cliente', 'valor_mensal' => 110,
            'gateway_assinatura_id' => 'sub_1', 'status' => 'ativa', 'data_inicio' => now()->subMonth(), 'data_vencimento' => now()->addMonth()]);

        return [$user, $a];
    }

    private function fingirAsaas(): void
    {
        Http::fake(function (Request $r) {
            $url = $r->url();
            if (str_ends_with($url, '/subscriptions/sub_1') && $r->method() === 'GET') {
                return Http::response(['id' => 'sub_1', 'billingType' => $this->formaAtual]);
            }
            if (str_ends_with($url, '/subscriptions/sub_1') && $r->method() === 'POST') {
                $this->formaAtual = $r['billingType'];
                return Http::response(['id' => 'sub_1', 'billingType' => $r['billingType']]);
            }
            if (str_contains($url, '/subscriptions/sub_1/payments')) {
                return Http::response(['data' => [
                    ['id' => 'pay_old', 'subscription' => 'sub_1', 'status' => 'RECEIVED', 'value' => 110, 'dueDate' => '2026-09-18', 'paymentDate' => '2026-09-18',
                        'billingType' => 'CREDIT_CARD', 'creditCard' => ['creditCardNumber' => '8020', 'creditCardBrand' => 'MASTERCARD'],
                        'transactionReceiptUrl' => 'https://asaas.teste/r/pay_old', 'invoiceUrl' => 'https://asaas.teste/i/pay_old'],
                    ['id' => 'pay_new', 'subscription' => 'sub_1', 'status' => 'PENDING', 'value' => 110, 'dueDate' => '2026-10-18',
                        'billingType' => 'PIX', 'invoiceUrl' => 'https://asaas.teste/i/pay_new'],
                ]]);
            }
            if (str_ends_with($url, '/payments/pay_new')) {
                return Http::response(['id' => 'pay_new', 'subscription' => 'sub_1', 'status' => 'PENDING', 'value' => 110, 'dueDate' => '2026-10-18', 'billingType' => 'PIX', 'invoiceUrl' => 'https://asaas.teste/i/pay_new']);
            }
            if (str_ends_with($url, '/payments/pay_alheio')) {
                return Http::response(['id' => 'pay_alheio', 'subscription' => 'sub_OUTRA', 'status' => 'PENDING', 'billingType' => 'PIX']);
            }
            if (str_ends_with($url, '/payments/pay_new/pixQrCode')) {
                return Http::response(['encodedImage' => 'QUJD', 'payload' => '00020101PIXCOPIAECOLA', 'expirationDate' => '2026-10-19']);
            }
            if (str_ends_with($url, '/subscriptions/sub_1/creditCard')) {
                return Http::response(['id' => 'sub_1', 'creditCard' => ['creditCardNumber' => '1111', 'creditCardBrand' => 'VISA']]);
            }

            return Http::response(['errors' => [['description' => 'rota não simulada: ' . $url]]], 404);
        });
    }

    public function test_mostra_forma_padrao_e_faturas_reais_do_asaas(): void
    {
        [$user] = $this->assinante();
        $this->fingirAsaas();

        $r = $this->actingAs($user)->getJson('/minha-assinatura/pagamento')->assertOk();
        $r->assertJsonPath('forma.tipo', 'CREDIT_CARD')
            ->assertJsonPath('forma.cartao.bandeira', 'Mastercard')
            ->assertJsonPath('forma.cartao.final', '8020');

        $faturas = $r->json('faturas');
        $this->assertSame('pay_new', $faturas[0]['id']); // mais recente primeiro
        $this->assertSame('Pendente', $faturas[0]['status']);
        $this->assertTrue($faturas[0]['em_aberto']);
        $this->assertSame('Pago', $faturas[1]['status']);
        $this->assertSame('https://asaas.teste/r/pay_old', $faturas[1]['pdf']);
        $this->assertSame(110.0, (float) $faturas[1]['valor']);

        // O app usa o mesmo endpoint.
        Sanctum::actingAs($user);
        $this->getJson('/api/mobile/assinatura/pagamento')->assertOk()->assertJsonPath('forma.cartao.final', '8020');
    }

    public function test_fatura_em_aberto_mostra_pix_e_nao_abre_cobranca_de_outra_assinatura(): void
    {
        [$user] = $this->assinante();
        $this->fingirAsaas();

        $this->actingAs($user)->getJson('/minha-assinatura/pagamento/faturas/pay_new')->assertOk()
            ->assertJsonPath('pix.copia_e_cola', '00020101PIXCOPIAECOLA')
            ->assertJsonPath('pix.imagem', 'QUJD');

        $this->actingAs($user)->getJson('/minha-assinatura/pagamento/faturas/pay_alheio')->assertNotFound();
    }

    public function test_salvar_cartao_atualiza_no_asaas_e_guarda_so_bandeira_final_e_validade(): void
    {
        [$user, $a] = $this->assinante();
        $this->formaAtual = 'PIX';
        $this->fingirAsaas();

        $this->actingAs($user)->postJson('/minha-assinatura/pagamento/cartao', [
            'cartao' => ['numero' => '4111 1111 1111 1111', 'titular' => 'MARIA SILVA', 'mes' => 12, 'ano' => 30, 'cvv' => '123'],
            'titular' => ['cpf_cnpj' => '52998224725', 'cep' => '55600000', 'numero' => '10'],
        ])->assertOk()->assertJsonPath('forma.cartao.bandeira', 'Visa');

        $a->refresh();
        $this->assertSame(['Visa', '1111', '12/2030', 'CREDIT_CARD'], [$a->cartao_bandeira, $a->cartao_final, $a->cartao_validade, $a->metodo_pagamento]);

        // Estava em Pix: primeiro mudou para cartão, depois enviou o cartão (sem cobrar agora).
        Http::assertSent(fn (Request $r) => $r->method() === 'POST' && str_ends_with($r->url(), '/subscriptions/sub_1') && $r['billingType'] === 'CREDIT_CARD');
        Http::assertSent(fn (Request $r) => $r->method() === 'PUT' && str_ends_with($r->url(), '/subscriptions/sub_1/creditCard')
            && $r['creditCard']['number'] === '4111111111111111' && $r['creditCard']['ccv'] === '123' && $r['creditCardHolderInfo']['postalCode'] === '55600000');

        // Cartão vencido é recusado antes de ir ao Asaas.
        $this->actingAs($user)->postJson('/minha-assinatura/pagamento/cartao', [
            'cartao' => ['numero' => '4111111111111111', 'titular' => 'MARIA', 'mes' => 1, 'ano' => (int) date('y'), 'cvv' => '123'],
            'titular' => ['cpf_cnpj' => '52998224725', 'cep' => '55600000', 'numero' => '10'],
        ])->assertStatus(now()->month > 1 ? 422 : 200);
    }

    public function test_passar_a_pagar_por_boleto_e_sem_assinatura_nao_mostra_nada(): void
    {
        [$user, $a] = $this->assinante();
        $this->fingirAsaas();

        $this->actingAs($user)->postJson('/minha-assinatura/pagamento/forma', ['forma' => 'boleto'])->assertOk()->assertJsonPath('forma.tipo', 'BOLETO');
        Http::assertSent(fn (Request $r) => $r->method() === 'POST' && str_ends_with($r->url(), '/subscriptions/sub_1') && $r['billingType'] === 'BOLETO' && $r['updatePendingPayments'] === true);
        $this->assertNull($a->fresh()->cartao_final);

        $semPlano = User::create(['name' => 'Ana', 'email' => uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'user', 'plano_assinatura' => 'gratuito']);
        $this->actingAs($semPlano)->getJson('/minha-assinatura/pagamento')->assertOk()->assertJsonPath('tem_assinatura', false);
    }
}
