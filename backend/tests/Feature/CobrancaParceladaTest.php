<?php

namespace Tests\Feature;

use App\Models\Agendamento;
use App\Models\Cobranca;
use App\Models\CobrancaParcela;
use App\Models\Estabelecimento;
use App\Models\Provider;
use App\Models\Servico;
use App\Models\User;
use App\Services\CobrancaParceladaService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class CobrancaParceladaTest extends TestCase
{
    use DatabaseTransactions;

    private function usuario(string $papel, string $nome, ?string $plano = null): User
    {
        return User::create([
            'name' => $nome, 'email' => strtolower($nome) . uniqid() . '@x.com',
            'password' => Hash::make('senha-teste-123'), 'papel' => $papel,
            'plano_assinatura' => $plano ?? 'gratuito',
            'plano_expira_em' => $plano ? now('America/Sao_Paulo')->addMonth() : null,
            'asaas_customer_id' => 'cus_' . uniqid(),
        ]);
    }

    /** Sócio com o plano informado, um local e (opcionalmente) carteira Asaas. */
    private function socio(?string $plano = 'premium-socio', bool $comCarteira = true): array
    {
        $socio = $this->usuario('socio', 'Socio', $plano);
        $estab = Estabelecimento::create(['nome' => 'Barbearia ' . uniqid()]);
        $estab->proprietarios()->attach($socio->id, ['tipo' => 'socio']);

        if ($comCarteira) {
            Provider::create([
                'user_id' => $socio->id, 'name' => $socio->name, 'email' => $socio->email,
                'document' => (string) random_int(10000000000, 99999999999), 'pix_key_type' => 'CPF', 'pix_key' => '123',
                'person_type' => 'FISICA', 'mobile_phone' => '11999998888', 'postal_code' => '01000000',
                'address' => 'Rua', 'address_number' => '1', 'province' => 'Centro',
                'asaas_api_key' => 'k_' . uniqid(), 'asaas_wallet_id' => 'wal_' . uniqid(),
            ]);
        }

        return [$socio, $estab];
    }

    private function servico(Estabelecimento $estab, float $valor = 90): Servico
    {
        return Servico::create([
            'estabelecimento_id' => $estab->id, 'nome' => 'CORTE', 'tipo_servico' => 'Outro',
            'valor' => $valor, 'duracao_minutos' => 30, 'ativo' => true,
        ]);
    }

    private function vencimentoInicial(): string
    {
        return now('America/Sao_Paulo')->addDays(5)->toDateString();
    }

    private function payload(User $cliente, array $extra = []): array
    {
        return array_merge([
            'cliente_id' => $cliente->id,
            'modo' => 'online',
            'parcelas' => 3,
            'primeiro_vencimento' => $this->vencimentoInicial(),
            'itens' => [],
        ], $extra);
    }

    /** Asaas falso: cada criação de cobrança devolve um id e um link de fatura. */
    private function asaasFalso(): void
    {
        Http::fake(function ($request) {
            $url = $request->url();
            if (str_contains($url, '/payments/') && str_ends_with($url, '/refund')) {
                return Http::response(['id' => 'ref_1'], 200);
            }
            if (str_contains($url, '/payments/') && str_contains($url, 'receiveInCash')) {
                return Http::response(['id' => 'pay_x', 'status' => 'RECEIVED_IN_CASH'], 200);
            }
            if ($request->method() === 'DELETE') {
                return Http::response(['deleted' => true], 200);
            }
            if ($request->method() === 'POST' && str_ends_with($url, '/payments')) {
                $id = 'pay_' . uniqid();

                return Http::response(['id' => $id, 'status' => 'PENDING', 'invoiceUrl' => "https://asaas.test/fatura/{$id}"], 200);
            }

            return Http::response([], 404);
        });
    }

    public function test_so_socio_premium_cria_cobranca(): void
    {
        [$socio, $estab] = $this->socio('gratuito');
        $cliente = $this->usuario('cliente', 'Cliente');
        $servico = $this->servico($estab);

        $this->actingAs($socio)->postJson('/cobrancas', array_merge($this->payload($cliente), [
            'estabelecimento_id' => $estab->id,
            'itens' => [['tipo' => 'servico', 'id' => $servico->id]],
        ]))->assertStatus(403);

        $this->assertSame(0, Cobranca::count());
    }

    public function test_criar_nao_chama_o_asaas_e_fica_aguardando_aceite(): void
    {
        $this->asaasFalso();
        [$socio, $estab] = $this->socio();
        $cliente = $this->usuario('cliente', 'Cliente');
        $servico = $this->servico($estab, 90);

        $resposta = $this->actingAs($socio)->postJson('/cobrancas', array_merge($this->payload($cliente), [
            'estabelecimento_id' => $estab->id,
            'itens' => [['tipo' => 'servico', 'id' => $servico->id]],
        ]));

        $resposta->assertCreated();
        $this->assertSame('aguardando_aceite', $resposta->json('cobranca.status'));
        $this->assertEquals(90, (float) $resposta->json('cobranca.valor_total'));
        Http::assertNotSent(fn ($request) => str_contains($request->url(), '/payments'));
        $this->assertSame(3, CobrancaParcela::where('cobranca_id', $resposta->json('cobranca.id'))->count());
    }

    public function test_parcelas_somam_o_total_com_centavos_na_ultima(): void
    {
        $service = app(CobrancaParceladaService::class);

        $this->assertSame([33.33, 33.33, 33.34], $service->dividirParcelas(100, 3));
        $this->assertEqualsWithDelta(100.00, array_sum($service->dividirParcelas(100, 3)), 0.001);
        $this->assertEqualsWithDelta(200.00, array_sum($service->dividirParcelas(200, 12)), 0.001);
    }

    public function test_aceite_no_online_cria_parcelas_no_asaas_com_split_de_meio_por_cento(): void
    {
        $this->asaasFalso();
        [$socio, $estab] = $this->socio();
        $cliente = $this->usuario('cliente', 'Cliente');
        $servico = $this->servico($estab, 90);

        $criada = $this->actingAs($socio)->postJson('/cobrancas', array_merge($this->payload($cliente), [
            'estabelecimento_id' => $estab->id,
            'itens' => [['tipo' => 'servico', 'id' => $servico->id]],
        ]))->json('cobranca.id');

        $resposta = $this->actingAs($cliente)->postJson("/minhas-cobrancas/{$criada}/aceitar");

        $resposta->assertOk();
        $this->assertSame('aceita', $resposta->json('cobranca.status'));

        Http::assertSentCount(3);
        Http::assertSent(function ($request) {
            if (!str_ends_with($request->url(), '/payments')) {
                return false;
            }
            $corpo = $request->data();

            return $corpo['billingType'] === 'UNDEFINED'
                && $corpo['split'][0]['percentualValue'] === 99.5;
        });

        $parcelas = CobrancaParcela::where('cobranca_id', $criada)->get();
        $this->assertTrue($parcelas->every(fn ($p) => $p->asaas_payment_id && str_contains($p->invoice_url, 'asaas.test')));
    }

    public function test_cliente_de_outra_pessoa_nao_aceita(): void
    {
        $this->asaasFalso();
        [$socio, $estab] = $this->socio();
        $cliente = $this->usuario('cliente', 'Cliente');
        $outro = $this->usuario('cliente', 'Outro');
        $servico = $this->servico($estab);

        $criada = $this->actingAs($socio)->postJson('/cobrancas', array_merge($this->payload($cliente), [
            'estabelecimento_id' => $estab->id,
            'itens' => [['tipo' => 'servico', 'id' => $servico->id]],
        ]))->json('cobranca.id');

        $this->actingAs($outro)->postJson("/minhas-cobrancas/{$criada}/aceitar")->assertForbidden();
        $this->assertSame('aguardando_aceite', Cobranca::find($criada)->status);
    }

    public function test_recusa_cancela_as_parcelas(): void
    {
        [$socio, $estab] = $this->socio();
        $cliente = $this->usuario('cliente', 'Cliente');
        $servico = $this->servico($estab);

        $criada = $this->actingAs($socio)->postJson('/cobrancas', array_merge($this->payload($cliente, ['modo' => 'presencial']), [
            'estabelecimento_id' => $estab->id,
            'itens' => [['tipo' => 'servico', 'id' => $servico->id]],
        ]))->json('cobranca.id');

        $this->actingAs($cliente)->postJson("/minhas-cobrancas/{$criada}/recusar")->assertOk();

        $this->assertSame('recusada', Cobranca::find($criada)->status);
        $this->assertTrue(CobrancaParcela::where('cobranca_id', $criada)->get()->every(fn ($p) => $p->status === 'cancelado'));
    }

    public function test_presencial_dar_baixa_em_todas_quita_a_cobranca(): void
    {
        [$socio, $estab] = $this->socio();
        $cliente = $this->usuario('cliente', 'Cliente');
        $servico = $this->servico($estab, 60);

        $criada = $this->actingAs($socio)->postJson('/cobrancas', array_merge($this->payload($cliente, ['modo' => 'presencial', 'parcelas' => 2]), [
            'estabelecimento_id' => $estab->id,
            'itens' => [['tipo' => 'servico', 'id' => $servico->id]],
        ]))->json('cobranca.id');

        $this->actingAs($cliente)->postJson("/minhas-cobrancas/{$criada}/aceitar")->assertOk();

        $parcelas = CobrancaParcela::where('cobranca_id', $criada)->orderBy('numero')->get();
        $this->actingAs($socio)->postJson("/cobrancas/parcelas/{$parcelas[0]->id}/baixa")->assertOk();
        $this->assertSame('aceita', Cobranca::find($criada)->status);

        $this->actingAs($socio)->postJson("/cobrancas/parcelas/{$parcelas[1]->id}/baixa")->assertOk();

        $cobranca = Cobranca::find($criada);
        $this->assertSame('quitada', $cobranca->status);
        $this->assertTrue($parcelas->fresh()->every(fn ($p) => $p->status === 'pago' && $p->baixa_manual));
    }

    public function test_baixa_online_registra_recebimento_no_asaas(): void
    {
        $this->asaasFalso();
        [$socio, $estab] = $this->socio();
        $cliente = $this->usuario('cliente', 'Cliente');
        $servico = $this->servico($estab, 60);

        $criada = $this->actingAs($socio)->postJson('/cobrancas', array_merge($this->payload($cliente, ['parcelas' => 1]), [
            'estabelecimento_id' => $estab->id,
            'itens' => [['tipo' => 'servico', 'id' => $servico->id]],
        ]))->json('cobranca.id');
        $this->actingAs($cliente)->postJson("/minhas-cobrancas/{$criada}/aceitar")->assertOk();

        $parcela = CobrancaParcela::where('cobranca_id', $criada)->first();
        $this->actingAs($socio)->postJson("/cobrancas/parcelas/{$parcela->id}/baixa")->assertOk();

        Http::assertSent(fn ($r) => str_contains($r->url(), "/payments/{$parcela->asaas_payment_id}/receiveInCash"));
        $this->assertSame('pago', $parcela->fresh()->status);
    }

    public function test_webhook_do_asaas_marca_parcela_como_paga(): void
    {
        $this->asaasFalso();
        [$socio, $estab] = $this->socio();
        $cliente = $this->usuario('cliente', 'Cliente');
        $servico = $this->servico($estab, 60);

        $criada = $this->actingAs($socio)->postJson('/cobrancas', array_merge($this->payload($cliente, ['parcelas' => 1]), [
            'estabelecimento_id' => $estab->id,
            'itens' => [['tipo' => 'servico', 'id' => $servico->id]],
        ]))->json('cobranca.id');
        $this->actingAs($cliente)->postJson("/minhas-cobrancas/{$criada}/aceitar")->assertOk();

        $parcela = CobrancaParcela::where('cobranca_id', $criada)->first();

        $this->postJson('/api/webhook/asaas', [
            'event' => 'PAYMENT_RECEIVED',
            'payment' => ['id' => $parcela->asaas_payment_id, 'paymentDate' => now('America/Sao_Paulo')->toDateString()],
        ])->assertOk();

        $this->assertSame('pago', $parcela->fresh()->status);
        $this->assertSame('quitada', Cobranca::find($criada)->status);
    }

    public function test_reserva_de_outro_cliente_e_recusada(): void
    {
        [$socio, $estab] = $this->socio();
        $cliente = $this->usuario('cliente', 'Cliente');
        $outro = $this->usuario('cliente', 'Outro');
        $servico = $this->servico($estab);

        $reserva = Agendamento::create([
            'usuario_id' => $outro->id, 'estabelecimento_id' => $estab->id, 'servico_id' => $servico->id,
            'data_agendamento' => now('America/Sao_Paulo')->addDays(2)->toDateString(), 'hora_agendamento' => '10:00',
            'status' => 'confirmado', 'status_pagamento' => 'presencial', 'valor_final' => 50,
        ]);

        $this->actingAs($socio)->postJson('/cobrancas', array_merge($this->payload($cliente), [
            'estabelecimento_id' => $estab->id,
            'itens' => [['tipo' => 'reserva', 'id' => $reserva->id]],
        ]))->assertStatus(422)->assertJsonValidationErrors(['itens.0.id']);
    }

    public function test_reserva_do_cliente_entra_com_o_valor_da_reserva(): void
    {
        [$socio, $estab] = $this->socio();
        $cliente = $this->usuario('cliente', 'Cliente');
        $servico = $this->servico($estab);

        $reserva = Agendamento::create([
            'usuario_id' => $cliente->id, 'estabelecimento_id' => $estab->id, 'servico_id' => $servico->id,
            'data_agendamento' => now('America/Sao_Paulo')->addDays(2)->toDateString(), 'hora_agendamento' => '10:00',
            'status' => 'confirmado', 'status_pagamento' => 'presencial', 'valor_final' => 75,
        ]);

        $resposta = $this->actingAs($socio)->postJson('/cobrancas', array_merge($this->payload($cliente, ['modo' => 'presencial', 'parcelas' => 1]), [
            'estabelecimento_id' => $estab->id,
            'itens' => [['tipo' => 'reserva', 'id' => $reserva->id]],
        ]));

        $resposta->assertCreated();
        $this->assertEquals(75, (float) $resposta->json('cobranca.valor_total'));
        $this->assertStringContainsString('Reserva: CORTE', $resposta->json('cobranca.itens.0.descricao'));
    }

    public function test_parcelas_acima_do_limite_do_valor_sao_recusadas(): void
    {
        [$socio, $estab] = $this->socio();
        $cliente = $this->usuario('cliente', 'Cliente');
        $servico = $this->servico($estab, 30);

        $this->actingAs($socio)->postJson('/cobrancas', array_merge($this->payload($cliente, ['modo' => 'presencial', 'parcelas' => 3]), [
            'estabelecimento_id' => $estab->id,
            'itens' => [['tipo' => 'servico', 'id' => $servico->id]],
        ]))->assertStatus(422)->assertJsonValidationErrors(['parcelas']);
    }

    public function test_online_exige_carteira_asaas_configurada(): void
    {
        [$socio, $estab] = $this->socio('premium-socio', false);
        $cliente = $this->usuario('cliente', 'Cliente');
        $servico = $this->servico($estab);

        $this->actingAs($socio)->postJson('/cobrancas', array_merge($this->payload($cliente), [
            'estabelecimento_id' => $estab->id,
            'itens' => [['tipo' => 'servico', 'id' => $servico->id]],
        ]))->assertStatus(422)->assertJsonValidationErrors(['modo']);
    }

    public function test_paginas_de_cobranca_renderizam_para_socio_e_cliente(): void
    {
        [$socio, $estab] = $this->socio();
        $cliente = $this->usuario('cliente', 'Cliente');

        $this->actingAs($socio)->get('/cobrancas')->assertOk();
        $this->actingAs($cliente)->get('/minhas-cobrancas')->assertOk();
        $this->actingAs($socio)->getJson('/cobrancas/opcoes?estabelecimento_id=' . $estab->id)
            ->assertOk()
            ->assertJsonStructure(['servicos', 'reservas', 'funcionarios', 'carteira_configurada', 'taxa_percentual', 'parte_do_socio_percentual']);
    }

    public function test_socio_nao_cobra_local_que_nao_e_seu(): void
    {
        [$socio] = $this->socio();
        [, $outroLocal] = $this->socio();
        $cliente = $this->usuario('cliente', 'Cliente');
        $servico = $this->servico($outroLocal);

        $this->actingAs($socio)->postJson('/cobrancas', array_merge($this->payload($cliente, ['modo' => 'presencial']), [
            'estabelecimento_id' => $outroLocal->id,
            'itens' => [['tipo' => 'servico', 'id' => $servico->id]],
        ]))->assertForbidden();
    }

    public function test_baixa_manual_lanca_meio_por_cento_como_saldo_devedor_uma_unica_vez(): void
    {
        [$socio, $estab] = $this->socio();
        $cliente = $this->usuario('cliente', 'Cliente');
        $servico = $this->servico($estab, 200);

        $criada = $this->actingAs($socio)->postJson('/cobrancas', array_merge($this->payload($cliente, ['modo' => 'presencial', 'parcelas' => 2]), [
            'estabelecimento_id' => $estab->id,
            'itens' => [['tipo' => 'servico', 'id' => $servico->id]],
        ]))->json('cobranca.id');
        $this->assertEquals(0.5, (float) Cobranca::find($criada)->taxa_percentual);
        $this->actingAs($cliente)->postJson("/minhas-cobrancas/{$criada}/aceitar")->assertOk();

        $parcela = CobrancaParcela::where('cobranca_id', $criada)->orderBy('numero')->first();
        $saldoAntes = (float) $estab->fresh()->saldo_devedor;

        $this->actingAs($socio)->postJson("/cobrancas/parcelas/{$parcela->id}/baixa")->assertOk();
        $this->actingAs($socio)->postJson("/cobrancas/parcelas/{$parcela->id}/baixa")->assertStatus(409);

        $this->assertEqualsWithDelta($saldoAntes + 0.50, (float) $estab->fresh()->saldo_devedor, 0.001);
        $this->assertEqualsWithDelta(0.50, (float) $parcela->fresh()->taxa_plataforma, 0.001);
    }

    public function test_parcela_paga_pelo_asaas_registra_a_taxa_sem_criar_divida(): void
    {
        $this->asaasFalso();
        [$socio, $estab] = $this->socio();
        $cliente = $this->usuario('cliente', 'Cliente');
        $servico = $this->servico($estab, 100);

        $criada = $this->actingAs($socio)->postJson('/cobrancas', array_merge($this->payload($cliente, ['parcelas' => 1]), [
            'estabelecimento_id' => $estab->id,
            'itens' => [['tipo' => 'servico', 'id' => $servico->id]],
        ]))->json('cobranca.id');
        $this->actingAs($cliente)->postJson("/minhas-cobrancas/{$criada}/aceitar")->assertOk();
        $parcela = CobrancaParcela::where('cobranca_id', $criada)->first();
        $saldoAntes = (float) $estab->fresh()->saldo_devedor;

        $this->postJson('/api/webhook/asaas', ['event' => 'PAYMENT_RECEIVED', 'payment' => ['id' => $parcela->asaas_payment_id]])->assertOk();

        $this->assertEqualsWithDelta(0.50, (float) $parcela->fresh()->taxa_plataforma, 0.001);
        $this->assertEqualsWithDelta($saldoAntes, (float) $estab->fresh()->saldo_devedor, 0.001);

        $resumo = app(\App\Services\AdminRelatorioService::class)->resumoFinanceiro(now('America/Sao_Paulo')->format('Y-m'));
        $this->assertGreaterThanOrEqual(0.50, $resumo['receita_cobrancas']);
    }
}
