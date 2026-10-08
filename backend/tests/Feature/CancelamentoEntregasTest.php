<?php

namespace Tests\Feature;

use App\Models\Estabelecimento;
use App\Models\Pagamento;
use App\Models\PedidoEntrega;
use App\Models\ProdutoEntrega;
use App\Models\Provider;
use App\Models\User;
use App\Services\AdminRelatorioService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class CancelamentoEntregasTest extends TestCase
{
    use DatabaseTransactions;

    private function usuario(string $papel, string $nome, ?string $plano = null): User
    {
        return User::create([
            'name' => $nome, 'email' => strtolower($nome) . uniqid() . '@x.com',
            'password' => Hash::make('senha-teste-123'), 'papel' => $papel,
            'plano_assinatura' => $plano ?? 'gratuito',
            'plano_expira_em' => $plano ? now('America/Sao_Paulo')->addMonth() : null,
        ]);
    }

    /** Vendedor (sócio) com local e carteira Asaas. */
    private function vendedor(): array
    {
        $socio = $this->usuario('socio', 'Vendedor', 'premium-socio');
        $estab = Estabelecimento::create(['nome' => 'Loja ' . uniqid()]);
        $estab->proprietarios()->attach($socio->id, ['tipo' => 'socio']);
        Provider::create([
            'user_id' => $socio->id, 'name' => $socio->name, 'email' => $socio->email,
            'document' => (string) random_int(10000000000, 99999999999), 'pix_key_type' => 'CPF', 'pix_key' => '123',
            'person_type' => 'FISICA', 'mobile_phone' => '11999998888', 'postal_code' => '01000000',
            'address' => 'Rua', 'address_number' => '1', 'province' => 'Centro',
            'asaas_api_key' => 'k_' . uniqid(), 'asaas_wallet_id' => 'wal_' . uniqid(),
        ]);

        return [$socio, $estab];
    }

    private function produto(User $vendedor, Estabelecimento $estab, int $estoque = 10): ProdutoEntrega
    {
        return ProdutoEntrega::create([
            'usuario_id' => $vendedor->id, 'estabelecimento_id' => $estab->id, 'nome' => 'Gás P13', 'categoria' => 'Gás e água',
            'valor' => 100, 'estoque_disponivel' => $estoque, 'ativo' => true, 'taxa_entrega' => 0,
            'aceita_entrega' => true, 'aceita_retirada' => true,
            'endereco_cep' => '01000000', 'endereco_rua' => 'R', 'endereco_numero' => '1',
            'endereco_bairro' => 'C', 'endereco_cidade' => 'SP', 'endereco_estado' => 'SP',
        ]);
    }

    private function pedido(User $cliente, ProdutoEntrega $produto, array $extra = []): PedidoEntrega
    {
        return PedidoEntrega::create(array_merge([
            'codigo_pedido' => 'ENT-' . uniqid(), 'codigo_confirmacao' => '314159', 'cliente_id' => $cliente->id,
            'produto_entrega_id' => $produto->id, 'vendedor_id' => $produto->usuario_id,
            'estabelecimento_id' => $produto->estabelecimento_id, 'quantidade' => 1, 'valor_unitario' => 100,
            'valor_total' => 100, 'modo_recebimento' => 'entrega', 'modo_pagamento' => 'online',
            'status' => 'pago',
        ], $extra));
    }

    /** Pagamento online já aprovado para o pedido (sem chamar o Asaas). */
    private function pagamentoPago(PedidoEntrega $pedido): Pagamento
    {
        $pagamento = Pagamento::create([
            'usuario_id' => $pedido->cliente_id, 'estabelecimento_id' => $pedido->estabelecimento_id,
            'pedido_entrega_id' => $pedido->id, 'gateway_pagamento' => 'Asaas',
            'id_transacao_gateway' => 'pay_' . uniqid(), 'valor' => $pedido->valor_total,
            'taxa' => 1, 'valor_liquido' => $pedido->valor_total - 1, 'status' => 'pago', 'metodo_pagamento' => 'pix',
        ]);
        $pedido->update(['pagamento_id' => $pagamento->id]);

        return $pagamento;
    }

    public function test_comprador_cancela_pedido_pendente_e_o_estoque_volta(): void
    {
        Http::fake(['*' => Http::response(['deleted' => true], 200)]);
        [$vendedor, $estab] = $this->vendedor();
        $cliente = $this->usuario('cliente', 'Cliente');
        $produto = $this->produto($vendedor, $estab, 9);
        $pedido = $this->pedido($cliente, $produto, ['status' => 'pendente_pagamento']);

        $this->actingAs($cliente)->postJson("/entregas/pedidos/{$pedido->id}/cancelar")->assertOk();

        $pedido->refresh();
        $this->assertSame('cancelado', $pedido->status);
        $this->assertSame($cliente->id, $pedido->cancelado_por_usuario_id);
        $this->assertSame(10, $produto->fresh()->estoque_disponivel);
    }

    public function test_comprador_nao_cancela_pedido_ja_pago_online(): void
    {
        [$vendedor, $estab] = $this->vendedor();
        $cliente = $this->usuario('cliente', 'Cliente');
        $pedido = $this->pedido($cliente, $this->produto($vendedor, $estab), ['status' => 'pago']);

        $this->actingAs($cliente)->postJson("/entregas/pedidos/{$pedido->id}/cancelar")
            ->assertStatus(409)
            ->assertJsonFragment(['error' => 'Este pedido já foi pago online. Peça ao vendedor para cancelar: ele devolve o valor na forma de pagamento original.']);

        $this->assertSame('pago', $pedido->fresh()->status);
    }

    public function test_vendedor_cancela_pedido_pago_e_o_valor_volta_para_o_cliente(): void
    {
        Http::fake(['*' => Http::response(['id' => 'ref_1', 'status' => 'REFUNDED'], 200)]);
        [$vendedor, $estab] = $this->vendedor();
        $cliente = $this->usuario('cliente', 'Cliente');
        $produto = $this->produto($vendedor, $estab, 9);
        $pedido = $this->pedido($cliente, $produto, ['status' => 'pago']);
        $pagamento = $this->pagamentoPago($pedido);

        $this->actingAs($vendedor)->postJson("/entregas/pedidos/{$pedido->id}/cancelar-vendedor")->assertOk();

        $pedido->refresh();
        $this->assertSame('cancelado', $pedido->status);
        $this->assertSame($vendedor->id, $pedido->cancelado_por_usuario_id);
        $this->assertSame('estornado', $pagamento->fresh()->status);
        $this->assertSame(10, $produto->fresh()->estoque_disponivel);
        Http::assertSent(fn ($r) => str_contains($r->url(), "/payments/{$pagamento->id_transacao_gateway}/refund"));
    }

    public function test_estranho_nao_cancela_pelo_vendedor(): void
    {
        [$vendedor, $estab] = $this->vendedor();
        $cliente = $this->usuario('cliente', 'Cliente');
        $estranho = $this->usuario('cliente', 'Estranho');
        $pedido = $this->pedido($cliente, $this->produto($vendedor, $estab), ['status' => 'pendente_pagamento']);

        $this->actingAs($estranho)->postJson("/entregas/pedidos/{$pedido->id}/cancelar-vendedor")->assertForbidden();
        $this->assertSame('pendente_pagamento', $pedido->fresh()->status);
    }

    public function test_pedido_concluido_nao_e_cancelado(): void
    {
        [$vendedor, $estab] = $this->vendedor();
        $cliente = $this->usuario('cliente', 'Cliente');
        $pedido = $this->pedido($cliente, $this->produto($vendedor, $estab), ['status' => 'concluido']);

        $this->actingAs($vendedor)->postJson("/entregas/pedidos/{$pedido->id}/cancelar-vendedor")->assertStatus(409);
        $this->assertSame('concluido', $pedido->fresh()->status);
    }

    public function test_resumo_admin_conta_vendidos_cancelados_por_quem_e_apagados(): void
    {
        [$vendedor, $estab] = $this->vendedor();
        $cliente = $this->usuario('cliente', 'Cliente');
        $produto = $this->produto($vendedor, $estab);
        $outro = $this->produto($vendedor, $estab);

        $this->pedido($cliente, $produto, ['status' => 'concluido', 'valor_total' => 200, 'taxa_plataforma' => 2, 'data_conclusao' => now()]);
        $this->pedido($cliente, $produto, ['status' => 'pago', 'valor_total' => 100]);
        $this->pedido($cliente, $produto, ['status' => 'cancelado', 'valor_total' => 50, 'cancelado_por_usuario_id' => $cliente->id]);
        $this->pedido($cliente, $produto, ['status' => 'cancelado', 'valor_total' => 70, 'cancelado_por_usuario_id' => $vendedor->id]);
        $outro->delete();

        $resumo = app(AdminRelatorioService::class)->resumoVendasEntregas(now('America/Sao_Paulo')->format('Y-m'));

        $this->assertSame(1, $resumo['vendidos']['total']);
        $this->assertEquals(200, $resumo['vendidos']['valor']);
        $this->assertSame(1, $resumo['em_andamento']['total']);
        $this->assertSame(2, $resumo['cancelados']['total']);
        $this->assertSame(1, $resumo['cancelados']['pelo_cliente']);
        $this->assertSame(1, $resumo['cancelados']['pelo_vendedor_ou_admin']);
        $this->assertSame(1, $resumo['produtos_apagados']);
        $this->assertEquals(2, $resumo['receita_plataforma']);
    }

    public function test_pagina_admin_de_relatorios_recebe_o_bloco_de_vendas(): void
    {
        $admin = $this->usuario('admin', 'Admin');

        $this->actingAs($admin)->get('/admin/relatorios')->assertOk();
    }

    public function test_volume_de_produtos_entra_no_resumo_financeiro(): void
    {
        [$vendedor, $estab] = $this->vendedor();
        $cliente = $this->usuario('cliente', 'Cliente');
        $produto = $this->produto($vendedor, $estab);
        $mes = now('America/Sao_Paulo')->format('Y-m');

        $this->pedido($cliente, $produto, ['status' => 'concluido', 'valor_total' => 300, 'taxa_plataforma' => 3, 'data_conclusao' => now()]);
        $this->pedido($cliente, $produto, ['status' => 'cancelado', 'valor_total' => 999]);

        $resumo = app(AdminRelatorioService::class)->resumoFinanceiro($mes);

        $this->assertEquals(300, $resumo['volume_produtos']);
        $this->assertGreaterThanOrEqual(3, $resumo['receita_plataforma']);
    }
}
