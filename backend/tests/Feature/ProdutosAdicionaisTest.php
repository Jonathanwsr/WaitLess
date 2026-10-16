<?php

namespace Tests\Feature;

use App\Models\Agendamento;
use App\Models\Aluguel;
use App\Models\Estabelecimento;
use App\Models\ItemAluguel;
use App\Models\Produto;
use App\Models\Servico;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProdutosAdicionaisTest extends TestCase
{
    use DatabaseTransactions;

    private function usuario(string $papel = 'user', array $extra = []): User
    {
        return User::create(array_merge([
            'name' => 'U' . uniqid(), 'email' => uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'),
            'papel' => $papel, 'plano_assinatura' => 'gratuito',
        ], $extra));
    }

    private function cenario(): array
    {
        $socio = $this->usuario('socio');
        $local = Estabelecimento::create(['nome' => 'SALÃO & POUSADA', 'ativo' => true]);
        $local->proprietarios()->attach($socio->id, ['tipo' => 'socio']);
        $corte = Servico::create(['estabelecimento_id' => $local->id, 'nome' => 'CORTE', 'tipo_servico' => 'Barbearia', 'valor' => 50, 'duracao_minutos' => 30, 'ativo' => true, 'horarios_disponiveis' => ['10:00'], 'configuracoes' => ['tipo_pagamento' => 'presencial']]);
        $barba = Servico::create(['estabelecimento_id' => $local->id, 'nome' => 'BARBA', 'tipo_servico' => 'Barbearia', 'valor' => 30, 'duracao_minutos' => 30, 'ativo' => true]);
        $chale = ItemAluguel::create(['estabelecimento_id' => $socio->id, 'local_id' => $local->id, 'nome' => 'CHALÉ', 'categoria' => 'chalé', 'valor_diaria' => 200,
            'ativo' => true, 'disponivel' => true, 'sempre_disponivel' => true, 'quantidade' => 1, 'periodo_faturamento_padrao' => 'diaria']);

        $p = fn (array $d) => Produto::create(array_merge(['usuario_id' => $socio->id, 'estabelecimento_id' => $local->id, 'valor_normal' => 10, 'valor_final' => 10, 'estoque_disponivel' => 5, 'atrelado_reservas' => true], $d));
        $produtos = [
            'local' => $p(['nome' => 'ÁGUA']),
            'pomada' => $p(['nome' => 'POMADA', 'servico_id' => $corte->id, 'valor_normal' => 25, 'valor_final' => 25]),
            'oleo' => $p(['nome' => 'ÓLEO DE BARBA', 'servico_id' => $barba->id]),
            'lenha' => $p(['nome' => 'LENHA', 'aluguel_id' => $chale->id, 'valor_normal' => 40, 'valor_final' => 40]),
            'loja' => $p(['nome' => 'CAMISETA', 'atrelado_reservas' => false]),
            'premium' => $p(['nome' => 'KIT VIP', 'somente_premium' => true]),
            'esgotado' => $p(['nome' => 'SEM ESTOQUE', 'estoque_disponivel' => 0]),
        ];

        return compact('socio', 'local', 'corte', 'barba', 'chale', 'produtos');
    }

    public function test_socio_escolhe_onde_o_produto_aparece_e_o_vinculo_e_conferido(): void
    {
        ['socio' => $socio, 'local' => $local, 'corte' => $corte, 'chale' => $chale] = $this->cenario();
        $outro = Servico::create(['estabelecimento_id' => Estabelecimento::create(['nome' => 'OUTRO', 'ativo' => true])->id, 'nome' => 'X', 'tipo_servico' => 'Outros', 'valor' => 1, 'duracao_minutos' => 30, 'ativo' => true]);
        Sanctum::actingAs($socio);
        $base = ['estabelecimento_id' => $local->id, 'nome' => 'PRODUTO', 'valor_normal' => 12, 'estoque_disponivel' => 3];

        $id = $this->postJson('/api/mobile/produtos', $base + ['vinculo_modo' => 'servico', 'servico_id' => $corte->id])->assertCreated()->json('id');
        $p = Produto::find($id);
        $this->assertTrue($p->atrelado_reservas);
        $this->assertSame($corte->id, (int) $p->servico_id);

        // Muda para "em uma reserva": o serviço sai, a reserva entra.
        $this->postJson("/api/mobile/produtos/{$id}", ['vinculo_modo' => 'reserva', 'aluguel_id' => $chale->id])->assertOk();
        $p->refresh();
        $this->assertNull($p->servico_id);
        $this->assertSame($chale->id, (int) $p->aluguel_id);

        // "Só na loja" limpa tudo.
        $this->postJson("/api/mobile/produtos/{$id}", ['vinculo_modo' => 'loja'])->assertOk();
        $p->refresh();
        $this->assertFalse($p->atrelado_reservas);
        $this->assertNull($p->aluguel_id);

        // Serviço de outro local é recusado com mensagem.
        $this->postJson('/api/mobile/produtos', $base + ['vinculo_modo' => 'servico', 'servico_id' => $outro->id])->assertStatus(422)->assertJsonPath('error', 'Escolha um serviço deste local.');

        // Formato antigo do app (só servico_id, sem marcar "permitir vínculo") agora vira adicional de verdade.
        $antigo = $this->postJson('/api/mobile/produtos', $base + ['servico_id' => $corte->id])->assertCreated()->json('id');
        $this->assertTrue(Produto::find($antigo)->atrelado_reservas);

        // A tela lista reservas de qualquer tipo, com o nome amigável da categoria.
        $reserva = collect($this->getJson('/api/mobile/meus-produtos')->assertOk()->json('reservas'))->firstWhere('id', $chale->id);
        $this->assertSame('Chalé', $reserva['categoria_rotulo']);
    }

    public function test_cliente_ve_so_os_adicionais_do_servico_ou_da_reserva(): void
    {
        ['corte' => $corte, 'chale' => $chale] = $this->cenario();
        Sanctum::actingAs($this->usuario());

        $doCorte = collect($this->getJson("/api/mobile/produtos/adicionais?servico_id={$corte->id}")->assertOk()->json('produtos'));
        $this->assertEqualsCanonicalizing(['ÁGUA', 'POMADA'], $doCorte->pluck('nome')->all());
        $this->assertSame('Feito para CORTE', $doCorte->firstWhere('nome', 'POMADA')['vinculo_texto']);
        $this->assertSame('Disponível em todo o local', $doCorte->firstWhere('nome', 'ÁGUA')['vinculo_texto']);

        $doChale = collect($this->getJson("/api/mobile/produtos/adicionais?item_aluguel_id={$chale->id}")->assertOk()->json('produtos'))->pluck('nome');
        $this->assertEqualsCanonicalizing(['ÁGUA', 'LENHA'], $doChale->all());

        // Premium vê o produto exclusivo.
        Sanctum::actingAs($this->usuario('user', ['plano_assinatura' => 'premium', 'plano_expira_em' => now()->addMonth()]));
        $this->assertContains('KIT VIP', collect($this->getJson("/api/mobile/produtos/adicionais?servico_id={$corte->id}")->json('produtos'))->pluck('nome'));
    }

    public function test_agendamento_pelo_site_cobra_registra_e_baixa_o_estoque_dos_adicionais(): void
    {
        ['local' => $local, 'corte' => $corte, 'produtos' => $p] = $this->cenario();
        $cliente = $this->usuario();

        $this->actingAs($cliente)->post(route('cliente.agendar.store', $local->id), [
            'servico_id' => $corte->id, 'data_agendamento' => now()->addDays(2)->toDateString(), 'hora_agendamento' => '10:00',
            'forma_pagamento' => 'presencial',
            'extras' => [['id' => $p['pomada']->id, 'quantidade' => 2], ['id' => $p['local']->id, 'quantidade' => 1]],
        ])->assertSessionHasNoErrors();

        $ag = Agendamento::where('usuario_id', $cliente->id)->firstOrFail();
        $this->assertEquals(50 + 2 * 25 + 10, (float) $ag->valor_final);
        $this->assertSame(3, $p['pomada']->fresh()->estoque_disponivel);
        $this->assertSame(2, (int) $p['pomada']->fresh()->quantidade_vendida);
        $this->assertSame(2, (int) DB::table('itens_aluguel')->where('agendamento_id', $ag->id)->where('produto_id', $p['pomada']->id)->value('quantidade'));

        // Adicional de outro serviço não entra: recusado, sem criar nada.
        $this->actingAs($cliente)->post(route('cliente.agendar.store', $local->id), [
            'servico_id' => $corte->id, 'data_agendamento' => now()->addDays(3)->toDateString(), 'hora_agendamento' => '10:00',
            'forma_pagamento' => 'presencial', 'extras' => [['id' => $p['oleo']->id, 'quantidade' => 1]],
        ])->assertSessionHasErrors('extras');
        $this->assertSame(1, Agendamento::where('usuario_id', $cliente->id)->count());
    }

    public function test_reserva_pelo_app_soma_os_adicionais_e_respeita_o_estoque(): void
    {
        ['chale' => $chale, 'produtos' => $p] = $this->cenario();
        $cliente = $this->usuario();
        Sanctum::actingAs($cliente);
        $corpo = ['tipo_periodo' => 'diaria', 'quantidade_periodos' => 1, 'data_inicio' => now()->addDays(5)->toDateString(), 'pessoas' => 1, 'forma_pagamento' => 'presencial'];

        // Mais unidades do que o estoque: recusado com a quantidade restante.
        $this->postJson("/api/mobile/reservas/item/{$chale->id}/store", $corpo + ['extras' => [['id' => $p['lenha']->id, 'quantidade' => 9]]])
            ->assertStatus(422)->assertJsonPath('error', 'Só restam 5 unidade(s) de "LENHA".');
        $this->assertSame(0, Aluguel::where('locatario_id', $cliente->id)->count());

        $this->postJson("/api/mobile/reservas/item/{$chale->id}/store", $corpo + ['extras' => [['id' => $p['lenha']->id, 'quantidade' => 2]]])->assertCreated();
        $aluguel = Aluguel::where('locatario_id', $cliente->id)->firstOrFail();
        $semAdicionais = 200 + 200 * \App\Support\Taxas::fracao();
        $this->assertEqualsWithDelta($semAdicionais + 80, (float) $aluguel->valor_total, 0.02);
        $this->assertSame(3, $p['lenha']->fresh()->estoque_disponivel);

        $this->getJson("/api/mobile/alugueis/{$aluguel->id}")->assertOk()
            ->assertJsonPath('itens_extras.0.nome', 'LENHA')->assertJsonPath('itens_extras.0.quantidade', 2);
    }
}
