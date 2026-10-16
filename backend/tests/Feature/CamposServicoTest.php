<?php

namespace Tests\Feature;

use App\Models\Agendamento;
use App\Models\Estabelecimento;
use App\Models\Servico;
use App\Models\User;
use App\Support\Categorias;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Campos novos do serviço (guincho, socorro 24h, a domicílio...) e categorias novas. */
class CamposServicoTest extends TestCase
{
    use DatabaseTransactions;

    private function usuario(string $papel = 'user'): User
    {
        return User::create(['name' => 'U' . uniqid(), 'email' => uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => $papel, 'plano_assinatura' => 'gratuito']);
    }

    private function local(User $socio): Estabelecimento
    {
        $local = Estabelecimento::create(['nome' => 'AUTO SOCORRO', 'ativo' => true, 'estado' => 'PE', 'cidade' => 'Recife']);
        $local->proprietarios()->attach($socio->id, ['tipo' => 'socio']);

        return $local;
    }

    public function test_categorias_novas_existem_com_grupo_e_entram_no_explorar(): void
    {
        $valores = Categorias::valores();
        foreach (['Guincho e Reboque', 'Socorro Mecânico 24h', 'Resgate e Remoção de Veículos', 'Borracharia e Borracharia Móvel', 'Eletricista'] as $v) {
            $this->assertContains($v, $valores);
        }
        // Os valores antigos continuam valendo.
        $this->assertContains('Automotivo', $valores);
        $this->assertTrue(collect(Categorias::servicos())->every(fn ($c) => !empty($c['grupo'])));
        $this->assertSame('Guincho e socorro 24h', collect(Categorias::explorar())->firstWhere('slug', 'socorro')['nome'] ?? Categorias::grupo('socorro')['nome']);
    }

    public function test_socio_cadastra_guincho_pelo_app_e_cliente_ve_e_agenda_com_endereco_e_taxa(): void
    {
        $socio = $this->usuario('socio');
        $local = $this->local($socio);

        Sanctum::actingAs($socio);
        $this->postJson('/api/v1/mobile/servicos', [
            'nome' => 'guincho leve', 'tipo_servico' => 'Guincho e Reboque', 'valor' => 150, 'duracao_minutos' => 60,
            'horarios_disponiveis' => ['10:00'], 'estabelecimentos_ids' => [$local->id],
            'modalidade_atendimento' => 'a_domicilio', 'atende_24h' => '1', 'raio_atendimento_km' => 40, 'taxa_deslocamento' => '30',
            'tempo_chegada_minutos' => 45, 'tipo_preco' => 'a_partir_de', 'o_que_inclui' => 'Reboque até 50 km', 'garantia_dias' => '',
        ])->assertCreated();

        $servico = Servico::where('estabelecimento_id', $local->id)->firstOrFail();
        $this->assertSame('GUINCHO LEVE', $servico->nome);
        $this->assertSame('a_domicilio', $servico->modalidade_atendimento);
        $this->assertTrue($servico->atende_24h);
        $this->assertEquals(30, (float) $servico->taxa_deslocamento);
        $this->assertNull($servico->garantia_dias);
        $this->assertContains('Atende 24h', collect($servico->atendimento['selos'])->pluck('texto')->all());

        // Valor inválido é recusado com mensagem clara.
        $this->postJson('/api/v1/mobile/servicos', ['nome' => 'x', 'tipo_servico' => 'Guincho e Reboque', 'valor' => 1, 'duracao_minutos' => 30,
            'estabelecimentos_ids' => [$local->id], 'modalidade_atendimento' => 'teletransporte'])->assertStatus(422)->assertJsonValidationErrors('modalidade_atendimento');

        // Editar só um campo não apaga os outros.
        $this->putJson("/api/v1/mobile/servicos/{$servico->id}", ['tempo_chegada_minutos' => 30])->assertOk();
        $this->assertSame(30, $servico->fresh()->tempo_chegada_minutos);
        $this->assertEquals(30, (float) $servico->fresh()->taxa_deslocamento);

        // Cliente: app mostra o bloco de atendimento e o Explorar filtra por "socorro".
        $cliente = $this->usuario();
        Sanctum::actingAs($cliente);
        $this->getJson("/api/mobile/servicos/{$servico->id}")->assertOk()
            ->assertJsonPath('servico.atendimento.modalidade', 'a_domicilio')
            ->assertJsonPath('servico.atendimento.exige_endereco', true);
        $ids = collect($this->getJson('/api/mobile/explorar?tipo_busca=servicos&categoria=socorro')->assertOk()->json('data'))->pluck('id');
        $this->assertContains($servico->id, $ids->all());

        // Agendar sem endereço: recusado. Com endereço: soma a taxa e guarda o endereço.
        $corpo = ['servico_id' => $servico->id, 'data_agendamento' => now()->addDays(2)->toDateString(), 'hora_agendamento' => '10:00', 'forma_pagamento' => 'presencial'];
        $this->actingAs($cliente)->post(route('cliente.agendar.store', $local->id), $corpo)->assertSessionHasErrors('endereco_atendimento');
        $this->actingAs($cliente)->post(route('cliente.agendar.store', $local->id), $corpo + ['endereco_atendimento' => 'Rua da Aurora, 100, Boa Vista, Recife'])->assertSessionHasNoErrors();

        $ag = Agendamento::where('usuario_id', $cliente->id)->firstOrFail();
        $this->assertEquals(180, (float) $ag->valor_final);
        $this->assertEquals(30, (float) $ag->taxa_deslocamento);
        $this->assertSame('Rua da Aurora, 100, Boa Vista, Recife', $ag->endereco_atendimento);
    }

    public function test_servico_no_local_nao_cobra_taxa_e_ignora_raio(): void
    {
        $socio = $this->usuario('socio');
        $local = $this->local($socio);
        Sanctum::actingAs($socio);
        $this->postJson('/api/v1/mobile/servicos', [
            'nome' => 'troca de óleo', 'tipo_servico' => 'Mecânica e Oficina', 'valor' => 80, 'duracao_minutos' => 30, 'estabelecimentos_ids' => [$local->id],
            'modalidade_atendimento' => 'no_local', 'raio_atendimento_km' => 10, 'taxa_deslocamento' => 20,
        ])->assertCreated();

        $s = Servico::where('estabelecimento_id', $local->id)->firstOrFail();
        $this->assertNull($s->raio_atendimento_km);
        $this->assertNull($s->taxa_deslocamento);
        $this->assertSame(0.0, \App\Support\CamposServico::taxaDoAgendamento($s, 'Rua X, 1'));
        $this->assertSame('Preço fixo', $s->atendimento['tipo_preco_rotulo']);
    }
}
