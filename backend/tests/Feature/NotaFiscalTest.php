<?php

namespace Tests\Feature;

use App\Mail\NotaFiscalEmitidaMail;
use App\Models\Assinatura;
use App\Models\Estabelecimento;
use App\Models\NotaFiscal;
use App\Models\Pagamento;
use App\Models\PedidoEntrega;
use App\Models\ProdutoEntrega;
use App\Models\Provider;
use App\Models\User;
use App\Services\NotaFiscalService;
use App\Services\PagamentoService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class NotaFiscalTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.asaas.key' => 'chave_master', 'notas_fiscais.comissao_ativa' => true, 'notas_fiscais.servico_codigo' => '10.05']);
    }

    private function criarSocioComProvider(string $plano = 'premium-socio', bool $expirado = false, bool $configurado = true): array
    {
        $socio = User::create([
            'name' => 'Socio NF', 'email' => 'nf' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'),
            'papel' => 'socio', 'plano_assinatura' => $plano,
            'plano_expira_em' => $expirado ? now()->subDay() : now()->addMonth(),
        ]);

        $estabelecimento = Estabelecimento::create(['nome' => 'Loja NF ' . uniqid()]);
        $estabelecimento->proprietarios()->attach($socio->id, ['tipo' => 'socio']);

        $provider = Provider::create([
            'user_id' => $socio->id, 'name' => $socio->name, 'email' => $socio->email,
            'document' => '11222333000181', 'pix_key_type' => 'CNPJ', 'pix_key' => '123',
            'person_type' => 'JURIDICA', 'mobile_phone' => '11999998888',
            'postal_code' => '01000000', 'address' => 'Rua Teste', 'address_number' => '100', 'province' => 'Centro',
            'asaas_api_key' => 'chave_socio_' . uniqid(), 'asaas_wallet_id' => 'wal_' . uniqid(),
        ]);

        if ($configurado) {
            $provider->update(['nfse_servico_codigo' => '06.01', 'nfse_servico_nome' => 'Barbearia', 'nfse_iss' => 2]);
        }

        return [$socio, $estabelecimento, $provider];
    }

    private function criarCliente(): User
    {
        return User::create([
            'name' => 'Cliente NF', 'email' => 'cli' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'),
            'papel' => 'user', 'cpf_cnpj' => '52998224725',
        ]);
    }

    private function criarPagamento(Estabelecimento $estabelecimento, string $status = 'pago'): Pagamento
    {
        return Pagamento::create([
            'usuario_id' => $this->criarCliente()->id, 'estabelecimento_id' => $estabelecimento->id,
            'valor' => 100, 'valor_total' => 100, 'taxa' => 6, 'valor_liquido' => 94, 'metodo_pagamento' => 'pix',
            'status' => $status, 'id_transacao_gateway' => 'pay_' . uniqid(),
        ]);
    }

    private function fakeAsaas(array $invoice = ['status' => 'SCHEDULED']): void
    {
        // Cada nota recebe um id próprio no Asaas.
        Http::fake(fn (Request $r) => match (true) {
            str_ends_with($r->url(), '/cancel') => Http::response(['status' => 'CANCELED'], 200),
            str_contains($r->url(), '/customers') => Http::response(['data' => [], 'id' => 'cus_' . uniqid()], 200),
            default => Http::response(['id' => 'inv_' . uniqid('', true)] + $invoice, 200),
        });
    }

    private function notas(Pagamento $p): array
    {
        return NotaFiscal::where('pagamento_id', $p->id)->get()->keyBy('tipo')->all();
    }

    public function test_pagamento_gera_nota_da_venda_pelo_socio_e_nota_da_comissao_pela_lokyva(): void
    {
        [, $estabelecimento, $provider] = $this->criarSocioComProvider();
        $pagamento = $this->criarPagamento($estabelecimento);
        $this->fakeAsaas();

        $venda = app(NotaFiscalService::class)->emitirParaPagamento($pagamento);

        $notas = $this->notas($pagamento);
        $this->assertSame('venda', $venda->tipo);
        $this->assertEquals(100, $notas['venda']->valor);
        $this->assertSame('AGENDADA', $notas['venda']->status);

        $this->assertEquals(6, $notas['comissao']->valor);
        $this->assertEquals(100, $notas['comissao']->valor_operacao);
        $this->assertEquals(6, $notas['comissao']->percentual);
        $this->assertSame($provider->user_id, $notas['comissao']->usuario_id);
        $this->assertNotNull($provider->fresh()->asaas_cliente_plataforma_id);

        // A venda sai pela subconta do sócio, com o cliente da subconta e a configuração fiscal dele.
        Http::assertSent(fn (Request $r) => str_ends_with($r->url(), '/invoices')
            && $r->header('access_token')[0] === $provider->asaas_api_key
            && $r['value'] == 100 && isset($r['customer']) && !isset($r['payment'])
            && $r['municipalServiceCode'] === '06.01' && $r['taxes']['iss'] == 2);

        // A comissão sai pela conta principal, só pelo valor da taxa.
        Http::assertSent(fn (Request $r) => str_ends_with($r->url(), '/invoices')
            && $r->header('access_token')[0] === 'chave_master'
            && $r['value'] == 6 && $r['municipalServiceCode'] === '10.05');
    }

    public function test_socio_fora_do_premium_recebe_so_a_nota_da_comissao(): void
    {
        [, $estabelecimento] = $this->criarSocioComProvider('premium-anual');
        $pagamento = $this->criarPagamento($estabelecimento);
        $this->fakeAsaas();

        $this->assertNull(app(NotaFiscalService::class)->emitirParaPagamento($pagamento));
        $this->assertSame(['comissao'], array_keys($this->notas($pagamento)));
    }

    public function test_premium_expirado_tambem_recebe_so_a_comissao(): void
    {
        [, $estabelecimento] = $this->criarSocioComProvider('premium-socio', expirado: true);
        $pagamento = $this->criarPagamento($estabelecimento);
        $this->fakeAsaas();

        $this->assertNull(app(NotaFiscalService::class)->emitirParaPagamento($pagamento));
        $this->assertSame(['comissao'], array_keys($this->notas($pagamento)));
    }

    public function test_sem_configuracao_fiscal_a_venda_fica_pendente_sem_chamar_o_asaas(): void
    {
        [, $estabelecimento, $provider] = $this->criarSocioComProvider(configurado: false);
        $pagamento = $this->criarPagamento($estabelecimento);
        $this->fakeAsaas();

        $venda = app(NotaFiscalService::class)->emitirParaPagamento($pagamento);

        $this->assertSame('NAO_CONFIGURADO', $venda->status);
        $this->assertStringContainsString('configuração fiscal', $venda->mensagem_erro);
        Http::assertNotSent(fn (Request $r) => str_ends_with($r->url(), '/invoices') && $r->header('access_token')[0] === $provider->asaas_api_key);
        $this->assertSame('AGENDADA', $this->notas($pagamento)['comissao']->status);
    }

    public function test_recusa_do_asaas_por_falta_de_cadastro_fiscal_fica_registrada(): void
    {
        [, $estabelecimento] = $this->criarSocioComProvider();
        $pagamento = $this->criarPagamento($estabelecimento);
        Http::fake([
            '*/customers*' => Http::response(['data' => [['id' => 'cus_existente']]], 200),
            '*/invoices' => Http::response(['errors' => [['description' => 'Município não configurado para emissão de notas fiscais.']]], 400),
        ]);

        $venda = app(NotaFiscalService::class)->emitirParaPagamento($pagamento);

        $this->assertSame('NAO_CONFIGURADO', $venda->status);
        $this->assertStringContainsString('Município', $venda->mensagem_erro);
    }

    public function test_nao_emite_duas_vezes_para_o_mesmo_pagamento(): void
    {
        [, $estabelecimento] = $this->criarSocioComProvider();
        $pagamento = $this->criarPagamento($estabelecimento);
        $this->fakeAsaas();

        app(NotaFiscalService::class)->emitirParaPagamento($pagamento);
        $this->assertNull(app(NotaFiscalService::class)->emitirParaPagamento($pagamento));

        $this->assertSame(2, NotaFiscal::where('pagamento_id', $pagamento->id)->count());
    }

    public function test_tentar_novamente_substitui_a_nota_com_erro(): void
    {
        [, $estabelecimento] = $this->criarSocioComProvider();
        $pagamento = $this->criarPagamento($estabelecimento);
        Http::fake([
            '*/customers*' => Http::response(['data' => [['id' => 'cus_existente']]], 200),
            '*/invoices' => Http::sequence()
                ->push(['id' => 'inv_comissao', 'status' => 'SCHEDULED'], 200)
                ->push(['errors' => [['description' => 'Erro genérico de validação.']]], 400)
                ->push(['id' => 'inv_retry', 'status' => 'SCHEDULED'], 200),
        ]);

        $comErro = app(NotaFiscalService::class)->emitirParaPagamento($pagamento);
        $this->assertSame('ERRO', $comErro->status);

        $corrigida = app(NotaFiscalService::class)->tentarNovamente($comErro);

        $this->assertSame('AGENDADA', $corrigida->status);
        $this->assertSame('inv_retry', $corrigida->asaas_invoice_id);
        $this->assertSame(2, NotaFiscal::where('pagamento_id', $pagamento->id)->count());
    }

    public function test_webhook_de_pagamento_confirmado_emite_as_notas(): void
    {
        [, $estabelecimento] = $this->criarSocioComProvider();
        $pagamento = $this->criarPagamento($estabelecimento, 'pendente');
        $this->fakeAsaas();

        $this->postJson('/api/webhook/asaas', [
            'event' => 'PAYMENT_CONFIRMED',
            'payment' => ['id' => $pagamento->id_transacao_gateway],
        ])->assertOk();

        $this->assertEqualsCanonicalizing(['venda', 'comissao'], array_keys($this->notas($pagamento)));
    }

    public function test_email_sai_quando_a_prefeitura_autoriza_a_nota(): void
    {
        Mail::fake();
        [, $estabelecimento] = $this->criarSocioComProvider();
        $pagamento = $this->criarPagamento($estabelecimento);
        $this->fakeAsaas();

        $venda = app(NotaFiscalService::class)->emitirParaPagamento($pagamento);
        Mail::assertNothingQueued();

        $this->postJson('/api/webhook/asaas', [
            'event' => 'INVOICE_AUTHORIZED',
            'invoice' => ['id' => $venda->asaas_invoice_id, 'status' => 'AUTHORIZED', 'number' => '123', 'pdfUrl' => 'https://asaas.test/nf.pdf', 'xmlUrl' => 'https://asaas.test/nf.xml'],
        ])->assertOk();

        $venda->refresh();
        $this->assertSame('AUTORIZADA', $venda->status);
        $this->assertSame('123', $venda->numero);
        $this->assertSame('https://asaas.test/nf.xml', $venda->xml_url);
        $this->assertNotNull($venda->emitida_em);
        Mail::assertQueued(NotaFiscalEmitidaMail::class, fn ($m) => $m->notaFiscal->id === $venda->id && $m->hasTo($pagamento->usuario->email));
        Mail::assertQueued(NotaFiscalEmitidaMail::class, 1);
    }

    public function test_sincronizacao_atualiza_notas_agendadas(): void
    {
        [, $estabelecimento] = $this->criarSocioComProvider();
        $pagamento = $this->criarPagamento($estabelecimento);
        // POST cria a nota agendada; o GET de sincronização devolve a mesma nota já autorizada.
        Http::fake(fn (Request $r) => match (true) {
            str_contains($r->url(), '/customers') => Http::response(['data' => [['id' => 'cus_existente']]], 200),
            $r->method() === 'GET' => Http::response(['id' => basename($r->url()), 'status' => 'AUTHORIZED', 'pdfUrl' => 'https://asaas.test/x.pdf'], 200),
            default => Http::response(['id' => 'inv_' . uniqid('', true), 'status' => 'SCHEDULED'], 200),
        });
        app(NotaFiscalService::class)->emitirParaPagamento($pagamento);

        $this->artisan('notas:sincronizar')->assertSuccessful();

        $this->assertSame(['AUTORIZADA'], NotaFiscal::where('pagamento_id', $pagamento->id)->pluck('status')->unique()->values()->all());
    }

    public function test_estorno_cancela_as_notas_da_venda_e_da_comissao(): void
    {
        [, $estabelecimento] = $this->criarSocioComProvider();
        $pagamento = $this->criarPagamento($estabelecimento);
        $this->fakeAsaas();
        app(NotaFiscalService::class)->emitirParaPagamento($pagamento);

        $this->postJson('/api/webhook/asaas', [
            'event' => 'PAYMENT_REFUNDED',
            'payment' => ['id' => $pagamento->id_transacao_gateway],
        ])->assertOk();

        $this->assertSame(['CANCELADA'], NotaFiscal::where('pagamento_id', $pagamento->id)->pluck('status')->unique()->values()->all());
        Http::assertSent(fn (Request $r) => str_ends_with($r->url(), '/cancel'));
    }

    public function test_pagamento_com_cartao_aprovado_na_hora_tambem_aciona_as_notas_de_entrega(): void
    {
        [$socio, $estabelecimento] = $this->criarSocioComProvider('premium-socio-anual');

        $produto = ProdutoEntrega::create([
            'usuario_id' => $socio->id, 'nome' => 'Botijão de Gás P13', 'valor' => 50,
            'estoque_disponivel' => 10, 'ativo' => true,
        ]);
        $cliente = $this->criarCliente();

        $pedido = PedidoEntrega::create([
            'codigo_pedido' => 'ENT-NF-' . uniqid(), 'cliente_id' => $cliente->id, 'produto_entrega_id' => $produto->id,
            'vendedor_id' => $socio->id, 'estabelecimento_id' => $estabelecimento->id,
            'quantidade' => 1, 'valor_unitario' => 50, 'valor_total' => 50,
            'modo_recebimento' => 'retirada', 'status' => 'pendente_pagamento',
        ]);

        Http::fake([
            '*/payments' => Http::response(['id' => 'pay_cartao_' . uniqid(), 'status' => 'CONFIRMED', 'invoiceUrl' => 'https://asaas.test/invoice', 'pixQrCode' => null], 200),
            '*/customers*' => Http::response(['data' => [['id' => 'cus_existente']]], 200),
            '*/invoices' => Http::response(['id' => 'inv_cartao', 'status' => 'SCHEDULED'], 200),
        ]);

        $resultado = app(PagamentoService::class)->criarCobrancaEntrega(
            $pedido, 'cartao', 'cus_fake', 1,
            ['numero' => '4111111111111111', 'titular' => 'Cliente Cartao', 'mes' => 12, 'ano' => (int) now()->addYear()->format('y'), 'cvv' => '123'],
            $cliente,
        );

        $this->assertTrue($resultado['aprovado']);
        $pagamento = Pagamento::where('pedido_entrega_id', $pedido->id)->first();
        $notas = $this->notas($pagamento);
        $this->assertEqualsCanonicalizing(['venda', 'comissao'], array_keys($notas));
        $this->assertEquals(0.5, $notas['comissao']->valor); // 1% de R$ 50
    }

    public function test_emite_nota_da_propria_plataforma_para_assinatura(): void
    {
        Mail::fake();
        $assinante = User::create([
            'name' => 'Assinante NF', 'email' => 'assnf' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'),
            'papel' => 'socio', 'plano_assinatura' => 'premium-anual', 'plano_expira_em' => now()->addMonth(),
        ]);
        $assinatura = Assinatura::create([
            'user_id' => $assinante->id, 'nome_plano' => 'premium-anual', 'tipo_publico' => 'estabelecimento',
            'valor_mensal' => 126, 'gateway_assinatura_id' => 'sub_' . uniqid(), 'status' => 'ativa',
            'data_inicio' => now(), 'data_vencimento' => now()->addYear(), 'fatura_id' => 'pay_assinatura_' . uniqid(),
        ]);

        Http::fake(['*/invoices' => Http::response(['id' => 'inv_assinatura', 'status' => 'AUTHORIZED', 'pdfUrl' => 'https://asaas.test/a.pdf'], 200)]);

        $nota = app(NotaFiscalService::class)->emitirParaAssinatura($assinatura, $assinante);

        $this->assertSame('assinatura', $nota->tipo);
        $this->assertSame('AUTORIZADA', $nota->status);
        $this->assertSame($assinatura->fatura_id, $nota->referencia_cobranca);
        Mail::assertQueued(NotaFiscalEmitidaMail::class);
        Http::assertSent(fn (Request $r) => $r['payment'] === $assinatura->fatura_id && $r->header('access_token')[0] === 'chave_master');

        $this->assertNull(app(NotaFiscalService::class)->emitirParaAssinatura($assinatura, $assinante));
        $this->assertSame(1, NotaFiscal::where('assinatura_id', $assinatura->id)->count());
    }

    public function test_webhook_de_renovacao_de_assinatura_tambem_aciona_nota_fiscal_da_plataforma(): void
    {
        Mail::fake();
        $cliente = User::create([
            'name' => 'Cliente Assinante', 'email' => 'cliassnf' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'),
            'papel' => 'user',
        ]);
        $assinatura = Assinatura::create([
            'user_id' => $cliente->id, 'nome_plano' => 'premium', 'tipo_publico' => 'cliente',
            'valor_mensal' => 8, 'gateway_assinatura_id' => 'sub_' . uniqid(), 'status' => 'pendente',
            'data_inicio' => now(), 'data_vencimento' => now()->addDays(7),
        ]);

        Http::fake(['*/invoices' => Http::response(['id' => 'inv_webhook_ass', 'status' => 'SCHEDULED'], 200)]);

        $this->postJson('/api/webhook/asaas', [
            'event' => 'PAYMENT_CONFIRMED',
            'payment' => ['id' => 'pay_cli_1', 'subscription' => $assinatura->gateway_assinatura_id],
        ])->assertOk();

        $nota = NotaFiscal::where('assinatura_id', $assinatura->id)->first();
        $this->assertSame('assinatura', $nota->tipo);
        $this->assertSame('pay_cli_1', $nota->referencia_cobranca);
    }

    public function test_socio_salva_a_configuracao_fiscal_e_ve_o_resumo(): void
    {
        [$socio, , $provider] = $this->criarSocioComProvider(configurado: false);

        $this->actingAs($socio)->post(route('notas-fiscais.configuracao'), [
            'nfse_servico_codigo' => '06.01', 'nfse_servico_nome' => 'Cabeleireiros', 'nfse_iss' => 3, 'nfse_retem_iss' => false,
        ])->assertSessionHasNoErrors()->assertRedirect();

        $provider->refresh();
        $this->assertSame('06.01', $provider->nfse_servico_codigo);
        $this->assertEquals(3, $provider->nfse_iss);

        $this->actingAs($socio)->get(route('notas-fiscais.index', ['tipo' => 'comissao']))
            ->assertOk()
            ->assertInertia(fn ($p) => $p->component('Estabelecimentos/NotasFiscais')
                ->where('ehSocio', true)
                ->where('filtro', 'comissao')
                ->where('configuracao.configurada', true)
                ->has('resumo.comissoes_mes')
                ->where('taxas.reservas', fn ($v) => (float) $v === 6.0));

        $this->actingAs($socio)->post(route('notas-fiscais.configuracao'), ['nfse_iss' => 2])
            ->assertSessionHasErrors(['nfse_servico_codigo', 'nfse_servico_nome']);
    }
}
