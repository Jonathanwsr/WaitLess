<?php

namespace Tests\Feature;

use App\Models\Estabelecimento;
use App\Models\Funcionario;
use App\Models\PedidoEntrega;
use App\Models\ProdutoEntrega;
use App\Models\Provider;
use App\Models\User;
use App\Services\Entregas\EntregasRecursosService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class EntregasPlanosEGestaoTest extends TestCase
{
    use DatabaseTransactions;

    private function usuario(string $papel, string $nome = 'Usuario', ?string $plano = null): User
    {
        return User::create([
            'name' => $nome, 'email' => strtolower($nome) . uniqid() . '@x.com',
            'password' => Hash::make('senha-teste-123'), 'papel' => $papel,
            'plano_assinatura' => $plano ?? 'gratuito', 'plano_expira_em' => $plano ? now('America/Sao_Paulo')->addMonth() : null,
        ]);
    }

    /** Vendedor (sócio) com plano informado e um local. */
    private function vendedor(?string $plano): array
    {
        $socio = $this->usuario('socio', 'Vendedor', $plano);
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

    private function produto(User $vendedor, Estabelecimento $estab): ProdutoEntrega
    {
        return ProdutoEntrega::create([
            'usuario_id' => $vendedor->id, 'estabelecimento_id' => $estab->id, 'nome' => 'Gás P13', 'categoria' => 'Gás e água',
            'valor' => 100, 'estoque_disponivel' => 10, 'ativo' => true, 'taxa_entrega' => 0,
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

    public function test_pontos_variam_conforme_o_plano_do_cliente(): void
    {
        [$vendedor, $estab] = $this->vendedor(null);
        $produto = $this->produto($vendedor, $estab);
        $servico = app(EntregasRecursosService::class);

        $semPlano = $this->pedido($this->usuario('user', 'Sem plano'), $produto, ['status' => 'concluido', 'valor_total' => 100]);
        $premium = $this->pedido($this->usuario('user', 'Premium', 'premium'), $produto, ['status' => 'concluido', 'valor_total' => 100]);
        $plus = $this->pedido($this->usuario('user', 'Plus', 'premium-plus'), $produto, ['status' => 'concluido', 'valor_total' => 100]);

        $this->assertSame(50, $servico->pontosDaCompra($semPlano));
        $this->assertSame(100, $servico->pontosDaCompra($premium));
        $this->assertSame(300, $servico->pontosDaCompra($plus));
    }

    public function test_avaliacao_da_um_bonus_de_pontos(): void
    {
        [$vendedor, $estab] = $this->vendedor(null);
        $produto = $this->produto($vendedor, $estab);
        $cliente = $this->usuario('user', 'Cliente');
        $pedido = $this->pedido($cliente, $produto, ['status' => 'concluido', 'data_conclusao' => now()]);

        $this->actingAs($cliente)->postJson("/entregas/pedidos/{$pedido->id}/avaliar", [
            'nota_produto' => 5, 'nota_vendedor' => 5,
        ])->assertCreated();

        $this->assertSame(EntregasRecursosService::PONTOS_BONUS_AVALIACAO, (int) DB::table('pontos_usuario_estabelecimento')
            ->where('usuario_id', $cliente->id)->where('estabelecimento_id', $estab->id)->value('total_pontos'));
    }

    public function test_rastreio_so_com_vendedor_socio_premium(): void
    {
        [$vendedorBasico, $estabBasico] = $this->vendedor('premium-anual');
        $produtoBasico = $this->produto($vendedorBasico, $estabBasico);
        $cliente = $this->usuario('user', 'Cliente');
        $pedidoBasico = $this->pedido($cliente, $produtoBasico, ['em_rota_em' => now(), 'posicao_lat' => -23.5, 'posicao_lng' => -46.6]);

        $this->actingAs($vendedorBasico)->postJson("/entregas/pedidos/{$pedidoBasico->id}/posicao", ['lat' => -23.5, 'lng' => -46.6])
            ->assertStatus(403);

        $this->actingAs($cliente)->getJson("/entregas/pedidos/{$pedidoBasico->id}/posicao")
            ->assertOk()
            ->assertJsonPath('disponivel', false)
            ->assertJsonPath('em_rota', false);

        [$socioPremium, $estab] = $this->vendedor('premium-socio');
        $produto = $this->produto($socioPremium, $estab);
        $pedido = $this->pedido($cliente, $produto, ['em_rota_em' => now(), 'posicao_lat' => -23.5, 'posicao_lng' => -46.6]);

        $this->actingAs($cliente)->getJson("/entregas/pedidos/{$pedido->id}/posicao")
            ->assertOk()
            ->assertJsonPath('disponivel', true)
            ->assertJsonPath('em_rota', true);
    }

    public function test_pagamento_presencial_finaliza_sem_codigo_e_online_exige_codigo(): void
    {
        [$vendedor, $estab] = $this->vendedor(null);
        $produto = $this->produto($vendedor, $estab);
        $cliente = $this->usuario('user', 'Cliente');

        $presencial = $this->pedido($cliente, $produto, ['modo_pagamento' => 'local', 'status' => 'aguardando_confirmacao']);
        $this->actingAs($vendedor)->postJson("/entregas/pedidos/{$presencial->id}/liberar")->assertOk();
        $this->assertSame('concluido', $presencial->fresh()->status);

        $online = $this->pedido($cliente, $produto, ['modo_pagamento' => 'direto_vendedor', 'status' => 'aguardando_confirmacao']);
        $this->actingAs($vendedor)->postJson("/entregas/pedidos/{$online->id}/liberar", ['codigo' => '000000'])->assertOk();

        $pagoOnline = $this->pedido($cliente, $produto, ['modo_pagamento' => 'online', 'status' => 'aguardando_confirmacao']);
        $this->actingAs($vendedor)->postJson("/entregas/pedidos/{$pagoOnline->id}/liberar")->assertStatus(422);
        $this->assertSame('aguardando_confirmacao', $pagoOnline->fresh()->status);
    }

    public function test_sócio_escolhe_entregador_e_funcionario_ve_so_o_que_recebeu(): void
    {
        [$socio, $estab] = $this->vendedor('premium-socio');
        $produto = $this->produto($socio, $estab);
        $cliente = $this->usuario('user', 'Cliente Final');

        $fUser = $this->usuario('funcionario', 'Entregador Ana');
        $funcionario = Funcionario::create(['estabelecimento_id' => $estab->id, 'usuario_id' => $fUser->id, 'nome' => 'Ana', 'ativo' => true]);

        $atribuido = $this->pedido($cliente, $produto, ['status' => 'pago']);
        $livre = $this->pedido($cliente, $produto, ['status' => 'pago']);

        $this->actingAs($socio)->postJson("/entregas/pedidos/{$atribuido->id}/funcionario", ['funcionario_id' => $funcionario->id])->assertOk();
        $this->assertSame($fUser->id, (int) $atribuido->fresh()->entregador_usuario_id);

        $this->actingAs($socio)->postJson("/entregas/pedidos/{$livre->id}/funcionario", ['eu_mesmo' => true])->assertOk();
        $this->assertSame($socio->id, (int) $livre->fresh()->entregador_usuario_id);

        $this->actingAs($fUser)->getJson('/entregas/gestao')->assertOk()
            ->assertJsonCount(1, 'pedidos')
            ->assertJsonPath('pedidos.0.cliente.nome', 'Cliente Final')
            ->assertJsonMissingPath('pedidos.0.codigo_confirmacao_visivel');

        $resposta = $this->actingAs($socio)->getJson('/entregas/gestao')->assertOk();
        $this->assertCount(2, $resposta->json('pedidos'));
        $this->assertNull($resposta->json('pedidos.0.codigo_confirmacao_visivel'));
        $this->assertArrayNotHasKey('codigo_confirmacao', $resposta->json('pedidos.0'));
    }

    public function test_entregador_baixa_o_comprovante(): void
    {
        [$socio, $estab] = $this->vendedor('premium-socio');
        $produto = $this->produto($socio, $estab);
        $cliente = $this->usuario('user', 'Cliente');
        $fUser = $this->usuario('funcionario', 'Entregador');
        $pedido = $this->pedido($cliente, $produto, ['status' => 'pago', 'entregador_usuario_id' => $fUser->id]);

        $this->actingAs($fUser)->get("/entregas/pedidos/{$pedido->id}/comprovante-pdf")->assertOk();
    }
}
