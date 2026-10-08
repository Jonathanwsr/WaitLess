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
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class NotaFiscalTest extends TestCase
{
    use DatabaseTransactions;

    private function criarSocioComProvider(string $plano = 'premium-socio', bool $expirado = false): array
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
            'document' => (string) random_int(10000000000, 99999999999), 'pix_key_type' => 'CPF', 'pix_key' => '123',
            'person_type' => 'FISICA', 'mobile_phone' => '11999998888',
            'postal_code' => '01000000', 'address' => 'Rua Teste', 'address_number' => '100', 'province' => 'Centro',
            'asaas_api_key' => 'provider_key_' . uniqid(),
        ]);

        return [$socio, $estabelecimento, $provider];
    }

    private function criarPagamento(Estabelecimento $estabelecimento): Pagamento
    {
        $cliente = User::create(['name' => 'Cliente NF', 'email' => 'cli' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'user']);

        return Pagamento::create([
            'usuario_id' => $cliente->id, 'estabelecimento_id' => $estabelecimento->id,
            'valor' => 100, 'valor_total' => 100, 'valor_liquido' => 99, 'metodo_pagamento' => 'pix',
            'status' => 'pago', 'id_transacao_gateway' => 'pay_' . uniqid(),
        ]);
    }

    public function test_emite_nota_fiscal_com_sucesso_para_socio_premium(): void
    {
        [, $estabelecimento] = $this->criarSocioComProvider('premium-socio');
        $pagamento = $this->criarPagamento($estabelecimento);

        Http::fake([
            '*/invoices' => Http::response(['id' => 'inv_123', 'status' => 'SCHEDULED', 'pdfUrl' => null], 200),
        ]);

        $nota = app(NotaFiscalService::class)->emitirParaPagamento($pagamento);

        $this->assertNotNull($nota);
        $this->assertSame('AGENDADA', $nota->status);
        $this->assertSame('inv_123', $nota->asaas_invoice_id);
        $this->assertSame($pagamento->id, $nota->pagamento_id);
    }

    public function test_nao_emite_para_socio_fora_do_plano_premium_socio(): void
    {
        [, $estabelecimento] = $this->criarSocioComProvider('premium-anual'); // premium base, não "sócio"
        $pagamento = $this->criarPagamento($estabelecimento);

        Http::fake(['*/invoices' => Http::response(['id' => 'inv_999'], 200)]);

        $nota = app(NotaFiscalService::class)->emitirParaPagamento($pagamento);

        $this->assertNull($nota);
        $this->assertDatabaseCount('notas_fiscais', 0);
        Http::assertNothingSent();
    }

    public function test_nao_emite_quando_plano_socio_premium_esta_expirado(): void
    {
        [, $estabelecimento] = $this->criarSocioComProvider('premium-socio', expirado: true);
        $pagamento = $this->criarPagamento($estabelecimento);

        $nota = app(NotaFiscalService::class)->emitirParaPagamento($pagamento);

        $this->assertNull($nota);
    }

    public function test_falha_por_falta_de_configuracao_fiscal_fica_registrada_graciosamente(): void
    {
        [, $estabelecimento] = $this->criarSocioComProvider('premium-socio-anual');
        $pagamento = $this->criarPagamento($estabelecimento);

        Http::fake([
            '*/invoices' => Http::response(['errors' => [['description' => 'Município não configurado para emissão de notas fiscais.']]], 400),
        ]);

        $nota = app(NotaFiscalService::class)->emitirParaPagamento($pagamento);

        $this->assertNotNull($nota);
        $this->assertSame('NAO_CONFIGURADO', $nota->status);
        $this->assertStringContainsString('Município', $nota->mensagem_erro);
    }

    public function test_nao_tenta_emitir_duas_vezes_para_o_mesmo_pagamento(): void
    {
        [, $estabelecimento] = $this->criarSocioComProvider('premium-socio');
        $pagamento = $this->criarPagamento($estabelecimento);

        Http::fake(['*/invoices' => Http::response(['id' => 'inv_1'], 200)]);
        app(NotaFiscalService::class)->emitirParaPagamento($pagamento);

        Http::fake(['*/invoices' => Http::response(['id' => 'inv_2'], 200)]);
        $segunda = app(NotaFiscalService::class)->emitirParaPagamento($pagamento);

        $this->assertNull($segunda);
        $this->assertDatabaseCount('notas_fiscais', 1);
    }

    public function test_tentar_novamente_substitui_a_nota_com_erro_por_uma_bem_sucedida(): void
    {
        [, $estabelecimento] = $this->criarSocioComProvider('premium-socio');
        $pagamento = $this->criarPagamento($estabelecimento);

        Http::fakeSequence('*/invoices')
            ->push(['errors' => [['description' => 'Erro genérico de validação.']]], 400)
            ->push(['id' => 'inv_retry', 'status' => 'SCHEDULED'], 200);

        $notaComErro = app(NotaFiscalService::class)->emitirParaPagamento($pagamento);
        $this->assertSame('ERRO', $notaComErro->status);

        $notaCorrigida = app(NotaFiscalService::class)->tentarNovamente($notaComErro);

        $this->assertSame('AGENDADA', $notaCorrigida->status);
        $this->assertSame('inv_retry', $notaCorrigida->asaas_invoice_id);
        $this->assertDatabaseCount('notas_fiscais', 1);
    }

    public function test_webhook_asaas_aciona_a_emissao_automatica_ao_confirmar_pagamento(): void
    {
        [, $estabelecimento] = $this->criarSocioComProvider('premium-socio');
        $pagamento = Pagamento::create([
            'usuario_id' => User::create(['name' => 'Cliente WH', 'email' => 'cliwh' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'user'])->id,
            'estabelecimento_id' => $estabelecimento->id,
            'valor' => 80, 'valor_total' => 80, 'valor_liquido' => 79.2, 'metodo_pagamento' => 'pix',
            'status' => 'pendente', 'id_transacao_gateway' => 'pay_wh_' . uniqid(),
        ]);

        Http::fake(['*/invoices' => Http::response(['id' => 'inv_wh', 'status' => 'SCHEDULED'], 200)]);

        $response = $this->postJson('/api/webhook/asaas', [
            'event' => 'PAYMENT_CONFIRMED',
            'payment' => ['id' => $pagamento->id_transacao_gateway],
        ]);

        $response->assertOk();
        $nota = NotaFiscal::where('pagamento_id', $pagamento->id)->first();
        $this->assertNotNull($nota);
        $this->assertSame('AGENDADA', $nota->status);
    }

    public function test_emite_email_com_a_nota_fiscal_para_o_cliente(): void
    {
        Mail::fake();
        [, $estabelecimento] = $this->criarSocioComProvider('premium-socio');
        $pagamento = $this->criarPagamento($estabelecimento);

        Http::fake(['*/invoices' => Http::response(['id' => 'inv_mail', 'status' => 'SCHEDULED'], 200)]);
        $nota = app(NotaFiscalService::class)->emitirParaPagamento($pagamento);

        Mail::assertQueued(NotaFiscalEmitidaMail::class, function ($mail) use ($nota) {
            return $mail->notaFiscal->id === $nota->id;
        });
        Mail::assertQueued(NotaFiscalEmitidaMail::class, 1);
    }

    public function test_pagamento_com_cartao_aprovado_na_hora_tambem_aciona_nota_fiscal_de_entrega(): void
    {
        [$socio, $estabelecimento] = $this->criarSocioComProvider('premium-socio-anual');
        $this->criarProviderComWalletAsaas($socio);

        $produto = ProdutoEntrega::create([
            'usuario_id' => $socio->id, 'nome' => 'Botijão de Gás P13', 'valor' => 50,
            'estoque_disponivel' => 10, 'ativo' => true,
        ]);
        $cliente = User::create(['name' => 'Cliente Cartao', 'email' => 'cartao' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'user']);

        $pedido = PedidoEntrega::create([
            'codigo_pedido' => 'ENT-NF-' . uniqid(), 'cliente_id' => $cliente->id, 'produto_entrega_id' => $produto->id,
            'vendedor_id' => $socio->id, 'estabelecimento_id' => $estabelecimento->id,
            'quantidade' => 1, 'valor_unitario' => 50, 'valor_total' => 50,
            'modo_recebimento' => 'retirada', 'status' => 'pendente_pagamento',
        ]);

        Http::fake([
            '*/payments' => Http::response(['id' => 'pay_cartao_' . uniqid(), 'status' => 'CONFIRMED', 'invoiceUrl' => 'https://asaas.test/invoice', 'pixQrCode' => null], 200),
            '*/invoices' => Http::response(['id' => 'inv_cartao', 'status' => 'SCHEDULED'], 200),
        ]);

        $resultado = app(PagamentoService::class)->criarCobrancaEntrega(
            $pedido, 'cartao', 'cus_fake', 1,
            ['numero' => '4111111111111111', 'titular' => 'Cliente Cartao', 'mes' => 12, 'ano' => (int) now()->addYear()->format('y'), 'cvv' => '123'],
            $cliente,
        );

        $this->assertTrue($resultado['aprovado']);
        $pagamento = Pagamento::where('pedido_entrega_id', $pedido->id)->first();
        $this->assertSame('pago', $pagamento->status);

        $nota = NotaFiscal::where('pagamento_id', $pagamento->id)->first();
        $this->assertNotNull($nota, 'Pagamento com cartão aprovado na hora deveria acionar a emissão de nota fiscal, sem depender do webhook.');
        $this->assertSame('venda', $nota->tipo);
    }

    public function test_emite_nota_fiscal_da_propria_plataforma_para_assinatura_de_socio_ou_cliente(): void
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

        Http::fake(['*/invoices' => Http::response(['id' => 'inv_assinatura', 'status' => 'SCHEDULED'], 200)]);

        $nota = app(NotaFiscalService::class)->emitirParaAssinatura($assinatura, $assinante);

        $this->assertNotNull($nota);
        $this->assertSame('assinatura', $nota->tipo);
        $this->assertSame($assinatura->id, $nota->assinatura_id);
        $this->assertSame($assinante->id, $nota->usuario_id);
        $this->assertSame($assinatura->fatura_id, $nota->referencia_cobranca);
        Mail::assertQueued(NotaFiscalEmitidaMail::class);

        // Mesma fatura não gera uma segunda nota (idempotência de renovação).
        $segunda = app(NotaFiscalService::class)->emitirParaAssinatura($assinatura, $assinante);
        $this->assertNull($segunda);
        $this->assertDatabaseCount('notas_fiscais', 1);
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

        $response = $this->postJson('/api/webhook/asaas', [
            'event' => 'PAYMENT_CONFIRMED',
            'payment' => ['id' => 'pay_cli_1', 'subscription' => $assinatura->gateway_assinatura_id],
        ]);

        $response->assertOk();
        $nota = NotaFiscal::where('assinatura_id', $assinatura->id)->first();
        $this->assertNotNull($nota);
        $this->assertSame('assinatura', $nota->tipo);
        $this->assertSame('pay_cli_1', $nota->referencia_cobranca);
    }

    private function criarProviderComWalletAsaas(User $socio): Provider
    {
        $provider = Provider::where('user_id', $socio->id)->first();
        $provider->update(['asaas_wallet_id' => 'wal_' . uniqid()]);

        return $provider;
    }
}
