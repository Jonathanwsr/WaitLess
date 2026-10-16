<?php

namespace Tests\Feature;

use App\Models\Agendamento;
use App\Models\Aluguel;
use App\Models\Estabelecimento;
use App\Models\ItemAluguel;
use App\Models\Roteiro;
use App\Models\RoteiroPedido;
use App\Models\Servico;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\Support\FalsaWikimedia;
use Tests\TestCase;

class RoteiroViagemTest extends TestCase
{
    use DatabaseTransactions;
    use FalsaWikimedia;

    private function usuario(string $papel = 'user'): User
    {
        return User::create([
            'name' => 'U' . uniqid(), 'email' => uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'),
            'papel' => $papel, 'plano_assinatura' => 'gratuito',
        ]);
    }

    /** Restaurante e pousada do Lokyva no centro do Recife (onde ficam os pontos falsos). */
    private function locacoesNoRecife(): array
    {
        $socio = $this->usuario('socio');
        $local = Estabelecimento::create(['nome' => 'RESTAURANTE DO CAIS', 'ativo' => true, 'ramo_atuacao' => 'Restaurante', 'cidade' => 'Recife', 'latitude' => -8.0636, 'longitude' => -34.8718]);
        $local->proprietarios()->attach($socio->id, ['tipo' => 'socio']);
        $restaurante = Servico::create(['estabelecimento_id' => $local->id, 'nome' => 'ALMOÇO REGIONAL', 'tipo_servico' => 'Gastronomia', 'valor' => 60,
            'duracao_minutos' => 60, 'ativo' => true, 'horarios_disponiveis' => ['12:30', '19:30'], 'vagas_por_horario' => 5]);
        $local2 = Estabelecimento::create(['nome' => 'BISTRÔ DA JAQUEIRA', 'ativo' => true, 'ramo_atuacao' => 'Restaurante', 'cidade' => 'Recife', 'latitude' => -8.0372, 'longitude' => -34.9305]);
        $local2->proprietarios()->attach($socio->id, ['tipo' => 'socio']);
        $restaurante2 = Servico::create(['estabelecimento_id' => $local2->id, 'nome' => 'JANTAR DO BISTRÔ', 'tipo_servico' => 'Gastronomia', 'valor' => 80,
            'duracao_minutos' => 60, 'ativo' => true, 'horarios_disponiveis' => ['12:30', '19:30'], 'vagas_por_horario' => 5]);
        $pousada = ItemAluguel::create(['estabelecimento_id' => $socio->id, 'nome' => 'POUSADA RECIFE ANTIGO', 'categoria' => 'flat', 'valor_diaria' => 250,
            'ativo' => true, 'disponivel' => true, 'sempre_disponivel' => true, 'quantidade' => 1, 'capacidade_pessoas' => 4,
            'latitude' => -8.0628, 'longitude' => -34.8713, 'cidade' => 'Recife']);

        return compact('socio', 'restaurante', 'restaurante2', 'pousada');
    }

    private function pedidoDeGeracao(array $extra = []): array
    {
        return array_merge([
            'destino' => 'Recife', 'data_inicio' => now()->addDays(10)->toDateString(), 'data_fim' => now()->addDays(11)->toDateString(),
            'pessoas' => 2, 'interesses' => ['cultura'],
        ], $extra);
    }

    public function test_gera_roteiro_agrupando_pontos_proximos_no_mesmo_dia_com_periodos_refeicoes_e_hospedagem(): void
    {
        $this->fingirWikimedia($this->pontosRecife());
        ['restaurante' => $restaurante, 'pousada' => $pousada] = $this->locacoesNoRecife();
        Sanctum::actingAs($this->usuario());

        $r = $this->postJson('/api/mobile/roteiros/gerar', $this->pedidoDeGeracao(['orcamento' => 100]))->assertOk();

        $dias = collect($r->json('dias'));
        $this->assertCount(2, $dias);
        $titulosDoDia = fn (array $dia) => collect($dia['periodos'])->flatten(1)->where('tipo', 'ponto_turistico')->pluck('titulo')->all();
        $centro = ['Marco Zero', 'Paço do Frevo', 'Museu Cais do Sertão'];
        $longe = ['Instituto Ricardo Brennand', 'Oficina Brennand', 'Parque da Jaqueira'];
        // Os pontos vizinhos ficam juntos: o dia 1 é todo no centro, o dia 2 todo na zona oeste.
        $this->assertEqualsCanonicalizing($centro, $titulosDoDia($dias[0]));
        $this->assertEqualsCanonicalizing($longe, $titulosDoDia($dias[1]));
        $this->assertNotContains('Recife', collect($dias)->map($titulosDoDia)->flatten()->all());

        $dia1 = $dias[0]['periodos'];
        $this->assertCount(2, $dia1['manha']);
        $this->assertSame('Confira o horário de funcionamento', $dia1['manha'][0]['aviso_horario']);
        $this->assertSame(1, $dia1['manha'][0]['numero']);
        $this->assertNotNull($dia1['manha'][1]['distancia_km']);
        $this->assertSame('a_pe', $dia1['manha'][1]['modo']);

        $almoco = collect($dia1['tarde'])->firstWhere('servico_id', $restaurante->id);
        $this->assertNotNull($almoco, 'O almoço do dia 1 deveria ser no restaurante perto dos pontos do centro.');
        $this->assertStringStartsWith('Almoço', $almoco['titulo']);
        $this->assertEquals(120, $almoco['custo_estimado']); // R$ 60 × 2 pessoas
        $this->assertNotNull(collect($dia1['noite'])->firstWhere('item_aluguel_id', $pousada->id));

        $this->assertTrue($r->json('resumo.passou_orcamento'));
        $this->assertStringContainsString('passou do orçamento', implode(' ', $r->json('avisos')));
        $this->assertEqualsWithDelta($r->json('resumo.total'), $dias->sum('custo'), 0.02);
        $this->assertNull(Roteiro::first(), 'Gerar não salva nada.');
    }

    public function test_salvar_editar_reordenar_duplicar_e_excluir(): void
    {
        $this->fingirWikimedia($this->pontosRecife());
        ['restaurante' => $restaurante] = $this->locacoesNoRecife();
        $dono = $this->usuario();
        Sanctum::actingAs($dono);

        $gerado = $this->postJson('/api/mobile/roteiros/gerar', $this->pedidoDeGeracao(['partida' => 'localizacao', 'partida_latitude' => -8.1, 'partida_longitude' => -34.9]))->json();
        $corpo = $this->corpoParaSalvar($gerado);
        // Valor enviado pela tela é ignorado: o servidor recalcula o custo das locações.
        $corpo['dias'][0]['itens'] = collect($corpo['dias'][0]['itens'])->map(fn ($i) => $i['servico_id'] ? array_merge($i, ['custo_estimado' => 1]) : $i)->all();

        $salvo = $this->postJson('/api/mobile/roteiros', $corpo)->assertCreated();
        $roteiro = Roteiro::findOrFail($salvo->json('id'));
        $this->assertNull($roteiro->partida_latitude, 'A localização do usuário não pode ser gravada.');
        $this->assertEquals(120, $roteiro->itens()->where('servico_id', $restaurante->id)->value('custo_estimado'));

        // Move o primeiro ponto do dia 1 para o fim da noite do dia 2 e acrescenta uma anotação.
        $editado = $this->corpoParaSalvar($this->getJson("/api/mobile/roteiros/{$roteiro->id}")->assertOk()->json());
        $movido = array_shift($editado['dias'][0]['itens']);
        $editado['dias'][1]['itens'][] = array_merge($movido, ['periodo' => 'noite']);
        $editado['dias'][1]['itens'][] = ['tipo' => 'anotacao', 'periodo' => 'noite', 'titulo' => 'Comprar lembrancinhas', 'anotacao' => 'Mercado de São José', 'hora' => '21:00'];
        $editado['titulo'] = 'Férias no Recife';
        $this->putJson("/api/mobile/roteiros/{$roteiro->id}", $editado)->assertOk()->assertJsonPath('roteiro.titulo', 'Férias no Recife');

        $dia2 = $roteiro->fresh()->dias()->where('numero', 2)->first();
        $this->assertSame($movido['titulo'], $dia2->itens()->where('tipo', 'ponto_turistico')->where('periodo', 'noite')->value('titulo'));
        $this->assertSame('Mercado de São José', $dia2->itens()->where('tipo', 'anotacao')->value('anotacao'));

        $copia = $this->postJson("/api/mobile/roteiros/{$roteiro->id}/duplicar")->assertCreated()->json('id');
        $this->assertSame($roteiro->itens()->count(), Roteiro::find($copia)->itens()->count());
        $this->assertCount(2, $this->getJson('/api/mobile/roteiros')->json('roteiros'));

        $this->deleteJson("/api/mobile/roteiros/{$roteiro->id}")->assertOk();
        $this->assertNull(Roteiro::find($roteiro->id));
    }

    public function test_so_o_dono_ve_e_edita_e_o_link_compartilhado_e_somente_leitura(): void
    {
        $this->fingirWikimedia($this->pontosRecife());
        $this->locacoesNoRecife();
        $dono = $this->usuario();
        Sanctum::actingAs($dono);
        $corpo = $this->corpoParaSalvar($this->postJson('/api/mobile/roteiros/gerar', $this->pedidoDeGeracao())->json());
        $id = $this->postJson('/api/mobile/roteiros', $corpo)->json('id');

        $intruso = $this->usuario();
        Sanctum::actingAs($intruso);
        $this->getJson("/api/mobile/roteiros/{$id}")->assertForbidden();
        $this->putJson("/api/mobile/roteiros/{$id}", $corpo)->assertForbidden();
        $this->deleteJson("/api/mobile/roteiros/{$id}")->assertForbidden();
        $this->postJson("/api/mobile/roteiros/{$id}/reservar")->assertForbidden();
        $this->postJson("/api/mobile/roteiros/{$id}/compartilhar")->assertForbidden();
        $this->assertCount(0, $this->getJson('/api/mobile/roteiros')->json('roteiros'));

        Sanctum::actingAs($dono);
        $link = $this->postJson("/api/mobile/roteiros/{$id}/compartilhar")->assertOk()->json('link');
        $token = basename($link);
        $this->assertSame(40, strlen($token));

        // Sem login: lê, mas não recebe nada que permita editar nem a localização de partida.
        auth()->forgetGuards();
        $leitura = $this->getJson("/api/roteiros/compartilhado/{$token}")->assertOk();
        $this->assertSame($id, $leitura->json('roteiro.id'));
        $this->assertArrayNotHasKey('link_compartilhamento', $leitura->json('roteiro'));
        $this->assertArrayNotHasKey('pedidos', $leitura->json());
        $this->putJson("/api/mobile/roteiros/{$id}", $corpo)->assertUnauthorized();
        $this->get("/roteiro/{$token}/pdf")->assertOk()->assertHeader('content-type', 'application/pdf');

        Sanctum::actingAs($dono);
        $this->deleteJson("/api/mobile/roteiros/{$id}/compartilhar")->assertOk();
        auth()->forgetGuards();
        $this->getJson("/api/roteiros/compartilhado/{$token}")->assertNotFound();
    }

    public function test_reservar_tudo_cria_um_unico_pedido_com_as_reservas_ja_preenchidas(): void
    {
        $this->fingirWikimedia($this->pontosRecife());
        ['restaurante' => $restaurante, 'pousada' => $pousada, 'socio' => $socio] = $this->locacoesNoRecife();
        $cliente = $this->usuario();
        Sanctum::actingAs($cliente);
        $corpo = $this->corpoParaSalvar($this->postJson('/api/mobile/roteiros/gerar', $this->pedidoDeGeracao())->json());
        $id = $this->postJson('/api/mobile/roteiros', $corpo)->json('id');
        $roteiro = Roteiro::findOrFail($id);
        $locacoes = $roteiro->itens()->where('tipo', 'locacao')->count();

        $r = $this->postJson("/api/mobile/roteiros/{$id}/reservar")->assertCreated();

        $this->assertSame(1, RoteiroPedido::where('roteiro_id', $id)->count());
        $pedido = RoteiroPedido::where('roteiro_id', $id)->first();
        $this->assertCount($locacoes, $pedido->reservas);
        $this->assertEmpty($pedido->nao_reservados);

        $agendamento = Agendamento::where('usuario_id', $cliente->id)->where('servico_id', $restaurante->id)->firstOrFail();
        $this->assertSame(2, (int) $agendamento->quantidade_pessoas);
        $this->assertEquals(120, $agendamento->valor_final);
        $this->assertSame('presencial', $agendamento->status_pagamento);
        $this->assertSame($roteiro->data_inicio->toDateString(), \Carbon\Carbon::parse($agendamento->data_agendamento)->toDateString());

        $hospedagem = Aluguel::where('locatario_id', $cliente->id)->where('item_aluguel_id', $pousada->id)->firstOrFail();
        $this->assertSame($roteiro->data_inicio->toDateString(), \Carbon\Carbon::parse($hospedagem->data_inicio)->toDateString());
        $this->assertSame($roteiro->data_fim->toDateString(), \Carbon\Carbon::parse($hospedagem->data_fim)->toDateString());
        $this->assertSame((int) $socio->id, (int) $hospedagem->proprietario_id);
        $this->assertEquals(250, $hospedagem->valor_total); // 1 noite

        // Segunda vez: a pousada já está ocupada nessas datas → entra em "não reservados", sem quebrar o pedido.
        $segundo = $this->postJson("/api/mobile/roteiros/{$id}/reservar")->assertCreated()->json('pedido');
        $this->assertTrue(collect($segundo['nao_reservados'])->contains(fn ($n) => str_contains($n['titulo'], 'POUSADA RECIFE ANTIGO')), 'A pousada ocupada deveria aparecer em não reservados.');
        $this->assertNotEmpty($r->json('mensagem'));
    }

    public function test_pdf_e_tela_hoje_do_roteiro(): void
    {
        $this->fingirWikimedia($this->pontosRecife());
        $this->locacoesNoRecife();
        Sanctum::actingAs($this->usuario());
        $corpo = $this->corpoParaSalvar($this->postJson('/api/mobile/roteiros/gerar', $this->pedidoDeGeracao())->json());
        $corpo['data_inicio'] = now()->toDateString();
        $corpo['data_fim'] = now()->addDay()->toDateString();
        $corpo['dias'][0]['itens'][] = ['tipo' => 'anotacao', 'periodo' => 'noite', 'titulo' => 'Última parada', 'hora' => '23:59'];
        $id = $this->postJson('/api/mobile/roteiros', $corpo)->assertCreated()->json('id');

        $this->get("/api/mobile/roteiros/{$id}/pdf")->assertOk()->assertHeader('content-type', 'application/pdf');

        $hoje = $this->getJson('/api/mobile/roteiros/hoje')->assertOk()->json('hoje');
        $this->assertSame($id, $hoje['roteiro']['id']);
        $this->assertSame(now()->toDateString(), $hoje['dia']['data']);
        $this->assertNotNull($hoje['proximo']);
    }

    public function test_destino_desconhecido_e_datas_invalidas_dao_mensagens_claras(): void
    {
        $this->fingirWikimedia([], 'vazio');
        Sanctum::actingAs($this->usuario());

        $this->postJson('/api/mobile/roteiros/gerar', $this->pedidoDeGeracao(['destino' => 'Lugar Que Não Existe']))
            ->assertStatus(422)->assertJsonValidationErrors('destino');
        $this->postJson('/api/mobile/roteiros/gerar', $this->pedidoDeGeracao(['data_inicio' => now()->subDay()->toDateString()]))
            ->assertStatus(422)->assertJsonValidationErrors('data_inicio');
        $this->postJson('/api/mobile/roteiros/gerar', $this->pedidoDeGeracao(['data_fim' => now()->addDays(60)->toDateString()]))
            ->assertStatus(422)->assertJsonValidationErrors('data_fim');
    }

    public function test_paginas_do_site_lista_editor_e_link_publico(): void
    {
        $this->fingirWikimedia($this->pontosRecife());
        $this->locacoesNoRecife();
        $dono = $this->usuario();
        $this->actingAs($dono);
        $gerado = $this->postJson('/viagens/api/roteiros/gerar', $this->pedidoDeGeracao())->assertOk()->json();
        $id = $this->postJson('/viagens/api/roteiros', $this->corpoParaSalvar($gerado))->assertCreated()->json('id');

        $this->get('/viagens/roteiros')->assertOk()->assertInertia(fn ($p) => $p->component('Cliente/Viagens/Roteiros')->where('roteiros.0.id', $id));
        $this->get('/viagens/roteiros/novo?destino=Recife')->assertOk()->assertInertia(fn ($p) => $p->component('Cliente/Viagens/RoteiroEditor')->where('destinoInicial', 'Recife'));
        $this->get("/viagens/roteiros/{$id}/editar")->assertOk()->assertInertia(fn ($p) => $p->where('inicial.roteiro.id', $id));
        $this->get('/viagens')->assertOk(); // a área de viagens em grupo continua funcionando

        $this->actingAs($this->usuario())->get("/viagens/roteiros/{$id}/editar")->assertForbidden();

        $this->actingAs($dono);
        $token = basename($this->postJson("/viagens/api/roteiros/{$id}/compartilhar")->json('link'));
        auth()->forgetGuards();
        $this->get("/roteiro/{$token}")->assertOk()->assertInertia(fn ($p) => $p->component('Cliente/Viagens/RoteiroCompartilhado')->where('dados.roteiro.id', $id));
        $this->get('/roteiro/' . str_repeat('a', 40))->assertNotFound();
    }

    /** Converte a estrutura de tela (períodos) no corpo de salvar (itens por dia). */
    private function corpoParaSalvar(array $tela): array
    {
        $campos = ['tipo', 'periodo', 'hora', 'titulo', 'descricao', 'latitude', 'longitude', 'link', 'imagem', 'servico_id', 'item_aluguel_id', 'custo_estimado', 'anotacao'];

        return array_merge(collect($tela['roteiro'])->only(['titulo', 'destino', 'estado', 'latitude', 'longitude', 'data_inicio', 'data_fim', 'pessoas', 'orcamento', 'interesses', 'partida'])->all(), [
            'dias' => collect($tela['dias'])->map(fn ($d) => [
                'itens' => collect($d['periodos'])->flatten(1)->map(fn ($i) => collect($i)->only($campos)->all())->values()->all(),
            ])->all(),
        ]);
    }
}
