<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Agendamento;
use App\Models\Aluguel;
use App\Models\Produto;
use Illuminate\Support\Facades\DB;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class QaPagamentoAsaasTest extends TestCase
{
    use DatabaseTransactions;

    public function test_compra_avulsa_de_produto_cria_agendamento_e_pedido_pendente(): void
    {
        $user = User::find(25);

        // 1) Compra avulsa do produto (mesma chamada que o botão "Comprar" da Loja faz)
        $response = $this->actingAs($user)->post('/cliente/carrinho/produto', [
            'produto_id' => 8,
            'estabelecimento_id' => 14,
            'quantidade' => 2,
        ]);

        $response->assertRedirect();
        $this->assertStringContainsString('agendamento_id=', $response->headers->get('Location'));

        $agendamento = Agendamento::where('estabelecimento_id', 14)->where('usuario_id', $user->id)->latest()->first();
        $this->assertNotNull($agendamento);
        $this->assertEquals(80.0, (float) $agendamento->valor_final, 'Kit de R$40 x 2 deveria totalizar R$80');

        $produto = Produto::find(8);
        $this->assertEquals(3, $produto->estoque_disponivel, 'Estoque deveria cair de 5 para 3 (comprou 2)');

        // 2) A tela de Agendar deve reconhecer esse pedido pendente
        $show = $this->actingAs($user)->get("/agendar/14?agendamento_id={$agendamento->id}");
        $show->assertStatus(200);
        $props = $show->viewData('page')['props'];
        $this->assertNotNull($props['pedidoProdutoPendente']);
        $this->assertEquals($agendamento->id, $props['pedidoProdutoPendente']['agendamento_id']);
        $this->assertEquals(80.0, $props['pedidoProdutoPendente']['valor_total']);
        $this->assertCount(1, $props['pedidoProdutoPendente']['itens']);
    }

    public function test_reserva_online_tenta_gerar_cobranca_asaas_e_falha_de_forma_amigavel_sem_carteira(): void
    {
        // Este estabelecimento de teste não tem carteira Asaas configurada
        // (provider->asaas_wallet_id), então esperamos que o fluxo chegue até
        // a chamada do PagamentoService e falhe com uma mensagem amigável —
        // sem gerar erro 500 nem deixar lixo no banco (rollback da reserva).
        $user = User::find(25);

        $response = $this->actingAs($user)->post('/itens/30/reservar', [
            'data_inicio' => now()->addDay()->toDateString(),
            'data_fim' => now()->addDays(3)->toDateString(),
            'quantidade' => 1,
            'forma_pagamento' => 'online',
            'metodo_pagamento' => 'pix',
        ]);

        $response->assertSessionHasErrors('error');

        $this->assertEquals(0, Aluguel::where('item_aluguel_id', 30)->count(), 'Reserva deveria ter sido desfeita (rollback) apos falha no Asaas');
    }

    public function test_reserva_presencial_confirma_sem_chamar_gateway(): void
    {
        $user = User::find(25);

        $response = $this->actingAs($user)->post('/itens/30/reservar', [
            'data_inicio' => now()->addDay()->toDateString(),
            'data_fim' => now()->addDays(2)->toDateString(),
            'quantidade' => 1,
            'forma_pagamento' => 'presencial',
        ]);

        $response->assertRedirect(route('dashboard'));

        $aluguel = Aluguel::where('item_aluguel_id', 30)->where('forma_pagamento', 'presencial')->first();
        $this->assertNotNull($aluguel);
        $this->assertEquals('confirmado', $aluguel->status);
    }

    public function test_pagamento_local_de_pedido_de_produto_confirma_corretamente(): void
    {
        // Regressão: PagamentoService usava isset($agendamento->servico_id)
        // pra distinguir Agendamento de Aluguel, o que falha quando
        // servico_id é NULL (pedido de produto avulso) — isset() em atributo
        // null retorna false, então tratava um Agendamento como se fosse Aluguel.
        $user = User::find(25);

        $agendamento = Agendamento::create([
            'usuario_id' => $user->id,
            'estabelecimento_id' => 14,
            'status' => 'pendente',
            'valor_original' => 0,
            'valor_final' => 40,
            'codigo_verificacao' => '9999',
        ]);

        $response = $this->actingAs($user)->post('/pagamento/processar', [
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
