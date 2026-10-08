<?php

namespace Tests\Feature;

use App\Models\Agendamento;
use App\Models\Aluguel;
use App\Models\Estabelecimento;
use App\Models\ItemAluguel;
use App\Models\Produto;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Fluxos de pagamento da loja e da locação. Cada teste cria os próprios dados (antes dependiam
 * do usuário 25, do produto 8 e do item 30 existirem no banco de desenvolvimento).
 */
class QaPagamentoAsaasTest extends TestCase
{
    use DatabaseTransactions;

    private function usuario(string $papel, string $nome): User
    {
        return User::create([
            'name' => $nome, 'email' => strtolower($nome) . uniqid() . '@x.com',
            'password' => Hash::make('senha-teste-123'), 'papel' => $papel,
            'plano_assinatura' => 'gratuito', 'asaas_customer_id' => 'cus_' . uniqid(),
        ]);
    }

    /** Dono com um local, sem carteira Asaas (não recebe online). */
    private function local(): array
    {
        $dono = $this->usuario('socio', 'Dono');
        $estab = Estabelecimento::create(['nome' => 'Loja QA ' . uniqid()]);
        $estab->proprietarios()->attach($dono->id, ['tipo' => 'socio']);

        return [$dono, $estab];
    }

    private function produto(User $dono, Estabelecimento $estab): Produto
    {
        return Produto::create([
            'nome' => 'Kit QA', 'usuario_id' => $dono->id, 'estabelecimento_id' => $estab->id,
            'valor_normal' => 40, 'valor_final' => 40, 'estoque_disponivel' => 5,
        ]);
    }

    /** Item de locação avulsa: `estabelecimento_id` guarda o id do dono (users.id). */
    private function item(User $dono): ItemAluguel
    {
        return ItemAluguel::create([
            'estabelecimento_id' => $dono->id, 'nome' => 'Barraca QA', 'categoria' => 'casa',
            'periodo_faturamento_padrao' => 'diaria', 'valor_diaria' => 50, 'quantidade' => 2,
            'ativo' => true, 'disponivel' => true, 'sempre_disponivel' => true,
        ]);
    }

    public function test_compra_avulsa_de_produto_cria_agendamento_e_pedido_pendente(): void
    {
        [$dono, $estab] = $this->local();
        $cliente = $this->usuario('user', 'Cliente');
        $produto = $this->produto($dono, $estab);

        // 1) Compra avulsa do produto (mesma chamada que o botão "Comprar" da Loja faz)
        $response = $this->actingAs($cliente)->post('/cliente/carrinho/produto', [
            'produto_id' => $produto->id,
            'estabelecimento_id' => $estab->id,
            'quantidade' => 2,
        ]);

        $response->assertRedirect();
        $this->assertStringContainsString('agendamento_id=', $response->headers->get('Location'));

        $agendamento = Agendamento::where('estabelecimento_id', $estab->id)->where('usuario_id', $cliente->id)->latest()->first();
        $this->assertNotNull($agendamento);
        $this->assertEquals(80.0, (float) $agendamento->valor_final, 'Kit de R$40 x 2 deveria totalizar R$80');
        $this->assertEquals(3, $produto->fresh()->estoque_disponivel, 'Estoque deveria cair de 5 para 3 (comprou 2)');

        // 2) A tela de Agendar deve reconhecer esse pedido pendente
        $show = $this->actingAs($cliente)->get("/agendar/{$estab->id}?agendamento_id={$agendamento->id}");
        $show->assertStatus(200);
        $props = $show->viewData('page')['props'];
        $this->assertNotNull($props['pedidoProdutoPendente']);
        $this->assertEquals($agendamento->id, $props['pedidoProdutoPendente']['agendamento_id']);
        $this->assertEquals(80.0, $props['pedidoProdutoPendente']['valor_total']);
        $this->assertCount(1, $props['pedidoProdutoPendente']['itens']);
    }

    public function test_compra_avulsa_sem_estoque_nao_cria_nada(): void
    {
        [$dono, $estab] = $this->local();
        $cliente = $this->usuario('user', 'Cliente');
        $produto = $this->produto($dono, $estab);

        $this->actingAs($cliente)->post('/cliente/carrinho/produto', [
            'produto_id' => $produto->id, 'estabelecimento_id' => $estab->id, 'quantidade' => 6,
        ])->assertSessionHasErrors('error');

        $this->assertSame(5, $produto->fresh()->estoque_disponivel);
        $this->assertSame(0, Agendamento::where('usuario_id', $cliente->id)->count());
    }

    public function test_reserva_online_tenta_gerar_cobranca_asaas_e_falha_de_forma_amigavel_sem_carteira(): void
    {
        // O dono não tem carteira Asaas: o fluxo chega ao PagamentoService e falha com mensagem
        // amigável, sem erro 500 e sem deixar a reserva no banco (rollback).
        Http::fake();
        [$dono] = $this->local();
        $cliente = $this->usuario('user', 'Cliente');
        $item = $this->item($dono);

        $response = $this->actingAs($cliente)->post("/itens/{$item->id}/reservar", [
            'data_inicio' => now()->addDay()->toDateString(),
            'data_fim' => now()->addDays(3)->toDateString(),
            'quantidade' => 1,
            'forma_pagamento' => 'online',
            'metodo_pagamento' => 'pix',
        ]);

        $response->assertSessionHasErrors('error');
        $this->assertEquals(0, Aluguel::where('item_aluguel_id', $item->id)->count(), 'Reserva deveria ter sido desfeita (rollback) apos falha no Asaas');
    }

    public function test_reserva_presencial_confirma_sem_chamar_gateway(): void
    {
        Http::fake();
        [$dono] = $this->local();
        $cliente = $this->usuario('user', 'Cliente');
        $item = $this->item($dono);

        $response = $this->actingAs($cliente)->post("/itens/{$item->id}/reservar", [
            'data_inicio' => now()->addDay()->toDateString(),
            'data_fim' => now()->addDays(2)->toDateString(),
            'quantidade' => 1,
            'forma_pagamento' => 'presencial',
        ]);

        $response->assertRedirect(route('dashboard'));

        $aluguel = Aluguel::where('item_aluguel_id', $item->id)->where('forma_pagamento', 'presencial')->first();
        $this->assertNotNull($aluguel);
        $this->assertEquals('confirmado', $aluguel->status);
        Http::assertNotSent(fn ($r) => str_contains($r->url(), '/payments'));
    }

    public function test_pagamento_local_de_pedido_de_produto_confirma_corretamente(): void
    {
        // Regressão: PagamentoService usava isset($agendamento->servico_id) para distinguir
        // Agendamento de Aluguel, o que falha quando servico_id é NULL (pedido de produto avulso).
        Http::fake();
        [, $estab] = $this->local();
        $cliente = $this->usuario('user', 'Cliente');

        $agendamento = Agendamento::create([
            'usuario_id' => $cliente->id,
            'estabelecimento_id' => $estab->id,
            'status' => 'pendente',
            'valor_original' => 0,
            'valor_final' => 40,
            'codigo_verificacao' => '9999',
        ]);

        $response = $this->actingAs($cliente)->post('/pagamento/processar', [
            'agendamento_id' => $agendamento->id,
            'metodo_pagamento' => 'local',
        ]);

        $response->assertOk();
        $response->assertJson(['status' => 'success', 'metodo' => 'local']);

        $agendamento->refresh();
        $this->assertEquals('confirmado', $agendamento->status);
        $this->assertEquals('local', $agendamento->status_pagamento);
    }
}
