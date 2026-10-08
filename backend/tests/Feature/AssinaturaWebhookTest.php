<?php

namespace Tests\Feature;

use App\Models\Assinatura;
use App\Models\Estabelecimento;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class AssinaturaWebhookTest extends TestCase
{
    use DatabaseTransactions;

    private function criarAssinaturaPendente(string $plano): array
    {
        $socio = User::create(['name' => 'Socio Assinatura', 'email' => 'assin' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'socio']);
        $assinatura = Assinatura::create([
            'user_id' => $socio->id, 'nome_plano' => $plano, 'tipo_publico' => 'estabelecimento',
            'valor_mensal' => 0, 'gateway_assinatura_id' => 'sub_' . uniqid(), 'status' => 'pendente',
            'data_inicio' => now(), 'data_vencimento' => now()->addDays(7),
        ]);

        return [$socio, $assinatura];
    }

    /**
     * Regressão do bug mais sério encontrado: cobranças de assinatura são
     * geradas pelo Asaas direto da subscription (sem linha em "pagamentos"),
     * então o webhook normal nunca achava nada — nenhum assinante de verdade
     * tinha o plano ativado automaticamente, só via ação manual do admin.
     */
    public function test_webhook_ativa_assinatura_e_concede_pontos_na_primeira_cobranca(): void
    {
        Mail::fake();
        [$socio, $assinatura] = $this->criarAssinaturaPendente('premium-anual');

        $response = $this->postJson('/api/webhook/asaas', [
            'event' => 'PAYMENT_CONFIRMED',
            'payment' => ['id' => 'pay_sub_1', 'subscription' => $assinatura->gateway_assinatura_id],
        ]);

        $response->assertOk();
        $this->assertSame('ativa', $assinatura->fresh()->status);
        $socio->refresh();
        $this->assertSame('premium-anual', $socio->plano_assinatura);
        $this->assertNotNull($socio->plano_expira_em);
        $this->assertTrue($socio->plano_expira_em->isFuture());
        $this->assertSame(600, $socio->pontos_saldo); // premium-anual concede 600 pontos
        $this->assertSame('ACTIVE', $socio->asaas_subscription_status);
    }

    public function test_webhook_nao_concede_pontos_duas_vezes_para_o_mesmo_pagamento(): void
    {
        Mail::fake();
        [$socio, $assinatura] = $this->criarAssinaturaPendente('premium-socio');

        $payload = ['event' => 'PAYMENT_CONFIRMED', 'payment' => ['id' => 'pay_sub_dup', 'subscription' => $assinatura->gateway_assinatura_id]];

        $this->postJson('/api/webhook/asaas', $payload)->assertOk();
        $this->postJson('/api/webhook/asaas', $payload)->assertOk(); // reenvio do mesmo evento (comum em webhooks)

        $this->assertSame(300, $socio->fresh()->pontos_saldo); // premium-socio = 300, só uma vez
    }

    public function test_webhook_processa_renovacao_com_pagamento_diferente_e_soma_pontos_de_novo(): void
    {
        Mail::fake();
        [$socio, $assinatura] = $this->criarAssinaturaPendente('premium-socio');

        $this->postJson('/api/webhook/asaas', [
            'event' => 'PAYMENT_CONFIRMED',
            'payment' => ['id' => 'pay_sub_mes1', 'subscription' => $assinatura->gateway_assinatura_id],
        ])->assertOk();

        $vencimentoAposPrimeiraCobranca = $assinatura->fresh()->data_vencimento;

        $this->postJson('/api/webhook/asaas', [
            'event' => 'PAYMENT_CONFIRMED',
            'payment' => ['id' => 'pay_sub_mes2', 'subscription' => $assinatura->gateway_assinatura_id],
        ])->assertOk();

        $this->assertSame(600, $socio->fresh()->pontos_saldo); // 300 + 300 (duas cobranças diferentes)
        $this->assertTrue($assinatura->fresh()->data_vencimento->greaterThanOrEqualTo($vencimentoAposPrimeiraCobranca));
        $this->assertSame('pay_sub_mes2', $assinatura->fresh()->fatura_id);
    }

    public function test_webhook_sem_assinatura_correspondente_nao_quebra(): void
    {
        $response = $this->postJson('/api/webhook/asaas', [
            'event' => 'PAYMENT_CONFIRMED',
            'payment' => ['id' => 'pay_orfao', 'subscription' => 'sub_nao_existe'],
        ]);

        $response->assertOk();
    }

    private function invocarFracaoTaxa(int $estabelecimentoId): float
    {
        $service = app(\App\Services\PagamentoService::class);
        $metodo = new \ReflectionMethod($service, 'fracaoTaxaPresencial');
        $metodo->setAccessible(true);

        return $metodo->invoke($service, $estabelecimentoId);
    }

    public function test_isencao_de_taxa_presencial_cobre_socio_anual(): void
    {
        $socio = User::create(['name' => 'Socio Isento', 'email' => 'isento' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'socio', 'plano_assinatura' => 'premium-socio-anual', 'plano_expira_em' => now()->addMonth()]);
        $estabelecimento = Estabelecimento::create(['nome' => 'Loja Isenta ' . uniqid()]);
        // tipo "gerente" (não "socio") pra não cair na isenção automática por papel de dono.
        $estabelecimento->proprietarios()->attach($socio->id, ['tipo' => 'gerente']);

        $this->assertSame(0.0, $this->invocarFracaoTaxa($estabelecimento->id));
    }

    public function test_plano_premium_base_reduz_a_taxa_presencial_pela_metade(): void
    {
        $socio = User::create(['name' => 'Socio Premium Base', 'email' => 'base' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'socio', 'plano_assinatura' => 'premium-anual', 'plano_expira_em' => now()->addMonth()]);
        $estabelecimento = Estabelecimento::create(['nome' => 'Loja Reduzida ' . uniqid()]);
        $estabelecimento->proprietarios()->attach($socio->id, ['tipo' => 'gerente']);

        $this->assertSame(0.5, $this->invocarFracaoTaxa($estabelecimento->id));
    }

    public function test_sem_plano_premium_cobra_taxa_cheia(): void
    {
        $socio = User::create(['name' => 'Socio Sem Plano', 'email' => 'semplano' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'socio']);
        $estabelecimento = Estabelecimento::create(['nome' => 'Loja Cheia ' . uniqid()]);
        $estabelecimento->proprietarios()->attach($socio->id, ['tipo' => 'gerente']);

        $this->assertSame(1.0, $this->invocarFracaoTaxa($estabelecimento->id));
    }

    public function test_plano_premium_base_expirado_nao_reduz_a_taxa(): void
    {
        $socio = User::create(['name' => 'Socio Expirado', 'email' => 'expirado' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'socio', 'plano_assinatura' => 'premium-anual', 'plano_expira_em' => now()->subDay()]);
        $estabelecimento = Estabelecimento::create(['nome' => 'Loja Expirada ' . uniqid()]);
        $estabelecimento->proprietarios()->attach($socio->id, ['tipo' => 'gerente']);

        $this->assertSame(1.0, $this->invocarFracaoTaxa($estabelecimento->id));
    }
}
