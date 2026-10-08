<?php

namespace Tests\Feature;

use App\Models\Estabelecimento;
use App\Models\PedidoEntrega;
use App\Models\ProdutoEntrega;
use App\Models\Provider;
use App\Models\User;
use App\Services\Entregas\EntregasRecursosService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class BlindagemComprasProdutosTest extends TestCase
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

    private function vendedor(): array
    {
        $socio = $this->usuario('socio', 'Vendedor', 'premium-socio');
        $estab = Estabelecimento::create(['nome' => 'Mercearia Central ' . uniqid()]);
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

    private function produto(User $vendedor, Estabelecimento $estab, array $extra = []): ProdutoEntrega
    {
        return ProdutoEntrega::create(array_merge([
            'usuario_id' => $vendedor->id, 'estabelecimento_id' => $estab->id, 'nome' => 'Gás P13', 'categoria' => 'Gás e água',
            'valor' => 100, 'estoque_disponivel' => 10, 'ativo' => true, 'taxa_entrega' => 0,
            'aceita_entrega' => true, 'aceita_retirada' => true,
            'endereco_cep' => '01000000', 'endereco_rua' => 'R', 'endereco_numero' => '1',
            'endereco_bairro' => 'C', 'endereco_cidade' => 'São Paulo', 'endereco_estado' => 'SP',
        ], $extra));
    }

    private function compraNoLocal(ProdutoEntrega $produto): array
    {
        return [
            'produto_entrega_id' => $produto->id, 'quantidade' => 1,
            'modo_recebimento' => 'retirada', 'modo_pagamento' => 'local',
        ];
    }

    private function nomesDoCatalogo(User $user, array $params): array
    {
        return collect($this->actingAs($user)->getJson('/entregas/catalogo?' . http_build_query($params))->assertOk()->json('data'))
            ->pluck('nome')->all();
    }

    public function test_busca_ignora_acentos_e_maiusculas(): void
    {
        [$vendedor, $estab] = $this->vendedor();
        $cliente = $this->usuario('cliente', 'Cliente');
        $this->produto($vendedor, $estab, ['nome' => 'Água Mineral Crystal']);
        $this->produto($vendedor, $estab, ['nome' => 'Pão de Açúcar']);

        $this->assertSame(['Água Mineral Crystal'], $this->nomesDoCatalogo($cliente, ['busca' => 'AGUA mineral', 'estabelecimento_id' => $estab->id]));
        $this->assertSame(['Pão de Açúcar'], $this->nomesDoCatalogo($cliente, ['busca' => 'pao acucar', 'estabelecimento_id' => $estab->id]));
    }

    public function test_busca_exige_todas_as_palavras_e_procura_na_descricao_e_no_local(): void
    {
        [$vendedor, $estab] = $this->vendedor();
        $cliente = $this->usuario('cliente', 'Cliente');
        $this->produto($vendedor, $estab, ['nome' => 'Botijão de gás', 'descricao' => 'Entrega rápida no bairro']);
        $this->produto($vendedor, $estab, ['nome' => 'Galão de água', 'descricao' => 'Água de 20 litros']);

        $this->assertSame(['Botijão de gás'], $this->nomesDoCatalogo($cliente, ['busca' => 'botijao rapida', 'estabelecimento_id' => $estab->id]));
        $this->assertSame([], $this->nomesDoCatalogo($cliente, ['busca' => 'botijao litros', 'estabelecimento_id' => $estab->id]));
        $this->assertCount(2, $this->nomesDoCatalogo($cliente, ['busca' => 'mercearia', 'estabelecimento_id' => $estab->id]));
    }

    public function test_relevancia_coloca_nome_que_comeca_com_a_busca_primeiro(): void
    {
        [$vendedor, $estab] = $this->vendedor();
        $cliente = $this->usuario('cliente', 'Cliente');
        $this->produto($vendedor, $estab, ['nome' => 'Kit churrasco com carvão']);
        $this->produto($vendedor, $estab, ['nome' => 'Carvão vegetal 5kg']);

        $nomes = $this->nomesDoCatalogo($cliente, ['busca' => 'carvao', 'estabelecimento_id' => $estab->id]);

        $this->assertSame('Carvão vegetal 5kg', $nomes[0]);
    }

    public function test_curingas_do_like_nao_viram_busca_por_tudo(): void
    {
        [$vendedor, $estab] = $this->vendedor();
        $cliente = $this->usuario('cliente', 'Cliente');
        $this->produto($vendedor, $estab, ['nome' => 'Arroz 5kg']);

        $this->assertSame([], $this->nomesDoCatalogo($cliente, ['busca' => '%%', 'estabelecimento_id' => $estab->id]));
    }

    public function test_ordenar_por_menor_preco_usa_o_preco_promocional(): void
    {
        [$vendedor, $estab] = $this->vendedor();
        $cliente = $this->usuario('cliente', 'Cliente');
        $this->produto($vendedor, $estab, ['nome' => 'Caro em promoção', 'valor' => 200, 'tem_promocao' => true, 'valor_promocional' => 10]);
        $this->produto($vendedor, $estab, ['nome' => 'Barato', 'valor' => 50]);

        $nomes = $this->nomesDoCatalogo($cliente, ['ordenar' => 'menor_preco', 'estabelecimento_id' => $estab->id]);

        $this->assertSame(['Caro em promoção', 'Barato'], $nomes);
    }

    public function test_so_uma_compra_por_minuto_por_conta(): void
    {
        [$vendedor, $estab] = $this->vendedor();
        $cliente = $this->usuario('cliente', 'Cliente');
        $produto = $this->produto($vendedor, $estab);

        $this->actingAs($cliente)->postJson('/entregas/pedidos', $this->compraNoLocal($produto))->assertCreated();

        $segunda = $this->actingAs($cliente)->postJson('/entregas/pedidos', $this->compraNoLocal($produto));
        $segunda->assertStatus(429);
        $this->assertGreaterThan(0, $segunda->json('tentar_em'));
        $this->assertSame(1, PedidoEntrega::where('cliente_id', $cliente->id)->count());

        $this->travel(61)->seconds();
        $this->actingAs($cliente)->postJson('/entregas/pedidos', $this->compraNoLocal($produto))->assertCreated();
    }

    public function test_compra_recusada_por_regra_nao_bloqueia_o_minuto(): void
    {
        [$vendedor, $estab] = $this->vendedor();
        $cliente = $this->usuario('cliente', 'Cliente');
        $produto = $this->produto($vendedor, $estab, ['estoque_disponivel' => 1]);

        $this->actingAs($cliente)->postJson('/entregas/pedidos', array_merge($this->compraNoLocal($produto), ['quantidade' => 5]))
            ->assertStatus(422)
            ->assertJsonFragment(['error' => 'Estoque insuficiente para a quantidade solicitada.']);

        $this->actingAs($cliente)->postJson('/entregas/pedidos', $this->compraNoLocal($produto))->assertCreated();
    }

    public function test_compra_em_andamento_bloqueia_clique_duplo(): void
    {
        [$vendedor, $estab] = $this->vendedor();
        $cliente = $this->usuario('cliente', 'Cliente');
        $produto = $this->produto($vendedor, $estab);

        $trava = Cache::lock('compra-produto-trava:' . $cliente->id, 30);
        $trava->get();

        $this->actingAs($cliente)->postJson('/entregas/pedidos', $this->compraNoLocal($produto))->assertStatus(429);
        $this->assertSame(0, PedidoEntrega::where('cliente_id', $cliente->id)->count());

        $trava->release();
    }

    public function test_falha_do_gateway_nao_mostra_detalhes_ao_cliente_e_devolve_o_estoque(): void
    {
        Http::fake(['*' => Http::response(['errors' => [['description' => 'invalid access_token SQLSTATE walletId']]], 500)]);
        [$vendedor, $estab] = $this->vendedor();
        $cliente = $this->usuario('cliente', 'Cliente');
        $produto = $this->produto($vendedor, $estab, ['estoque_disponivel' => 3]);

        $resposta = $this->actingAs($cliente)->postJson('/entregas/pedidos', [
            'produto_entrega_id' => $produto->id, 'quantidade' => 1, 'modo_recebimento' => 'retirada',
            'modo_pagamento' => 'online', 'metodo_pagamento' => 'pix',
        ]);

        $resposta->assertStatus(422);
        $mensagem = $resposta->json('error');
        $this->assertStringNotContainsStringIgnoringCase('gateway', $mensagem);
        $this->assertStringNotContainsStringIgnoringCase('asaas', $mensagem);
        $this->assertStringNotContainsString('SQLSTATE', $mensagem);
        $this->assertNotEmpty($resposta->json('referencia'));
        $this->assertSame(3, $produto->fresh()->estoque_disponivel);
    }

    public function test_pontos_sao_sobre_o_valor_dos_produtos_sem_o_frete(): void
    {
        [$vendedor, $estab] = $this->vendedor();
        $cliente = $this->usuario('cliente', 'Cliente', 'premium');
        $produto = $this->produto($vendedor, $estab);

        $pedido = PedidoEntrega::create([
            'codigo_pedido' => 'ENT-' . uniqid(), 'codigo_confirmacao' => '111111', 'cliente_id' => $cliente->id,
            'produto_entrega_id' => $produto->id, 'vendedor_id' => $vendedor->id, 'estabelecimento_id' => $estab->id,
            'quantidade' => 1, 'valor_unitario' => 100, 'valor_total' => 115, 'taxa_entrega' => 15,
            'modo_recebimento' => 'entrega', 'modo_pagamento' => 'online', 'status' => 'concluido',
        ]);

        $this->assertSame(100, app(EntregasRecursosService::class)->pontosDaCompra($pedido));
    }

    /** Pedido online pago, com pagamento confirmado e custódia aguardando. */
    private function pedidoOnlinePago(User $cliente, ProdutoEntrega $produto): PedidoEntrega
    {
        $pedido = PedidoEntrega::create([
            'codigo_pedido' => 'ENT-' . uniqid(), 'codigo_confirmacao' => '314159', 'cliente_id' => $cliente->id,
            'produto_entrega_id' => $produto->id, 'vendedor_id' => $produto->usuario_id, 'estabelecimento_id' => $produto->estabelecimento_id,
            'quantidade' => 1, 'valor_unitario' => 100, 'valor_total' => 100,
            'modo_recebimento' => 'entrega', 'modo_pagamento' => 'online', 'status' => 'pago',
        ]);
        $pagamento = \App\Models\Pagamento::create([
            'usuario_id' => $cliente->id, 'estabelecimento_id' => $produto->estabelecimento_id, 'pedido_entrega_id' => $pedido->id,
            'gateway_pagamento' => 'Asaas', 'id_transacao_gateway' => 'pay_' . uniqid(), 'valor' => 100, 'taxa' => 1,
            'valor_liquido' => 99, 'status' => 'pago', 'metodo_pagamento' => 'pix',
        ]);
        $pedido->update(['pagamento_id' => $pagamento->id]);

        return $pedido;
    }

    public function test_codigo_errado_bloqueia_o_pedido_mesmo_trocando_de_conta(): void
    {
        Http::fake(['*' => Http::response(['ok' => true], 200)]);
        [$vendedor, $estab] = $this->vendedor();
        $cliente = $this->usuario('cliente', 'Cliente');
        $pedido = $this->pedidoOnlinePago($cliente, $this->produto($vendedor, $estab));

        $gerente = $this->usuario('gerente', 'Gerente');
        $estab->proprietarios()->attach($gerente->id, ['tipo' => 'gerente']);

        foreach (range(1, 5) as $i) {
            $quem = $i % 2 ? $vendedor : $gerente;
            $this->actingAs($quem)->postJson("/entregas/pedidos/{$pedido->id}/liberar", ['codigo' => '000000'])->assertStatus(422);
        }

        // Mesmo com o código certo, o pedido está bloqueado.
        $this->actingAs($vendedor)->postJson("/entregas/pedidos/{$pedido->id}/liberar", ['codigo' => '314159'])->assertStatus(429);
        $this->assertSame('pago', $pedido->fresh()->status);

        $this->travel(16)->minutes();
        $this->actingAs($vendedor)->postJson("/entregas/pedidos/{$pedido->id}/liberar", ['codigo' => '314159'])->assertOk();
    }

    public function test_finalizar_duas_vezes_nao_conta_venda_nem_pontos_em_dobro(): void
    {
        Http::fake(['*' => Http::response(['ok' => true], 200)]);
        [$vendedor, $estab] = $this->vendedor();
        $cliente = $this->usuario('cliente', 'Cliente', 'premium');
        $pedido = $this->pedidoOnlinePago($cliente, $this->produto($vendedor, $estab));

        $this->actingAs($vendedor)->postJson("/entregas/pedidos/{$pedido->id}/liberar", ['codigo' => '314159'])->assertOk();
        $this->actingAs($vendedor)->postJson("/entregas/pedidos/{$pedido->id}/liberar", ['codigo' => '314159'])->assertStatus(409);

        $this->assertSame(1, (int) $vendedor->fresh()->produtos_vendidos);
        $this->assertSame(1, \Illuminate\Support\Facades\DB::table('historico_pontos')->where('descricao', 'Pontos da entrega ' . $pedido->codigo_pedido)->count());
        Http::assertSentCount(1); // custódia liberada uma única vez
    }

    public function test_finalizacao_em_andamento_bloqueia_a_segunda(): void
    {
        [$vendedor, $estab] = $this->vendedor();
        $cliente = $this->usuario('cliente', 'Cliente');
        $pedido = $this->pedidoOnlinePago($cliente, $this->produto($vendedor, $estab));

        $trava = Cache::lock('finalizar-pedido-entrega:' . $pedido->id, 60);
        $trava->get();

        $this->actingAs($vendedor)->postJson("/entregas/pedidos/{$pedido->id}/liberar", ['codigo' => '314159'])->assertStatus(409);
        $this->assertSame('pago', $pedido->fresh()->status);
        $trava->release();
    }

    public function test_nao_finaliza_se_o_pagamento_ainda_nao_foi_confirmado(): void
    {
        [$vendedor, $estab] = $this->vendedor();
        $cliente = $this->usuario('cliente', 'Cliente');
        $pedido = $this->pedidoOnlinePago($cliente, $this->produto($vendedor, $estab));
        \App\Models\Pagamento::whereKey($pedido->pagamento_id)->update(['status' => 'pendente']);

        $this->actingAs($vendedor)->postJson("/entregas/pedidos/{$pedido->id}/liberar", ['codigo' => '314159'])->assertStatus(409);
        $this->assertSame('pago', $pedido->fresh()->status);
    }

    public function test_cliente_e_estranho_nao_finalizam(): void
    {
        [$vendedor, $estab] = $this->vendedor();
        $cliente = $this->usuario('cliente', 'Cliente');
        $estranho = $this->usuario('cliente', 'Estranho');
        $pedido = $this->pedidoOnlinePago($cliente, $this->produto($vendedor, $estab));

        $this->actingAs($cliente)->postJson("/entregas/pedidos/{$pedido->id}/liberar", ['codigo' => '314159'])->assertForbidden();
        $this->actingAs($estranho)->postJson("/entregas/pedidos/{$pedido->id}/liberar", ['codigo' => '314159'])->assertForbidden();
    }

    public function test_filtro_de_vendedor_premium_e_selo_sem_expor_o_plano(): void
    {
        [$premium, $estab] = $this->vendedor(); // premium-socio válido
        $gratis = $this->usuario('socio', 'Gratis');
        $estab->proprietarios()->attach($gratis->id, ['tipo' => 'socio']);
        $cliente = $this->usuario('cliente', 'Cliente');
        $this->produto($premium, $estab, ['nome' => 'Do premium']);
        $this->produto($gratis, $estab, ['nome' => 'Do gratuito']);

        $this->assertSame(['Do premium'], $this->nomesDoCatalogo($cliente, ['apenas_premium' => 1, 'estabelecimento_id' => $estab->id]));

        $itens = collect($this->actingAs($cliente)->getJson('/entregas/catalogo?estabelecimento_id=' . $estab->id)->json('data'))->keyBy('nome');
        $this->assertTrue($itens['Do premium']['vendedor_premium']);
        $this->assertFalse($itens['Do gratuito']['vendedor_premium']);
        $this->assertArrayNotHasKey('plano_assinatura', $itens['Do premium']['vendedor']);
    }

    public function test_premium_vencido_nao_conta(): void
    {
        [$vendedor, $estab] = $this->vendedor();
        $vendedor->update(['plano_expira_em' => now()->subDay()]);
        $cliente = $this->usuario('cliente', 'Cliente');
        $this->produto($vendedor, $estab, ['nome' => 'Plano vencido']);

        $this->assertSame([], $this->nomesDoCatalogo($cliente, ['apenas_premium' => 1, 'estabelecimento_id' => $estab->id]));
    }

    public function test_filtros_de_categoria_promocao_e_preco_juntos(): void
    {
        [$vendedor, $estab] = $this->vendedor();
        $cliente = $this->usuario('cliente', 'Cliente');
        $this->produto($vendedor, $estab, ['nome' => 'Água promo', 'categoria' => 'Bebidas', 'valor' => 50, 'tem_promocao' => true, 'valor_promocional' => 20]);
        $this->produto($vendedor, $estab, ['nome' => 'Água cheia', 'categoria' => 'Bebidas', 'valor' => 20]);
        $this->produto($vendedor, $estab, ['nome' => 'Gás promo', 'categoria' => 'Gás e água', 'valor' => 120, 'tem_promocao' => true, 'valor_promocional' => 100]);

        $this->assertSame(['Água promo'], $this->nomesDoCatalogo($cliente, [
            'categoria' => 'Bebidas', 'apenas_promocoes' => 1, 'preco_max' => 25, 'estabelecimento_id' => $estab->id,
        ]));
        $this->assertSame(['Gás promo'], $this->nomesDoCatalogo($cliente, ['preco_min' => 90, 'estabelecimento_id' => $estab->id]));
    }

    public function test_ordenar_por_mais_vendidos(): void
    {
        [$vendedor, $estab] = $this->vendedor();
        $cliente = $this->usuario('cliente', 'Cliente');
        $pouco = $this->produto($vendedor, $estab, ['nome' => 'Pouco vendido']);
        $muito = $this->produto($vendedor, $estab, ['nome' => 'Muito vendido']);
        foreach ([$muito, $muito, $pouco] as $p) {
            PedidoEntrega::create([
                'codigo_pedido' => 'ENT-' . uniqid(), 'codigo_confirmacao' => '111111', 'cliente_id' => $cliente->id,
                'produto_entrega_id' => $p->id, 'vendedor_id' => $vendedor->id, 'estabelecimento_id' => $estab->id,
                'quantidade' => 1, 'valor_unitario' => 100, 'valor_total' => 100,
                'modo_recebimento' => 'retirada', 'modo_pagamento' => 'local', 'status' => 'concluido',
            ]);
        }

        $nomes = $this->nomesDoCatalogo($cliente, ['ordenar' => 'mais_vendidos', 'estabelecimento_id' => $estab->id]);

        $this->assertSame(['Muito vendido', 'Pouco vendido'], $nomes);
    }
}
