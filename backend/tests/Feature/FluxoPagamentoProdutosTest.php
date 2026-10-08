<?php

namespace Tests\Feature;

use App\Models\Estabelecimento;
use App\Models\NotificacaoUsuario;
use App\Models\Pagamento;
use App\Models\PedidoEntrega;
use App\Models\ProdutoEntrega;
use App\Models\Provider;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class FluxoPagamentoProdutosTest extends TestCase
{
    use DatabaseTransactions;

    private function usuario(string $papel, string $nome = 'Usuario'): User
    {
        return User::create([
            'name' => $nome, 'email' => strtolower($nome) . uniqid() . '@x.com',
            'password' => Hash::make('senha-teste-123'), 'papel' => $papel,
        ]);
    }

    /** Vendedor com estabelecimento; $comCarteira controla se ele recebe online. */
    private function vendedor(bool $comCarteira): array
    {
        $socio = $this->usuario('socio', 'Vendedor');
        $estabelecimento = Estabelecimento::create(['nome' => 'Loja ' . uniqid()]);
        $estabelecimento->proprietarios()->attach($socio->id, ['tipo' => 'socio']);

        Provider::create([
            'user_id' => $socio->id, 'name' => $socio->name, 'email' => $socio->email,
            'document' => (string) random_int(10000000000, 99999999999), 'pix_key_type' => 'CPF', 'pix_key' => '123',
            'person_type' => 'FISICA', 'mobile_phone' => '11999998888', 'postal_code' => '01000000',
            'address' => 'Rua Teste', 'address_number' => '100', 'province' => 'Centro',
            'asaas_api_key' => 'k_' . uniqid(), 'asaas_wallet_id' => $comCarteira ? 'wal_' . uniqid() : null,
        ]);

        return [$socio, $estabelecimento];
    }

    private function produto(User $vendedor, ?Estabelecimento $estabelecimento = null, int $estoque = 10): ProdutoEntrega
    {
        return ProdutoEntrega::create([
            'usuario_id' => $vendedor->id, 'estabelecimento_id' => $estabelecimento?->id,
            'nome' => 'Água 20L', 'categoria' => 'Alimentos', 'valor' => 30, 'estoque_disponivel' => $estoque,
            'ativo' => true, 'taxa_entrega' => 5,
            'endereco_cep' => '01000000', 'endereco_rua' => 'Rua da Água', 'endereco_numero' => '5',
            'endereco_bairro' => 'Centro', 'endereco_cidade' => 'São Paulo', 'endereco_estado' => 'SP',
        ]);
    }

    private function pedido(User $cliente, ProdutoEntrega $produto, array $extra = []): PedidoEntrega
    {
        return PedidoEntrega::create(array_merge([
            'codigo_pedido' => 'ENT-' . uniqid(), 'cliente_id' => $cliente->id, 'produto_entrega_id' => $produto->id,
            'vendedor_id' => $produto->usuario_id, 'estabelecimento_id' => $produto->estabelecimento_id,
            'quantidade' => 2, 'valor_unitario' => 30, 'valor_total' => 60, 'modo_recebimento' => 'retirada',
            'modo_pagamento' => 'local', 'codigo_confirmacao' => '314159', 'status' => 'aguardando_confirmacao',
        ], $extra));
    }

    public function test_pagamento_online_so_e_aceito_para_vendedor_com_carteira(): void
    {
        Http::fake();
        [$semCarteira] = $this->vendedor(false);
        $produto = $this->produto($semCarteira, null, 10);
        $cliente = $this->usuario('user', 'Cliente');

        $resposta = $this->actingAs($cliente)->postJson('/entregas/pedidos', [
            'produto_entrega_id' => $produto->id, 'quantidade' => 1, 'modo_recebimento' => 'retirada',
            'modo_pagamento' => 'online', 'metodo_pagamento' => 'pix',
        ]);

        $resposta->assertStatus(422);
        $this->assertDatabaseCount('pedidos_entrega', 0);
        $this->assertSame(10, $produto->fresh()->estoque_disponivel);
        Http::assertNothingSent();
    }

    public function test_pagamento_no_local_registra_pedido_com_codigo_sem_chamar_asaas(): void
    {
        Http::fake();
        [$semCarteira] = $this->vendedor(false);
        $produto = $this->produto($semCarteira, null, 10);
        $cliente = $this->usuario('user', 'Cliente');

        $resposta = $this->actingAs($cliente)->postJson('/entregas/pedidos', [
            'produto_entrega_id' => $produto->id, 'quantidade' => 2, 'modo_recebimento' => 'retirada',
            'modo_pagamento' => 'local',
        ]);

        $resposta->assertCreated();
        $pedido = PedidoEntrega::where('cliente_id', $cliente->id)->firstOrFail();
        $this->assertSame('aguardando_confirmacao', $pedido->status);
        $this->assertSame('local', $pedido->modo_pagamento);
        $this->assertMatchesRegularExpression('/^\d{6}$/', $pedido->codigo_confirmacao);
        $this->assertSame(8, $produto->fresh()->estoque_disponivel);
        Http::assertNothingSent();
    }

    public function test_cancelar_pedido_no_local_devolve_estoque_sem_dinheiro_envolvido(): void
    {
        Http::fake();
        [$vendedor] = $this->vendedor(false);
        $produto = $this->produto($vendedor, null, 8);
        $cliente = $this->usuario('user', 'Cliente');
        $pedido = $this->pedido($cliente, $produto);

        $this->actingAs($cliente)->postJson("/entregas/pedidos/{$pedido->id}/cancelar")->assertOk();

        $this->assertSame('cancelado', $pedido->fresh()->status);
        $this->assertSame(10, $produto->fresh()->estoque_disponivel);
        Http::assertNothingSent();
    }

    public function test_vendedor_libera_pagamento_online_no_asaas_ao_digitar_o_codigo(): void
    {
        Http::fake(['*/releaseEscrow' => Http::response(['id' => 'pay_1'], 200)]);
        [$vendedor, $estabelecimento] = $this->vendedor(true);
        $produto = $this->produto($vendedor, $estabelecimento);
        $cliente = $this->usuario('user', 'Cliente');

        $pagamento = Pagamento::create([
            'usuario_id' => $cliente->id, 'estabelecimento_id' => $estabelecimento->id, 'pedido_entrega_id' => null,
            'valor' => 60, 'valor_total' => 60, 'valor_liquido' => 55, 'metodo_pagamento' => 'pix',
            'status' => 'pago', 'id_transacao_gateway' => 'pay_escrow_' . uniqid(),
        ]);
        $pedido = $this->pedido($cliente, $produto, [
            'modo_pagamento' => 'online', 'status' => 'pago', 'pagamento_id' => $pagamento->id,
        ]);
        $pagamento->update(['pedido_entrega_id' => $pedido->id]);

        $this->actingAs($vendedor)->postJson("/entregas/pedidos/{$pedido->id}/liberar", ['codigo' => '314159'])->assertOk();

        $this->assertSame('concluido', $pedido->fresh()->status);
        Http::assertSent(fn ($req) => str_contains($req->url(), "/payments/{$pagamento->id_transacao_gateway}/releaseEscrow"));
    }

    public function test_codigo_errado_nao_libera_pagamento_online(): void
    {
        Http::fake();
        [$vendedor, $estabelecimento] = $this->vendedor(true);
        $produto = $this->produto($vendedor, $estabelecimento);
        $cliente = $this->usuario('user', 'Cliente');
        $pedido = $this->pedido($cliente, $produto, ['modo_pagamento' => 'online', 'status' => 'pago']);

        $this->actingAs($vendedor)->postJson("/entregas/pedidos/{$pedido->id}/liberar", ['codigo' => '999999'])->assertStatus(422);

        $this->assertSame('pago', $pedido->fresh()->status);
        Http::assertNothingSent();
    }

    public function test_admin_remove_produto_cancela_pendentes_devolve_pago_e_avisa_o_dono(): void
    {
        Http::fake(['*/refund' => Http::response(['id' => 'ref_1', 'status' => 'REFUNDED'], 200)]);
        [$vendedor, $estabelecimento] = $this->vendedor(true);
        $produto = $this->produto($vendedor, $estabelecimento, 4);
        $cliente = $this->usuario('user', 'Cliente');
        $admin = $this->usuario('admin', 'Admin');

        $pagamento = Pagamento::create([
            'usuario_id' => $cliente->id, 'estabelecimento_id' => $estabelecimento->id,
            'valor' => 60, 'valor_total' => 60, 'valor_liquido' => 55, 'metodo_pagamento' => 'pix',
            'status' => 'pago', 'id_transacao_gateway' => 'pay_rm_' . uniqid(),
        ]);
        $pago = $this->pedido($cliente, $produto, ['modo_pagamento' => 'online', 'status' => 'pago', 'pagamento_id' => $pagamento->id]);
        $pagamento->update(['pedido_entrega_id' => $pago->id]);
        $pendente = $this->pedido($cliente, $produto, ['status' => 'aguardando_confirmacao']);

        $this->actingAs($admin)->delete("/admin/produtos-entrega/{$produto->id}", ['motivo' => 'Produto fora das normas'])
            ->assertRedirect();

        $this->assertSoftDeleted('produtos_entrega', ['id' => $produto->id]);
        $this->assertSame('cancelado', $pendente->fresh()->status);
        $this->assertContains($pago->fresh()->status, ['estornado', 'cancelado']);
        Http::assertSent(fn ($req) => str_contains($req->url(), 'refund'));

        $this->assertTrue(NotificacaoUsuario::where('usuario_id', $vendedor->id)->where('titulo', 'Produto removido pela Lokyva')->exists());
        $this->assertTrue(NotificacaoUsuario::where('usuario_id', $cliente->id)->where('titulo', 'Pedido cancelado')->exists());
    }

    public function test_admin_nao_remove_produto_se_a_devolucao_falhar(): void
    {
        Http::fake(['*/refund' => Http::response(['errors' => [['description' => 'Falha']]], 500)]);
        [$vendedor, $estabelecimento] = $this->vendedor(true);
        $produto = $this->produto($vendedor, $estabelecimento);
        $cliente = $this->usuario('user', 'Cliente');
        $admin = $this->usuario('admin', 'Admin');

        $pagamento = Pagamento::create([
            'usuario_id' => $cliente->id, 'estabelecimento_id' => $estabelecimento->id,
            'valor' => 60, 'valor_total' => 60, 'valor_liquido' => 55, 'metodo_pagamento' => 'pix',
            'status' => 'pago', 'id_transacao_gateway' => 'pay_falha_' . uniqid(),
        ]);
        $pago = $this->pedido($cliente, $produto, ['modo_pagamento' => 'online', 'status' => 'pago', 'pagamento_id' => $pagamento->id]);
        $pagamento->update(['pedido_entrega_id' => $pago->id]);

        $this->actingAs($admin)->delete("/admin/produtos-entrega/{$produto->id}", ['motivo' => 'Produto fora das normas'])
            ->assertSessionHas('error');

        $this->assertNotSoftDeleted('produtos_entrega', ['id' => $produto->id]);
        $this->assertSame('pago', $pago->fresh()->status);
    }

    public function test_disputa_de_pagamento_fora_da_plataforma_e_decidida_pelo_admin(): void
    {
        [$vendedor, $estabelecimento] = $this->vendedor(false);
        $produto = $this->produto($vendedor, $estabelecimento);
        $cliente = $this->usuario('user', 'Cliente');
        $admin = $this->usuario('admin', 'Admin');
        $pedido = $this->pedido($cliente, $produto, ['status' => 'concluido', 'modo_pagamento' => 'direto_vendedor']);

        $this->actingAs($cliente)->postJson("/entregas/pedidos/{$pedido->id}/estorno", [
            'motivo' => 'Produto veio danificado', 'descricao' => 'A água chegou com a embalagem rompida e vazando.',
        ])->assertCreated();
        $this->assertSame('solicitado', $pedido->fresh()->disputa_status);

        $this->actingAs($admin)->post("/admin/produtos-entrega/pedidos/{$pedido->id}/disputa", ['decisao' => 'aprovar'])
            ->assertRedirect();

        $this->assertSame('aprovado', $pedido->fresh()->disputa_status);
        $this->assertTrue(NotificacaoUsuario::where('usuario_id', $cliente->id)->where('titulo', 'Decisão sobre seu estorno')->exists());
    }

    public function test_cliente_ve_codigo_endereco_e_baixa_comprovante_com_todos_os_dados(): void
    {
        [$vendedor, $estabelecimento] = $this->vendedor(false);
        $produto = $this->produto($vendedor, $estabelecimento);
        $cliente = $this->usuario('user', 'Cliente');
        $pedido = $this->pedido($cliente, $produto, [
            'modo_recebimento' => 'entrega', 'entrega_cep' => '04567000', 'entrega_rua' => 'Rua Nova',
            'entrega_numero' => '42', 'entrega_bairro' => 'Vila', 'entrega_cidade' => 'São Paulo',
            'entrega_estado' => 'SP', 'entrega_observacoes' => 'Portão azul',
        ]);

        $this->actingAs($cliente)->get('/entregas/meus-pedidos')->assertOk()
            ->assertInertia(fn ($page) => $page->component('Entregas/MeusPedidos')
                ->where('pedidos.0.codigo_confirmacao_visivel', '314159')
                ->where('pedidos.0.forma_pagamento_label', 'Pagamento no local'));

        $this->actingAs($cliente)->get("/entregas/pedidos/{$pedido->id}/comprovante-pdf")
            ->assertOk()
            ->assertHeader('content-type', 'application/pdf');
    }

    public function test_vendedor_nao_ve_o_codigo_no_comprovante(): void
    {
        [$vendedor, $estabelecimento] = $this->vendedor(false);
        $produto = $this->produto($vendedor, $estabelecimento);
        $cliente = $this->usuario('user', 'Cliente');
        $pedido = $this->pedido($cliente, $produto);

        $this->actingAs($vendedor)->get("/entregas/pedidos/{$pedido->id}/comprovante-pdf")->assertOk();
        $this->assertFalse(str_contains((string) $pedido->fresh()->toJson(), '314159'));
    }

    public function test_produto_nao_pode_ficar_sem_forma_de_recebimento(): void
    {
        [$socio, $estabelecimento] = $this->vendedor(true);

        $this->actingAs($socio)->post('/produtos-entrega', [
            'nome' => 'Sem entrega nem retirada', 'categoria' => 'Outros', 'valor' => 10,
            'aceita_entrega' => '0', 'aceita_retirada' => '0',
            'endereco_cep' => '01000000', 'endereco_rua' => 'Rua X', 'endereco_numero' => '1',
            'endereco_bairro' => 'Centro', 'endereco_cidade' => 'São Paulo', 'endereco_estado' => 'SP',
        ])->assertStatus(422);

        $this->assertDatabaseMissing('produtos_entrega', ['nome' => 'Sem entrega nem retirada']);
    }
}
