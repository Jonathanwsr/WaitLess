<?php

namespace Tests\Feature;

use App\Models\Estabelecimento;
use App\Models\Estorno;
use App\Models\Pagamento;
use App\Models\PedidoEntrega;
use App\Models\ProdutoEntrega;
use App\Models\Provider;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class EntregasTest extends TestCase
{
    use DatabaseTransactions;

    private function criarSocio(string $nome = 'Socio Entrega'): User
    {
        return User::create(['name' => $nome, 'email' => strtolower(str_replace(' ', '', $nome)) . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'socio']);
    }

    private function criarCliente(string $nome = 'Cliente Entrega'): User
    {
        return User::create(['name' => $nome, 'email' => strtolower(str_replace(' ', '', $nome)) . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'user']);
    }

    private function criarProviderComWallet(User $socio): Provider
    {
        return Provider::create([
            'user_id' => $socio->id, 'name' => $socio->name, 'email' => $socio->email,
            'document' => (string) random_int(10000000000, 99999999999), 'pix_key_type' => 'CPF', 'pix_key' => '123',
            'person_type' => 'FISICA', 'mobile_phone' => '11999998888',
            'postal_code' => '01000000', 'address' => 'Rua Teste', 'address_number' => '100', 'province' => 'Centro',
            'asaas_wallet_id' => 'wal_' . uniqid(),
        ]);
    }

    private function criarProdutoAvulso(User $socio, float $valor = 50.0, int $estoque = 10): ProdutoEntrega
    {
        return ProdutoEntrega::create([
            'usuario_id' => $socio->id,
            'nome' => 'Botijão de Gás P13',
            'descricao' => 'Botijão de gás completo',
            'valor' => $valor,
            'estoque_disponivel' => $estoque,
            'ativo' => true,
            'endereco_cep' => '01000000', 'endereco_rua' => 'Rua do Gás', 'endereco_numero' => '10',
            'endereco_bairro' => 'Centro', 'endereco_cidade' => 'São Paulo', 'endereco_estado' => 'SP',
        ]);
    }

    private function fakeAsaasPagamentoOk(): void
    {
        Http::fake([
            '*/customers' => Http::response(['id' => 'cus_' . uniqid()], 200),
            '*/payments' => Http::response(['id' => 'pay_' . uniqid(), 'status' => 'PENDING', 'invoiceUrl' => 'https://asaas.test/invoice', 'pixQrCode' => null], 200),
            '*/payments/*/refund' => Http::response(['id' => 'ref_' . uniqid(), 'status' => 'REFUNDED'], 200),
        ]);
    }

    public function test_socio_cria_produto_de_entrega_avulso_sem_estabelecimento(): void
    {
        $socio = $this->criarSocio();

        $response = $this->actingAs($socio)->post('/produtos-entrega', [
            'nome' => 'Botijão de Gás P13', 'categoria' => 'Gás e água',
            'descricao' => 'Completo, com mangueira',
            'valor' => 120.50,
            'estoque_disponivel' => 5,
            'ativo' => true,
            'endereco_cep' => '01000000',
            'endereco_rua' => 'Rua do Gás',
            'endereco_numero' => '10',
            'endereco_bairro' => 'Centro',
            'endereco_cidade' => 'São Paulo',
            'endereco_estado' => 'SP',
        ]);

        $response->assertRedirect();
        $produto = ProdutoEntrega::where('usuario_id', $socio->id)->first();
        $this->assertNotNull($produto);
        $this->assertNull($produto->estabelecimento_id);
        $this->assertSame(120.5, (float) $produto->valor);
    }

    public function test_tela_de_gerenciamento_de_produtos_de_entrega_carrega_para_o_socio(): void
    {
        $socio = $this->criarSocio();
        $this->criarProdutoAvulso($socio);

        // O endereço antigo leva para a tela única de produtos, na aba "Entrega e retirada".
        $this->actingAs($socio)->get('/produtos-entrega')->assertRedirect(route('produtos.meus', ['aba' => 'entrega']));

        $response = $this->actingAs($socio)->get('/meus-produtos?aba=entrega');

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Estabelecimentos/Produtos')
            ->where('aba', 'entrega')
            ->where('podeEntrega', true)
            ->has('entrega.produtos', 1)
            ->has('entrega.estabelecimentos')
            ->has('entrega.funcionarios')
            ->has('entrega.pedidosRecebidos')
            ->has('vinculados.listaServicos')
            ->has('vinculados.listaReservas'));
    }

    public function test_gerente_ve_so_a_aba_de_produtos_com_servico_ou_reserva(): void
    {
        $gerente = User::create(['name' => 'Gerente', 'email' => 'ger' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'gerente']);

        $response = $this->actingAs($gerente)->get('/meus-produtos?aba=entrega');

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Estabelecimentos/Produtos')
            ->where('aba', 'vinculados')
            ->where('podeEntrega', false)
            ->where('entrega', null));
    }

    public function test_socio_nao_pode_vincular_produto_a_estabelecimento_de_outro(): void
    {
        $socio = $this->criarSocio();
        $outroSocio = $this->criarSocio('Outro Socio');
        $estabelecimentoAlheio = Estabelecimento::create(['nome' => 'Loja Alheia ' . uniqid()]);
        $estabelecimentoAlheio->proprietarios()->attach($outroSocio->id, ['tipo' => 'socio']);

        $response = $this->actingAs($socio)->post('/produtos-entrega', [
            'nome' => 'Produto Indevido', 'categoria' => 'Outros', 'valor' => 10, 'estabelecimento_id' => $estabelecimentoAlheio->id,
            'endereco_cep' => '01000000', 'endereco_rua' => 'Rua X', 'endereco_numero' => '1',
            'endereco_bairro' => 'Centro', 'endereco_cidade' => 'São Paulo', 'endereco_estado' => 'SP',
        ]);

        $response->assertForbidden();
        $this->assertNull(ProdutoEntrega::where('nome', 'Produto Indevido')->first());
    }

    public function test_cliente_cria_pedido_de_retirada_e_paga_online(): void
    {
        $this->fakeAsaasPagamentoOk();
        $socio = $this->criarSocio();
        $this->criarProviderComWallet($socio);
        $produto = $this->criarProdutoAvulso($socio, valor: 50.0, estoque: 10);
        $cliente = $this->criarCliente();

        $response = $this->actingAs($cliente)->postJson('/entregas/pedidos', [
            'produto_entrega_id' => $produto->id,
            'quantidade' => 2,
            'modo_recebimento' => 'retirada',
            'metodo_pagamento' => 'pix',
            'asaas_customer_id' => 'cus_fake',
        ]);

        $response->assertCreated();
        $pedido = PedidoEntrega::where('cliente_id', $cliente->id)->first();
        $this->assertNotNull($pedido);
        $this->assertSame(100.0, (float) $pedido->valor_total);
        $this->assertSame(1.0, (float) $pedido->taxa_plataforma); // 1% de 100
        $this->assertSame(8, $produto->fresh()->estoque_disponivel); // 10 - 2
        $this->assertNotNull($pedido->pagamento_id);

        $pagamento = Pagamento::find($pedido->pagamento_id);
        $this->assertSame($pedido->id, $pagamento->pedido_entrega_id);
    }

    public function test_pedido_usa_preco_promocional_e_cobra_taxa_de_entrega_so_quando_e_entrega(): void
    {
        $this->fakeAsaasPagamentoOk();
        $socio = $this->criarSocio();
        $this->criarProviderComWallet($socio);
        $produto = ProdutoEntrega::create([
            'usuario_id' => $socio->id, 'nome' => 'Água Mineral 20L',
            'valor' => 50, 'tem_promocao' => true, 'valor_promocional' => 40, 'taxa_entrega' => 8,
            'estoque_disponivel' => 10, 'ativo' => true,
            'endereco_cep' => '01000000', 'endereco_rua' => 'Rua da Água', 'endereco_numero' => '5',
            'endereco_bairro' => 'Centro', 'endereco_cidade' => 'São Paulo', 'endereco_estado' => 'SP',
        ]);
        $cliente = $this->criarCliente();

        $respostaRetirada = $this->actingAs($cliente)->postJson('/entregas/pedidos', [
            'produto_entrega_id' => $produto->id, 'quantidade' => 1, 'modo_recebimento' => 'retirada',
            'metodo_pagamento' => 'pix', 'asaas_customer_id' => 'cus_fake',
        ]);
        $respostaRetirada->assertCreated();
        $pedidoRetirada = PedidoEntrega::where('cliente_id', $cliente->id)->where('modo_recebimento', 'retirada')->first();
        $this->assertSame(40.0, (float) $pedidoRetirada->valor_unitario); // usa o promocional, não o normal
        $this->assertSame(40.0, (float) $pedidoRetirada->valor_total); // sem taxa de entrega na retirada
        $this->assertSame(0.0, (float) $pedidoRetirada->taxa_entrega);

        // Limite anti-robô: 1 compra por minuto por conta.
        $this->travel(61)->seconds();
        $respostaEntrega = $this->actingAs($cliente)->postJson('/entregas/pedidos', [
            'produto_entrega_id' => $produto->id, 'quantidade' => 1, 'modo_recebimento' => 'entrega',
            'entrega_cep' => '02000000', 'entrega_rua' => 'Rua Destino', 'entrega_numero' => '20',
            'entrega_bairro' => 'Vila Nova', 'entrega_cidade' => 'São Paulo', 'entrega_estado' => 'SP',
            'metodo_pagamento' => 'pix', 'asaas_customer_id' => 'cus_fake',
        ]);
        $respostaEntrega->assertCreated();
        $pedidoEntrega = PedidoEntrega::where('cliente_id', $cliente->id)->where('modo_recebimento', 'entrega')->first();
        $this->assertSame(48.0, (float) $pedidoEntrega->valor_total); // 40 (promo) + 8 (taxa de entrega)
        $this->assertSame(8.0, (float) $pedidoEntrega->taxa_entrega);
    }

    public function test_cliente_nao_pode_pedir_mais_do_que_o_estoque(): void
    {
        $socio = $this->criarSocio();
        $this->criarProviderComWallet($socio);
        $produto = $this->criarProdutoAvulso($socio, valor: 50.0, estoque: 1);
        $cliente = $this->criarCliente();

        $response = $this->actingAs($cliente)->postJson('/entregas/pedidos', [
            'produto_entrega_id' => $produto->id,
            'quantidade' => 5,
            'modo_recebimento' => 'retirada',
            'metodo_pagamento' => 'pix',
        ]);

        $response->assertStatus(422);
        $this->assertSame(1, $produto->fresh()->estoque_disponivel);
    }

    public function test_entrega_exige_endereco_de_entrega(): void
    {
        $socio = $this->criarSocio();
        $this->criarProviderComWallet($socio);
        $produto = $this->criarProdutoAvulso($socio);
        $cliente = $this->criarCliente();

        $response = $this->actingAs($cliente)->postJson('/entregas/pedidos', [
            'produto_entrega_id' => $produto->id,
            'quantidade' => 1,
            'modo_recebimento' => 'entrega',
            'metodo_pagamento' => 'pix',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['entrega_rua', 'entrega_cep']);
    }

    public function test_cancelamento_de_pedido_ainda_nao_pago_restaura_estoque_sem_chamar_asaas(): void
    {
        Http::fake(); // nenhuma chamada deveria sair
        $socio = $this->criarSocio();
        $produto = $this->criarProdutoAvulso($socio, estoque: 10);
        $cliente = $this->criarCliente();

        $pedido = PedidoEntrega::create([
            'codigo_pedido' => 'ENT-TESTE1', 'cliente_id' => $cliente->id, 'produto_entrega_id' => $produto->id,
            'vendedor_id' => $socio->id, 'quantidade' => 3, 'valor_unitario' => 50, 'valor_total' => 150,
            'modo_recebimento' => 'retirada', 'status' => 'pendente_pagamento',
        ]);
        $produto->decrement('estoque_disponivel', 3);

        $response = $this->actingAs($cliente)->postJson("/entregas/pedidos/{$pedido->id}/cancelar");

        $response->assertOk();
        $this->assertSame('cancelado', $pedido->fresh()->status);
        $this->assertSame(10, $produto->fresh()->estoque_disponivel);
        Http::assertNothingSent();
    }

    public function test_cancelamento_do_vendedor_de_pedido_pago_gera_estorno_visivel_ao_admin(): void
    {
        $this->fakeAsaasPagamentoOk();
        $socio = $this->criarSocio();
        $this->criarProviderComWallet($socio);
        $estabelecimento = Estabelecimento::create(['nome' => 'Loja Entrega ' . uniqid()]);
        $estabelecimento->proprietarios()->attach($socio->id, ['tipo' => 'socio']);

        $produto = ProdutoEntrega::create([
            'usuario_id' => $socio->id, 'estabelecimento_id' => $estabelecimento->id, 'nome' => 'Água Mineral 20L',
            'valor' => 30, 'estoque_disponivel' => 10, 'ativo' => true,
            'endereco_cep' => '01000000', 'endereco_rua' => 'Rua da Água', 'endereco_numero' => '5',
            'endereco_bairro' => 'Centro', 'endereco_cidade' => 'São Paulo', 'endereco_estado' => 'SP',
        ]);
        $cliente = $this->criarCliente();

        $pedido = PedidoEntrega::create([
            'codigo_pedido' => 'ENT-TESTE2', 'cliente_id' => $cliente->id, 'produto_entrega_id' => $produto->id,
            'vendedor_id' => $socio->id, 'estabelecimento_id' => $estabelecimento->id,
            'quantidade' => 1, 'valor_unitario' => 30, 'valor_total' => 30, 'modo_recebimento' => 'retirada', 'status' => 'pago',
        ]);
        $pagamento = Pagamento::create([
            'usuario_id' => $cliente->id, 'estabelecimento_id' => $estabelecimento->id, 'pedido_entrega_id' => $pedido->id,
            'valor' => 30, 'valor_total' => 30, 'valor_liquido' => 29.7, 'metodo_pagamento' => 'pix',
            'status' => 'pago', 'id_transacao_gateway' => 'pay_' . uniqid(),
        ]);
        $pedido->update(['pagamento_id' => $pagamento->id]);

        // Comprador não cancela pedido já pago online: quem cancela e devolve é o vendedor.
        $this->actingAs($cliente)->postJson("/entregas/pedidos/{$pedido->id}/cancelar")->assertStatus(409);

        $response = $this->actingAs($socio)->postJson("/entregas/pedidos/{$pedido->id}/cancelar-vendedor");

        $response->assertOk();
        $this->assertSame('estornado', $pagamento->fresh()->status);

        $estorno = Estorno::where('pagamento_id', $pagamento->id)->first();
        $this->assertNotNull($estorno);
        $this->assertSame('ENTREGA', $estorno->categoria);
        $this->assertSame($pedido->id, $estorno->pedido_entrega_id);

        $admin = User::create(['name' => 'Admin Entrega', 'email' => 'admin-ent' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'admin']);
        $respAdmin = $this->actingAs($admin)->getJson('/api/admin/estornos');
        $respAdmin->assertOk();
        $ids = collect($respAdmin->json('data.data'))->pluck('id');
        $this->assertTrue($ids->contains($estorno->id));
    }

    public function test_so_o_vendedor_libera_o_pedido_com_o_codigo_de_6_digitos(): void
    {
        $socio = $this->criarSocio();
        $produto = $this->criarProdutoAvulso($socio);
        $cliente = $this->criarCliente();

        $pedido = PedidoEntrega::create([
            'codigo_pedido' => 'ENT-TESTE3', 'cliente_id' => $cliente->id, 'produto_entrega_id' => $produto->id,
            'vendedor_id' => $socio->id, 'quantidade' => 1, 'valor_unitario' => 50, 'valor_total' => 50,
            'modo_recebimento' => 'retirada', 'modo_pagamento' => 'local', 'codigo_confirmacao' => '483920',
            'status' => 'aguardando_confirmacao',
        ]);

        // O cliente não confirma a própria entrega.
        $this->actingAs($cliente)->postJson("/entregas/pedidos/{$pedido->id}/liberar", ['codigo' => '483920'])->assertForbidden();

        // Pagamento presencial é finalizado pelo vendedor, sem código (o código vale só no online).
        $this->actingAs($socio)->postJson("/entregas/pedidos/{$pedido->id}/liberar", ['codigo' => '483920'])->assertOk();
        $this->assertSame('concluido', $pedido->fresh()->status);
    }

    public function test_codigo_nao_aparece_na_resposta_do_vendedor_mas_aparece_para_o_cliente(): void
    {
        $socio = $this->criarSocio();
        $produto = $this->criarProdutoAvulso($socio);
        $cliente = $this->criarCliente();

        $pedido = PedidoEntrega::create([
            'codigo_pedido' => 'ENT-TESTE5', 'cliente_id' => $cliente->id, 'produto_entrega_id' => $produto->id,
            'vendedor_id' => $socio->id, 'quantidade' => 1, 'valor_unitario' => 50, 'valor_total' => 50,
            'modo_recebimento' => 'retirada', 'modo_pagamento' => 'direto_vendedor', 'codigo_confirmacao' => '770011',
            'status' => 'aguardando_confirmacao',
        ]);

        $this->actingAs($socio)->getJson('/entregas/pedidos-recebidos')->assertOk()
            ->assertJsonMissingPath('pedidos.0.codigo_confirmacao');

        $this->actingAs($cliente)->get("/entregas/pedidos/{$pedido->id}")->assertOk()
            ->assertInertia(fn ($page) => $page->where('pedido.codigo_confirmacao_visivel', '770011'));
    }

    public function test_gerencia_pode_atribuir_funcionario_mas_funcionario_comum_so_pode_pegar_pra_si(): void
    {
        $socio = $this->criarSocio();
        $estabelecimento = Estabelecimento::create(['nome' => 'Loja Func ' . uniqid()]);
        $estabelecimento->proprietarios()->attach($socio->id, ['tipo' => 'socio']);

        $produto = ProdutoEntrega::create([
            'usuario_id' => $socio->id, 'estabelecimento_id' => $estabelecimento->id, 'nome' => 'Pizza Grande',
            'valor' => 60, 'estoque_disponivel' => 10, 'ativo' => true,
            'endereco_cep' => '01000000', 'endereco_rua' => 'Rua da Pizza', 'endereco_numero' => '1',
            'endereco_bairro' => 'Centro', 'endereco_cidade' => 'São Paulo', 'endereco_estado' => 'SP',
        ]);
        $cliente = $this->criarCliente();
        $pedido = PedidoEntrega::create([
            'codigo_pedido' => 'ENT-FUNC1', 'cliente_id' => $cliente->id, 'produto_entrega_id' => $produto->id,
            'vendedor_id' => $socio->id, 'estabelecimento_id' => $estabelecimento->id,
            'quantidade' => 1, 'valor_unitario' => 60, 'valor_total' => 60, 'modo_recebimento' => 'retirada', 'status' => 'pago',
        ]);

        $funcionarioUser = $this->criarCliente('Entregador Um');
        $funcionario = \App\Models\Funcionario::create(['estabelecimento_id' => $estabelecimento->id, 'usuario_id' => $funcionarioUser->id, 'nome' => 'Entregador Um', 'ativo' => true]);

        $outroFuncionarioUser = $this->criarCliente('Entregador Dois');
        $outroFuncionario = \App\Models\Funcionario::create(['estabelecimento_id' => $estabelecimento->id, 'usuario_id' => $outroFuncionarioUser->id, 'nome' => 'Entregador Dois', 'ativo' => true]);

        // Um funcionário comum não pode atribuir o pedido a OUTRO funcionário.
        $respNegada = $this->actingAs($funcionarioUser)->post("/entregas/pedidos/{$pedido->id}/funcionario", [
            'funcionario_id' => $outroFuncionario->id,
        ]);
        $respNegada->assertForbidden();

        // Mas pode pegar o pedido livre para si mesmo.
        $respSelf = $this->actingAs($funcionarioUser)->post("/entregas/pedidos/{$pedido->id}/funcionario", [
            'funcionario_id' => $funcionario->id,
        ]);
        $respSelf->assertRedirect();
        $this->assertSame($funcionario->id, $pedido->fresh()->funcionario_id);

        // O sócio (gerência) pode reatribuir livremente.
        $respSocio = $this->actingAs($socio)->post("/entregas/pedidos/{$pedido->id}/funcionario", [
            'funcionario_id' => $outroFuncionario->id,
        ]);
        $respSocio->assertRedirect();
        $this->assertSame($outroFuncionario->id, $pedido->fresh()->funcionario_id);
        $this->assertSame($socio->id, $pedido->fresh()->atribuido_por);
    }

    public function test_paginas_web_do_cliente_de_entregas_carregam(): void
    {
        $socio = $this->criarSocio();
        $produto = $this->criarProdutoAvulso($socio);
        $cliente = $this->criarCliente();

        $pedido = PedidoEntrega::create([
            'codigo_pedido' => 'ENT-WEBPAGES', 'cliente_id' => $cliente->id, 'produto_entrega_id' => $produto->id,
            'vendedor_id' => $socio->id, 'quantidade' => 1, 'valor_unitario' => 50, 'valor_total' => 50,
            'modo_recebimento' => 'retirada', 'status' => 'pago',
        ]);

        $this->actingAs($cliente)->get('/entregas')->assertOk()
            ->assertInertia(fn ($page) => $page->component('Entregas/Catalogo'));

        $this->actingAs($cliente)->get("/entregas/produtos/{$produto->id}")->assertOk()
            ->assertInertia(fn ($page) => $page->component('Entregas/ProdutoDetalhe')->where('produto.id', $produto->id));

        $this->actingAs($cliente)->get('/entregas/meus-pedidos')->assertOk()
            ->assertInertia(fn ($page) => $page->component('Entregas/MeusPedidos')->has('pedidos', 1));

        $this->actingAs($cliente)->get("/entregas/pedidos/{$pedido->id}")->assertOk()
            ->assertInertia(fn ($page) => $page->component('Entregas/Confirmacao')->where('pedido.id', $pedido->id));
    }

    public function test_webhook_payment_received_confirma_pedido_de_entrega(): void
    {
        $socio = $this->criarSocio();
        $produto = $this->criarProdutoAvulso($socio);
        $cliente = $this->criarCliente();

        $pedido = PedidoEntrega::create([
            'codigo_pedido' => 'ENT-TESTE4', 'cliente_id' => $cliente->id, 'produto_entrega_id' => $produto->id,
            'vendedor_id' => $socio->id, 'quantidade' => 1, 'valor_unitario' => 50, 'valor_total' => 50,
            'modo_recebimento' => 'retirada', 'status' => 'pendente_pagamento',
        ]);
        $pagamento = Pagamento::create([
            'usuario_id' => $cliente->id, 'pedido_entrega_id' => $pedido->id,
            'valor' => 50, 'valor_total' => 50, 'valor_liquido' => 49.5, 'metodo_pagamento' => 'pix',
            'status' => 'pendente', 'id_transacao_gateway' => 'pay_webhook_' . uniqid(),
        ]);
        $pedido->update(['pagamento_id' => $pagamento->id]);

        $response = $this->postJson('/api/webhook/asaas', [
            'event' => 'PAYMENT_CONFIRMED',
            'payment' => ['id' => $pagamento->id_transacao_gateway],
        ]);

        $response->assertOk();
        $this->assertSame('pago', $pagamento->fresh()->status);
        $this->assertSame('pago', $pedido->fresh()->status);
    }
}
