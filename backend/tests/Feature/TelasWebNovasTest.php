<?php

namespace Tests\Feature;

use App\Models\Agendamento;
use App\Models\Estabelecimento;
use App\Models\Pagamento;
use App\Models\Servico;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class TelasWebNovasTest extends TestCase
{
    use DatabaseTransactions;

    private function usuario(string $papel = 'user'): User
    {
        return User::create([
            'name' => 'U' . uniqid(), 'email' => uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'),
            'papel' => $papel, 'plano_assinatura' => 'gratuito',
        ]);
    }

    public function test_detalhe_do_servico_mostra_dados_e_horarios_lotados(): void
    {
        $local = Estabelecimento::create(['nome' => 'Clínica Teste', 'ativo' => true]);
        $servico = Servico::create([
            'estabelecimento_id' => $local->id, 'nome' => 'Consulta', 'tipo_servico' => 'Saúde', 'valor' => 300,
            'duracao_minutos' => 60, 'ativo' => true, 'tem_promocao' => true, 'tipo_desconto' => 'percentual', 'valor_desconto' => 10,
            'horarios_disponiveis' => ['09:00', '10:00'], 'vagas_por_horario' => 1,
        ]);
        $amanha = now()->addDay()->toDateString();
        Agendamento::create([
            'usuario_id' => $this->usuario()->id, 'estabelecimento_id' => $local->id, 'servico_id' => $servico->id,
            'data_agendamento' => $amanha, 'hora_agendamento' => '09:00', 'status' => 'confirmado', 'valor_final' => 270,
        ]);

        $this->actingAs($this->usuario())->get(route('cliente.servicos.show', $servico->id))
            ->assertOk()
            ->assertInertia(fn ($p) => $p->component('Cliente/ServicoDetalhe')
                ->where('servico.valor_com_promocao', 270)
                ->where('servico.tem_promocao', true)
                ->where("ocupados.{$amanha}.0", '09:00'));

        $servico->update(['ativo' => false]);
        $this->actingAs($this->usuario())->get(route('cliente.servicos.show', $servico->id))->assertNotFound();
    }

    public function test_meus_estabelecimentos_calcula_faturamento_de_hoje_e_fila(): void
    {
        $socio = $this->usuario('socio');
        $local = Estabelecimento::create(['nome' => 'Barbearia', 'ativo' => true]);
        $local->proprietarios()->attach($socio->id, ['tipo' => 'socio']);
        $servico = Servico::create(['estabelecimento_id' => $local->id, 'nome' => 'Corte', 'tipo_servico' => 'Outro', 'valor' => 50, 'duracao_minutos' => 30, 'ativo' => true]);
        $cliente = $this->usuario();
        $ag = Agendamento::create([
            'usuario_id' => $cliente->id, 'estabelecimento_id' => $local->id, 'servico_id' => $servico->id,
            'data_agendamento' => now('America/Sao_Paulo')->toDateString(), 'hora_agendamento' => '23:00', 'status' => 'pendente', 'valor_final' => 50,
        ]);
        Pagamento::create([
            'usuario_id' => $cliente->id, 'estabelecimento_id' => $local->id, 'agendamento_id' => $ag->id, 'gateway_pagamento' => 'Asaas',
            'id_transacao_gateway' => 'pay_' . uniqid(), 'valor' => 120, 'taxa' => 0.6, 'valor_liquido' => 119.4, 'status' => 'pago',
            'metodo_pagamento' => 'pix', 'data_pagamento' => now(),
        ]);

        $this->actingAs($socio)->get(route('estabelecimentos.index'))
            ->assertOk()
            ->assertInertia(fn ($p) => $p->component('Estabelecimentos/MeusEstabelecimentos')
                ->where('metricas.faturamento', 'R$ 120,00')
                ->where('metricas.aguardando', 1)
                ->where('estabelecimentos.data.0.faturamento_hoje', 'R$ 120,00')
                ->where('estabelecimentos.data.0.aguardando', 1));
    }

    public function test_locais_proximos_buscam_pela_cidade_quando_nao_ha_gps(): void
    {
        $cidade = 'Cidade' . uniqid();
        $local = Estabelecimento::create(['nome' => 'Barbearia da Cidade', 'cidade' => $cidade, 'estado' => 'PE', 'ativo' => true]);
        $servico = Servico::create(['estabelecimento_id' => $local->id, 'nome' => 'Corte', 'tipo_servico' => 'Outro', 'valor' => 35, 'duracao_minutos' => 30, 'ativo' => true]);
        Agendamento::create([
            'usuario_id' => $this->usuario()->id, 'estabelecimento_id' => $local->id, 'servico_id' => $servico->id,
            'data_agendamento' => now('America/Sao_Paulo')->toDateString(), 'hora_agendamento' => '23:30', 'status' => 'pendente', 'valor_final' => 35,
        ]);

        $lista = $this->actingAs($this->usuario())->getJson('/api/nearby?cidadeUf=' . urlencode($cidade . '/PE'))->assertOk()->json();

        $achado = collect($lista)->firstWhere('id', $local->id);
        $this->assertNotNull($achado);
        $this->assertSame(1, $achado['fila']);
        $this->assertEquals(35, $achado['a_partir_de']);
        $this->actingAs($this->usuario())->getJson('/api/nearby')->assertOk()->assertExactJson([]);
    }

    public function test_socio_ve_o_extrato_e_os_estornos_entram_no_indicador(): void
    {
        $socio = $this->usuario('socio');
        $local = Estabelecimento::create(['nome' => 'Studio', 'ativo' => true]);
        $local->proprietarios()->attach($socio->id, ['tipo' => 'socio']);
        $providerId = \Illuminate\Support\Facades\DB::table('providers')->insertGetId([
            'user_id' => $socio->id, 'name' => 'Studio', 'email' => uniqid() . '@p.com', 'birth_date' => '1990-01-01',
            'document' => '11222333000181', 'pix_key_type' => 'CNPJ', 'pix_key' => '11222333000181', 'person_type' => 'JURIDICA',
            'mobile_phone' => '11999998888', 'postal_code' => '01000000', 'address' => 'Rua', 'address_number' => '1', 'province' => 'Centro',
            'asaas_wallet_id' => 'wal_' . uniqid(), 'created_at' => now(), 'updated_at' => now(),
        ]);
        foreach ([['credito', 100, 1, 99], ['estorno', 0, 0, -40]] as [$tipo, $bruto, $taxa, $liquido]) {
            \Illuminate\Support\Facades\DB::table('extrato_providers')->insert([
                'provider_id' => $providerId, 'usuario_id' => $socio->id, 'origem_type' => 'App\Models\Agendamento', 'origem_id' => 1,
                'tipo' => $tipo, 'valor_bruto' => $bruto, 'taxa_plataforma' => $taxa, 'valor_liquido' => $liquido,
                'descricao' => 'Teste', 'status' => 'liberado', 'metodo_pagamento' => 'pix', 'created_at' => now(),
            ]);
        }

        $this->actingAs($socio)->get(route('provider.financeiro'))
            ->assertOk()
            ->assertInertia(fn ($p) => $p->component('Estabelecimentos/DashboardFinanceiro')
                ->where('resumoCards.receita_total', '100,00')
                ->where('resumoCards.estornos', '40,00')
                ->where('resumoCards.lucro_liquido', '59,00'));

        $this->actingAs($this->usuario())->get(route('provider.financeiro'))->assertForbidden();
    }

    public function test_editar_funcionario_salva_a_data_de_nascimento(): void
    {
        $socio = $this->usuario('socio');
        $local = Estabelecimento::create(['nome' => 'Clínica', 'ativo' => true]);
        $local->proprietarios()->attach($socio->id, ['tipo' => 'socio']);
        $userFunc = $this->usuario('atendente');
        $func = \App\Models\Funcionario::create(['estabelecimento_id' => $local->id, 'usuario_id' => $userFunc->id, 'nome' => 'Lucas', 'cargo' => 'Atendente', 'ativo' => true]);

        $this->actingAs($socio)->get(route('funcionarios.edit', $func->id))->assertOk()
            ->assertInertia(fn ($p) => $p->component('Estabelecimentos/EditarFuncionario')->has('resumo'));

        $this->actingAs($socio)->put(route('funcionarios.update', $func->id), [
            'nome' => 'Lucas Ferreira', 'cargo' => 'Atendente', 'estabelecimento_id' => $local->id, 'birth_date' => '1996-07-15',
        ])->assertRedirect();

        $this->assertSame('1996-07-15', substr((string) $userFunc->fresh()->birth_date, 0, 10));
    }

    public function test_assistente_de_viagens_responde_json_com_lugares_do_destino(): void
    {
        \Illuminate\Support\Facades\Http::fake();
        $cidade = 'Gravatá' . uniqid();
        $local = Estabelecimento::create(['nome' => 'Pousada da Serra', 'cidade' => $cidade, 'ativo' => true]);

        $this->actingAs($this->usuario())->get(route('travel-assistant.index'))->assertOk()
            ->assertInertia(fn ($p) => $p->component('Cliente/TravelAssistant'));

        $dados = $this->actingAs($this->usuario())
            ->getJson('/api/travel-assistant/search?busca=' . urlencode(mb_strtolower($cidade)) . '&dias=3&pessoas=2')
            ->assertOk()->json();

        $this->assertSame(mb_strtolower($cidade), $dados['destino_detectado']);
        $this->assertSame($local->id, $dados['estabelecimentos_locais'][0]['id']);
        $this->assertSame(3, $dados['orcamento_estimado']['dias']);
    }

    public function test_mala_de_viagem_lista_o_destino_e_cria_a_viagem_sem_premium(): void
    {
        $cidade = 'Porto' . uniqid();
        $dono = $this->usuario('socio');
        $base = ['estabelecimento_id' => $dono->id, 'periodo_faturamento_padrao' => 'diaria', 'quantidade' => 1, 'ativo' => true,
            'disponivel' => true, 'sempre_disponivel' => true, 'cidade' => $cidade, 'estado' => 'PE'];
        $pousada = \App\Models\ItemAluguel::create($base + ['nome' => 'Pousada Mar', 'categoria' => 'pousada', 'valor_diaria' => 300]);
        $carro = \App\Models\ItemAluguel::create($base + ['nome' => 'Carro compacto', 'categoria' => 'carro', 'valor_diaria' => 120]);
        $cliente = $this->usuario();

        $hospedagem = $this->actingAs($cliente)->getJson(route('viagens.mala.catalogo', ['categoria' => 'hospedagem', 'cidade' => mb_strtolower($cidade)]))->assertOk()->json('itens');
        $this->assertSame([$pousada->id], array_column($hospedagem, 'item_aluguel_id'));
        $transporte = $this->actingAs($cliente)->getJson(route('viagens.mala.catalogo', ['categoria' => 'transporte', 'cidade' => $cidade]))->assertOk()->json('itens');
        $this->assertSame([$carro->id], array_column($transporte, 'item_aluguel_id'));

        $ida = now()->addDays(10)->toDateString();
        $volta = now()->addDays(13)->toDateString();
        $resposta = $this->actingAs($cliente)->postJson(route('viagens.store'), [
            'cidade' => $cidade, 'data_inicio' => $ida, 'data_fim' => $volta, 'pessoas' => 2, 'titulo' => 'Férias',
            'itens' => [
                ['tipo' => 'hospedagem', 'titulo' => 'Pousada Mar', 'dia' => $ida, 'data_fim' => $volta, 'custo_estimado' => 900, 'item_aluguel_id' => $pousada->id, 'origem' => 'manual'],
                ['tipo' => 'produto', 'titulo' => 'Protetor solar', 'dia' => $ida, 'custo_estimado' => 45, 'origem' => 'manual'],
            ],
        ])->assertCreated();

        $viagem = \App\Models\Viagem::findOrFail($resposta->json('viagem_id'));
        $this->assertSame(['hospedagem', 'produto'], $viagem->itens()->orderBy('ordem')->pluck('tipo')->all());

        // O roteiro automático (sem itens escolhidos) continua sendo Premium.
        $this->actingAs($cliente)->postJson(route('viagens.store'), ['cidade' => $cidade, 'data_inicio' => $ida, 'data_fim' => $volta, 'pessoas' => 2])->assertForbidden();
    }

    public function test_busca_da_mala_acha_tudo_e_filtra_por_promocao_cupom_e_relampago(): void
    {
        $cidade = 'Praia' . uniqid();
        $dono = $this->usuario('socio');
        $local = Estabelecimento::create(['nome' => 'Barco Azul', 'ativo' => true, 'cidade' => $cidade]);
        $passeio = Servico::create(['estabelecimento_id' => $local->id, 'nome' => 'Passeio de barco', 'tipo_servico' => 'Turismo', 'valor' => 200, 'duracao_minutos' => 120, 'ativo' => true]);
        $jantar = Servico::create(['estabelecimento_id' => $local->id, 'nome' => 'Jantar no barco', 'tipo_servico' => 'Restaurante', 'valor' => 150, 'duracao_minutos' => 90, 'ativo' => true]);
        $pousada = \App\Models\ItemAluguel::create(['estabelecimento_id' => $dono->id, 'periodo_faturamento_padrao' => 'diaria', 'quantidade' => 1, 'ativo' => true,
            'disponivel' => true, 'sempre_disponivel' => true, 'cidade' => $cidade, 'estado' => 'PE', 'nome' => 'Pousada do Barco', 'categoria' => 'pousada',
            'valor_diaria' => 400, 'tem_promocao' => true, 'tipo_desconto' => 'percentual', 'valor_desconto' => 25]);
        \App\Models\Cupom::create(['estabelecimento_id' => $local->id, 'servico_id' => $passeio->id, 'codigo' => 'BARCO10', 'titulo' => '10% no passeio',
            'tipo_desconto' => 'percentual', 'valor_desconto' => 10, 'ativo' => true]);
        \App\Models\FlashDeal::create(['criado_por' => $dono->id, 'alvo_tipo' => 'servico', 'alvo_id' => $jantar->id, 'alvo_nome' => 'Jantar no barco',
            'estabelecimento_id' => $local->id, 'percentual' => 40, 'quantidade' => 5, 'cidade' => $cidade, 'inicia_em' => now(), 'expira_em' => now()->addHours(2), 'status' => 'ativo']);
        $cliente = $this->usuario();
        $url = fn (array $p) => route('viagens.mala.catalogo', ['categoria' => 'tudo', 'cidade' => $cidade] + $p);

        $tudo = $this->actingAs($cliente)->getJson($url(['busca' => 'barco']))->assertOk();
        $this->assertEqualsCanonicalizing(["aluguel-{$pousada->id}", "servico-{$passeio->id}", "servico-{$jantar->id}"], array_column($tudo->json('itens'), 'chave'));
        $tudo->assertJsonPath('contagem.promocao', 1)->assertJsonPath('contagem.cupom', 1)->assertJsonPath('contagem.relampago', 1);

        $promo = $this->actingAs($cliente)->getJson($url(['filtros' => ['promocao']]))->assertOk()->json('itens');
        $this->assertSame(["aluguel-{$pousada->id}"], array_column($promo, 'chave'));
        $this->assertEquals(300, $promo[0]['preco']);
        $this->assertSame(['de' => 400, 'percentual' => 25], $promo[0]['promocao']);

        $cupom = $this->actingAs($cliente)->getJson($url(['filtros' => ['cupom']]))->assertOk()->json('itens');
        $this->assertSame('BARCO10', $cupom[0]['cupom']['codigo']);
        $this->assertSame('10% OFF', $cupom[0]['cupom']['rotulo']);

        $relampago = $this->actingAs($cliente)->getJson($url(['filtros' => ['relampago']]))->assertOk()->json('itens');
        $this->assertSame(["servico-{$jantar->id}"], array_column($relampago, 'chave'));
        $this->assertSame(40, $relampago[0]['relampago']['percentual']);

        $baratos = $this->actingAs($cliente)->getJson($url(['ordem' => 'menor_preco', 'preco_max' => 250]))->assertOk()->json('itens');
        $this->assertSame([150.0, 200.0], array_map('floatval', array_column($baratos, 'preco')));
    }

    public function test_detalhe_do_servico_traz_avaliacoes_favorito_carrinho_e_outros_com_foto_e_horarios(): void
    {
        $local = Estabelecimento::create(['nome' => 'Salão Exemplo', 'ativo' => true]);
        $servico = Servico::create(['estabelecimento_id' => $local->id, 'nome' => 'Corte', 'tipo_servico' => 'Beleza', 'valor' => 80,
            'duracao_minutos' => 40, 'ativo' => true, 'horarios_disponiveis' => ['10:00', '09:00']]);
        $outro = Servico::create(['estabelecimento_id' => $local->id, 'nome' => 'Escova', 'tipo_servico' => 'Beleza', 'valor' => 60,
            'duracao_minutos' => 30, 'ativo' => true, 'fotos' => json_encode(['servicos/escova.jpg']), 'horarios_disponiveis' => ['14:00', '15:00']]);
        $cliente = $this->usuario();
        $ag = Agendamento::create(['usuario_id' => $cliente->id, 'estabelecimento_id' => $local->id, 'servico_id' => $servico->id,
            'data_agendamento' => now()->subDays(3)->toDateString(), 'hora_agendamento' => '09:00', 'status' => 'finalizado', 'valor_final' => 80]);
        \App\Models\Avaliacao::create(['usuario_id' => $cliente->id, 'estabelecimento_id' => $local->id, 'agendamento_id' => $ag->id,
            'nota' => 5, 'comentario' => 'Atendimento excelente', 'publica' => true]);
        \App\Models\Favorito::create(['usuario_id' => $cliente->id, 'servico_id' => $servico->id]);

        $this->actingAs($cliente)->get(route('cliente.servicos.show', $servico->id))
            ->assertOk()
            ->assertInertia(fn ($p) => $p->component('Cliente/ServicoDetalhe')
                ->where('servico.horarios', ['09:00', '10:00'])
                ->where('avaliacoes.escopo', 'servico')
                ->where('avaliacoes.total', 1)
                ->where('avaliacoes.lista.0.comentario', 'Atendimento excelente')
                ->where('avaliacoes.distribuicao.5', 1)
                ->where('favorito', true)
                ->where('noCarrinho', false)
                ->where('outrosServicos.0.id', $outro->id)
                ->where('outrosServicos.0.foto', 'servicos/escova.jpg')
                ->where('outrosServicos.0.horarios', ['14:00', '15:00']));

        $this->actingAs($cliente)->post('/carrinho/adicionar', ['servico_id' => $servico->id, 'estabelecimento_id' => $local->id])->assertRedirect();
        $this->actingAs($cliente)->get(route('cliente.servicos.show', $servico->id))->assertInertia(fn ($p) => $p->where('noCarrinho', true));
    }

    public function test_horario_ocupado_avisa_e_sugere_outro(): void
    {
        $local = Estabelecimento::create(['nome' => 'Salão', 'ativo' => true]);
        $servico = Servico::create(['estabelecimento_id' => $local->id, 'nome' => 'Manicure', 'tipo_servico' => 'Beleza', 'valor' => 40,
            'duracao_minutos' => 30, 'ativo' => true, 'horarios_disponiveis' => ['09:00', '10:00', '11:00'], 'vagas_por_horario' => 1]);
        $amanha = now()->addDay()->toDateString();
        Agendamento::create(['usuario_id' => $this->usuario()->id, 'estabelecimento_id' => $local->id, 'servico_id' => $servico->id,
            'data_agendamento' => $amanha, 'hora_agendamento' => '09:00', 'status' => 'confirmado', 'valor_final' => 40]);
        $cliente = $this->usuario();
        $url = fn ($hora) => route('cliente.servicos.disponibilidade', ['servico' => $servico->id, 'data' => $amanha, 'hora' => $hora]);

        $this->actingAs($cliente)->getJson($url('09:00'))->assertOk()
            ->assertJsonPath('livre', false)
            ->assertJsonPath('sugestoes', ['10:00', '11:00']);
        $this->assertStringContainsString('Escolha outro', $this->actingAs($cliente)->getJson($url('09:00'))->json('motivo'));

        $this->actingAs($cliente)->getJson($url('10:00'))->assertOk()->assertJsonPath('livre', true);
    }

    public function test_cancelar_assinatura_em_teste_volta_para_o_gratis_na_hora(): void
    {
        $user = $this->usuario();
        $user->update(['plano_assinatura' => 'premium', 'plano_expira_em' => now()->addDays(7)]);
        \App\Models\Assinatura::create(['user_id' => $user->id, 'nome_plano' => 'premium', 'tipo_publico' => 'cliente', 'valor_mensal' => 8,
            'status' => 'pendente', 'data_inicio' => now(), 'data_vencimento' => now()->addDays(7)]);

        $this->actingAs($user)->postJson('/minha-assinatura/cancelar')->assertOk()->assertJsonPath('volta_gratuito_em', now()->format('d/m/Y'));

        $user->refresh();
        $this->assertSame('gratuito', $user->plano_assinatura);
        $this->assertFalse($user->isPremium());
    }

    public function test_assinatura_cancelada_com_ciclo_pago_volta_ao_gratis_quando_o_ciclo_acaba(): void
    {
        $user = $this->usuario();
        $user->update(['plano_assinatura' => 'premium', 'plano_expira_em' => now()->addDays(20)]);
        \App\Models\Assinatura::create(['user_id' => $user->id, 'nome_plano' => 'premium', 'tipo_publico' => 'cliente', 'valor_mensal' => 8,
            'status' => 'ativa', 'data_inicio' => now()->subDays(10), 'data_vencimento' => now()->addDays(20)]);

        $this->actingAs($user)->postJson('/minha-assinatura/cancelar')->assertOk();
        $this->assertTrue($user->fresh()->isPremium(), 'O ciclo já pago continua valendo até o vencimento.');

        $this->actingAs($user)->get(route('assinatura.status'))
            ->assertInertia(fn ($p) => $p->where('statusAssinatura.status_acesso', 'cancelada')
                ->where('statusAssinatura.volta_gratuito_em', $user->fresh()->plano_expira_em->format('d/m/Y')));

        $user->update(['plano_expira_em' => now()->subMinute()]);
        $this->artisan('assinaturas:voltar-gratuito')->assertSuccessful();
        $this->assertSame('gratuito', $user->fresh()->plano_assinatura);
    }

    public function test_cadastrar_reserva_do_estabelecimento_nao_quebra_na_chave_do_local(): void
    {
        $socio = $this->usuario('socio');
        // Id do local bem acima dos ids de usuários: antes isso batia na FK antiga para users.
        $local = Estabelecimento::create(['nome' => 'Pousada', 'ativo' => true]);
        \Illuminate\Support\Facades\DB::table('estabelecimentos')->where('id', $local->id)->update(['id' => 900000 + $local->id]);
        $local = Estabelecimento::findOrFail(900000 + $local->id);
        $local->proprietarios()->attach($socio->id, ['tipo' => 'socio']);
        \Illuminate\Support\Facades\Http::fake();

        $this->actingAs($socio)->post('/catalogo/itens', [
            'estabelecimento_id' => $local->id, 'nome' => 'Suíte vista mar', 'categoria' => 'pousada', 'quantidade' => 1,
            'tipo_disponibilidade' => 'todos', 'periodo_faturamento_padrao' => 'diaria', 'valor_diaria' => 300,
            'fotos' => [\Illuminate\Http\UploadedFile::fake()->image('suite.jpg')],
        ])->assertSessionHasNoErrors()->assertRedirect();

        $this->assertDatabaseHas('itens_aluguel', ['local_id' => $local->id, 'estabelecimento_id' => $socio->id, 'nome' => 'Suíte vista mar']);
        // Moderação de imagens desligada: nenhuma foto vai para análise.
        \Illuminate\Support\Facades\Http::assertNothingSent();
    }

    public function test_reserva_do_estabelecimento_aparece_para_o_cliente_com_as_fotos(): void
    {
        $socio = $this->usuario('socio');
        $local = Estabelecimento::create(['nome' => 'Pousada Sol', 'ativo' => true, 'cidade' => 'Recife', 'estado' => 'PE']);
        $local->proprietarios()->attach($socio->id, ['tipo' => 'socio']);

        $this->actingAs($socio)->post('/catalogo/itens', [
            'estabelecimento_id' => $local->id, 'nome' => 'Chalé Sol', 'categoria' => 'pousada', 'quantidade' => 1,
            'tipo_disponibilidade' => 'todos', 'periodo_faturamento_padrao' => 'diaria', 'valor_diaria' => 250,
            'fotos' => [\Illuminate\Http\UploadedFile::fake()->image('chale.jpg')],
        ])->assertSessionHasNoErrors();

        $item = \App\Models\ItemAluguel::where('nome', 'Chalé Sol')->firstOrFail();
        $this->assertSame($socio->id, (int) $item->estabelecimento_id, 'O item guarda o DONO em estabelecimento_id.');
        $this->assertSame($local->id, (int) $item->local_id, 'E o local em local_id.');

        // O dono continua vendo e editando pelo id do local.
        $this->actingAs($socio)->getJson('/api/catalogo/itens')->assertOk()
            ->assertJsonPath('0.id', $item->id)->assertJsonPath('0.estabelecimento_id', $local->id);

        // O cliente encontra a reserva no Explorar, com a foto.
        $cliente = $this->usuario();
        $this->actingAs($cliente)->get(route('cliente.explorar', ['tipo_busca' => 'reservas', 'busca' => 'Chalé Sol']))
            ->assertOk()
            ->assertInertia(fn ($p) => $p->where('itens_aluguel.data.0.id', $item->id)
                ->where('itens_aluguel.data.0.fotos.0', fn ($f) => str_starts_with($f, '/storage/itens_aluguel/')));
    }

    public function test_mapa_de_rastreamento_mostra_a_ultima_posicao_do_cliente(): void
    {
        $socio = $this->usuario('socio');
        $socio->update(['plano_assinatura' => 'premium-socio', 'plano_expira_em' => now()->addMonth()]);
        $gerente = $this->usuario('gerente');
        $local = Estabelecimento::create(['nome' => 'Barbearia', 'ativo' => true, 'latitude' => -8.05, 'longitude' => -34.9]);
        $local->proprietarios()->attach($socio->id, ['tipo' => 'socio']);
        $local->proprietarios()->attach($gerente->id, ['tipo' => 'gerente']);
        $servico = Servico::create(['estabelecimento_id' => $local->id, 'nome' => 'Corte', 'tipo_servico' => 'Beleza', 'valor' => 50, 'duracao_minutos' => 30, 'ativo' => true]);
        $cliente = $this->usuario();
        $ag = Agendamento::create(['usuario_id' => $cliente->id, 'estabelecimento_id' => $local->id, 'servico_id' => $servico->id,
            'data_agendamento' => now('America/Sao_Paulo')->toDateString(), 'hora_agendamento' => '23:30', 'status' => 'confirmado', 'valor_final' => 50]);

        // O cliente compartilha a localização pela rota do web (antes ia para /api/... e dava 404).
        $this->actingAs($cliente)->postJson('/rastreamento/update', ['agendamento_id' => $ag->id, 'lat' => -8.06, 'lng' => -34.91])->assertOk();

        // O gerente vê porque o dono do local é Premium; a lista vem com horário, serviço e a última posição.
        $this->actingAs($gerente)->getJson(route('proprietario.rastreamento'))->assertOk()
            ->assertJsonPath('agendamentos_ativos.0.id', $ag->id)
            ->assertJsonPath('agendamentos_ativos.0.horario', '23:30')
            ->assertJsonPath('agendamentos_ativos.0.titulo', 'Corte')
            ->assertJsonPath('agendamentos_ativos.0.ultima_localizacao.latitude', -8.06);
    }

    public function test_detalhe_da_reserva_mostra_tudo_que_o_socio_cadastrou(): void
    {
        $socio = $this->usuario('socio');
        $local = Estabelecimento::create(['nome' => 'Locadora Sol', 'ativo' => true, 'rua' => 'Av. Boa Viagem', 'numero' => '100',
            'bairro' => 'Boa Viagem', 'cidade' => 'Recife', 'estado' => 'PE', 'cep' => '51020-000', 'telefone' => '81999990000']);
        $local->proprietarios()->attach($socio->id, ['tipo' => 'socio']);
        $carro = \App\Models\ItemAluguel::create([
            'estabelecimento_id' => $socio->id, 'local_id' => $local->id, 'nome' => 'TOYOTA COROLLA', 'categoria' => 'carro',
            'periodo_faturamento_padrao' => 'diaria', 'quantidade' => 1, 'ativo' => true, 'disponivel' => true, 'sempre_disponivel' => true,
            'valor_diaria' => 200, 'valor_semanal' => 1200, 'valor_caucao' => 500, 'marca' => 'Toyota', 'modelo' => 'Corolla XEi',
            'ano' => 2023, 'combustivel' => 'flex', 'cambio' => 'automatico', 'quilometragem' => 15000, 'placa' => 'ABC1D23',
            'acessorios' => json_encode(['Cadeirinha infantil', 'Suporte de celular']), 'observacoes' => 'Devolver com o tanque cheio.',
            'horario_limite_devolucao' => '18:00', 'exige_contrato' => true,
        ]);

        $this->actingAs($this->usuario())->get(route('itens.detalhes', $carro->id))
            ->assertOk()
            ->assertInertia(fn ($p) => $p->component('Cliente/DetalhesItem')
                ->where('ficha.perfil', 'veiculo')
                ->where('ficha.textos.unidade', 'dia')
                ->where('ficha.textos.inicio', 'Retirada')
                ->where('ficha.local.nome', 'Locadora Sol')
                ->where('ficha.endereco.linha1', 'Av. Boa Viagem, 100')
                ->where('ficha.endereco.do_local', true)
                ->where('ficha.especificacoes', fn ($e) => collect($e)->pluck('valor', 'rotulo')->only(['Marca', 'Ano', 'Câmbio', 'Quilometragem', 'Placa'])->all()
                    === ['Marca' => 'Toyota', 'Ano' => '2023', 'Câmbio' => 'Automático', 'Quilometragem' => '15.000 km', 'Placa' => 'Final 3'])
                ->where('ficha.acessorios', ['Cadeirinha infantil', 'Suporte de celular'])
                ->where('ficha.observacoes', 'Devolver com o tanque cheio.')
                ->where('ficha.retirada.endereco', fn ($v) => str_contains($v, 'Locadora Sol'))
                ->where('ficha.precos', fn ($p) => collect($p)->pluck('rotulo')->all() === ['Diária', 'Semana', 'Caução (volta no fim)'])
                ->where('ficha.regras', fn ($r) => collect($r)->pluck('texto')->contains('Devolução até as 18:00')
                    && collect($r)->pluck('texto')->contains('É preciso assinar um contrato antes da retirada')));
    }

    public function test_assinar_ja_libera_o_premium_no_periodo_de_teste_web_e_app(): void
    {
        $falso = \Mockery::mock(\App\Services\AsaasAssinaturaService::class);
        $falso->shouldReceive('criarCobranca')->andReturn(['id' => 'sub_teste_' . uniqid()]);
        $this->app->instance(\App\Services\AsaasAssinaturaService::class, $falso);
        \Illuminate\Support\Facades\Mail::fake();

        $cliente = $this->usuario();
        $this->actingAs($cliente)->postJson('/minha-assinatura/assinar', ['plano' => 'premium', 'metodo' => 'pix'])->assertOk();

        $cliente->refresh();
        $this->assertTrue($cliente->isPremium(), 'Durante os 7 dias grátis o usuário já é Premium (nada de "Seja Premium").');
        $this->assertTrue($cliente->plano_expira_em->isFuture());

        // O app recebe o "premium" pronto no /me.
        \Laravel\Sanctum\Sanctum::actingAs($cliente);
        $this->getJson('/api/mobile/me')->assertOk()->assertJsonPath('user.premium', true);
    }

    public function test_reserva_criada_no_local_fica_no_local_e_nao_nas_avulsas(): void
    {
        $socio = $this->usuario('socio');
        $local = Estabelecimento::create(['nome' => 'Pousada do Local', 'ativo' => true]);
        $local->proprietarios()->attach($socio->id, ['tipo' => 'socio']);
        $doLocal = \App\Models\ItemAluguel::create(['estabelecimento_id' => $socio->id, 'local_id' => $local->id, 'nome' => 'Quarto do local',
            'categoria' => 'pousada', 'periodo_faturamento_padrao' => 'diaria', 'quantidade' => 1, 'ativo' => true, 'disponivel' => true]);
        $avulsa = \App\Models\ItemAluguel::create(['estabelecimento_id' => $socio->id, 'nome' => 'Bicicleta avulsa',
            'categoria' => 'bicicleta', 'periodo_faturamento_padrao' => 'diaria', 'quantidade' => 1, 'ativo' => true, 'disponivel' => true]);

        $this->actingAs($socio)->get(route('locacoes.avulsas.index'))->assertOk()
            ->assertInertia(fn ($p) => $p->where('itens', fn ($itens) => collect($itens)->pluck('id')->all() === [$avulsa->id]));

        $this->actingAs($socio)->getJson('/api/catalogo/itens?estabelecimento_id=' . $local->id)->assertOk()
            ->assertJsonCount(1)->assertJsonPath('0.id', $doLocal->id)->assertJsonPath('0.estabelecimento_id', $local->id);

        // A reserva do local não pode ser editada pela tela de avulsas.
        $this->actingAs($socio)->post(route('locacoes.avulsas.update', $doLocal->id), ['nome' => 'x'])->assertForbidden();
    }

    public function test_app_recebe_ficha_da_reserva_avaliacoes_do_servico_e_notas_fiscais(): void
    {
        $socio = $this->usuario('socio');
        $local = Estabelecimento::create(['nome' => 'Studio', 'ativo' => true, 'cidade' => 'Olinda', 'estado' => 'PE', 'rua' => 'Rua do Sol', 'numero' => '5']);
        $local->proprietarios()->attach($socio->id, ['tipo' => 'socio']);
        $item = \App\Models\ItemAluguel::create(['estabelecimento_id' => $socio->id, 'local_id' => $local->id, 'nome' => 'Câmera', 'categoria' => 'camera',
            'periodo_faturamento_padrao' => 'diaria', 'quantidade' => 1, 'ativo' => true, 'disponivel' => true, 'marca' => 'Sony', 'valor_diaria' => 90]);
        $servico = Servico::create(['estabelecimento_id' => $local->id, 'nome' => 'Ensaio', 'tipo_servico' => 'Foto', 'valor' => 200,
            'duracao_minutos' => 60, 'ativo' => true, 'horarios_disponiveis' => ['09:00', '10:00'], 'vagas_por_horario' => 1]);
        $amanha = now()->addDay()->toDateString();
        Agendamento::create(['usuario_id' => $this->usuario()->id, 'estabelecimento_id' => $local->id, 'servico_id' => $servico->id,
            'data_agendamento' => $amanha, 'hora_agendamento' => '09:00', 'status' => 'confirmado', 'valor_final' => 200]);

        \Laravel\Sanctum\Sanctum::actingAs($this->usuario());
        $this->getJson("/api/mobile/reservas/item/{$item->id}")->assertOk()
            ->assertJsonPath('estabelecimento.id', $local->id)
            ->assertJsonPath('ficha.perfil', 'equipamento')
            ->assertJsonPath('ficha.endereco.linha1', 'Rua do Sol, 5');

        $this->getJson("/api/mobile/servicos/{$servico->id}")->assertOk()
            ->assertJsonPath("ocupados.{$amanha}.0", '09:00')
            ->assertJsonPath('avaliacoes.total', 0);
        $this->getJson("/api/mobile/servicos/{$servico->id}/disponibilidade?data={$amanha}&hora=09:00")->assertOk()
            ->assertJsonPath('livre', false)->assertJsonPath('sugestoes', ['10:00']);

        \Laravel\Sanctum\Sanctum::actingAs($socio);
        $this->getJson('/api/mobile/proprietario/notas-fiscais')->assertOk()->assertJsonStructure(['notas', 'resumo', 'taxas']);
    }

    public function test_vitrines_da_loja_mostram_as_reservas_cadastradas_no_local(): void
    {
        $socio = $this->usuario('socio');
        $local = Estabelecimento::create(['nome' => 'Pousada Vitrine', 'ativo' => true]);
        $outroLocal = Estabelecimento::create(['nome' => 'Outro local', 'ativo' => true]);
        $local->proprietarios()->attach($socio->id, ['tipo' => 'socio']);
        $outroLocal->proprietarios()->attach($socio->id, ['tipo' => 'socio']);
        $base = ['estabelecimento_id' => $socio->id, 'periodo_faturamento_padrao' => 'diaria', 'quantidade' => 1, 'ativo' => true, 'disponivel' => true, 'valor_diaria' => 150];
        $doLocal = \App\Models\ItemAluguel::create($base + ['local_id' => $local->id, 'nome' => 'Suíte Mar', 'categoria' => 'pousada', 'fotos' => json_encode(['/storage/itens_aluguel/suite.jpg'])]);
        \App\Models\ItemAluguel::create($base + ['local_id' => $outroLocal->id, 'nome' => 'Quarto de outro local', 'categoria' => 'pousada']);
        \App\Models\ItemAluguel::create($base + ['nome' => 'Bike avulsa', 'categoria' => 'bicicleta']);

        // Loja do web (o que o cliente vê)
        $this->actingAs($this->usuario())->get(route('estabelecimentos.loja', $local->id))->assertOk()
            ->assertInertia(fn ($p) => $p->where('reservas', fn ($r) => collect($r)->pluck('id')->all() === [$doLocal->id])
                ->where('reservas.0.unidade', 'noite'));

        // Vitrine do dono
        $this->actingAs($socio)->get(route('vitrine.dono', ['estabelecimento_id' => $local->id]))->assertOk()
            ->assertInertia(fn ($p) => $p->where('vitrine.reservas', fn ($r) => collect($r)->pluck('id')->all() === [$doLocal->id]));

        // Loja no app
        \Laravel\Sanctum\Sanctum::actingAs($this->usuario());
        $locacoes = $this->getJson("/api/mobile/estabelecimentos/{$local->id}")->assertOk()->json('locacoes');
        $this->assertSame([$doLocal->id], array_column($locacoes, 'id'));
        $this->assertStringEndsWith('/storage/itens_aluguel/suite.jpg', $locacoes[0]['foto_principal']);
        $this->assertStringStartsWith('http', $locacoes[0]['foto_principal']);
    }

    public function test_site_e_descricao_do_local_aparecem_na_vitrine(): void
    {
        $socio = $this->usuario('socio');
        $local = Estabelecimento::create(['nome' => 'Café Central', 'ativo' => true]);
        $local->proprietarios()->attach($socio->id, ['tipo' => 'socio']);

        // Site digitado sem "https://" é aceito e vira link.
        $this->actingAs($socio)->put(route('estabelecimentos.update', $local->id), [
            'nome' => 'Café Central', 'site' => 'www.cafecentral.com.br', 'bio' => 'Café especial torrado na casa.',
        ])->assertSessionHasNoErrors();

        $local->refresh();
        $this->assertSame('https://www.cafecentral.com.br', $local->site);
        $this->assertSame('Café especial torrado na casa.', $local->bio);

        $this->actingAs($this->usuario())->get(route('estabelecimentos.loja', $local->id))->assertOk()
            ->assertInertia(fn ($p) => $p->where('estabelecimento.bio', 'Café especial torrado na casa.')
                ->where('estabelecimento.site', 'https://www.cafecentral.com.br'));

        $this->actingAs($socio)->get(route('vitrine.dono', ['estabelecimento_id' => $local->id]))->assertOk()
            ->assertInertia(fn ($p) => $p->where('vitrine.estabelecimento.bio', 'Café especial torrado na casa.'));

        \Laravel\Sanctum\Sanctum::actingAs($this->usuario());
        $this->getJson("/api/mobile/estabelecimentos/{$local->id}")->assertOk()
            ->assertJsonPath('estabelecimento.bio', 'Café especial torrado na casa.')
            ->assertJsonPath('estabelecimento.site', 'https://www.cafecentral.com.br');
    }

    public function test_servico_com_horario_a_combinar_mostra_contato_e_nao_aceita_agendamento_com_hora(): void
    {
        $socio = $this->usuario('socio');
        $local = Estabelecimento::create(['nome' => 'Fotógrafo', 'ativo' => true, 'telefone' => '81999990000']);
        $local->proprietarios()->attach($socio->id, ['tipo' => 'socio']);

        $this->actingAs($socio)->post(route('servicos.store'), [
            'nome' => 'Ensaio externo', 'tipo_servico' => 'Fotografia', 'valor' => 300, 'duracao_minutos' => 120,
            'estabelecimentos_ids' => [$local->id], 'tipo_pagamento' => 'presencial', 'horario_a_combinar' => 1,
            'dias_disponiveis' => ['sabado'],
        ])->assertSessionHasNoErrors();

        $servico = Servico::where('nome', 'Ensaio externo')->firstOrFail();
        $this->assertTrue($servico->horarioACombinar());

        $cliente = $this->usuario();
        $this->actingAs($cliente)->get(route('cliente.servicos.show', $servico->id))->assertOk()
            ->assertInertia(fn ($p) => $p->where('servico.horario_a_combinar', true)->where('estabelecimento.telefone', '81999990000'));

        \Laravel\Sanctum\Sanctum::actingAs($cliente);
        $this->getJson("/api/mobile/servicos/{$servico->id}")->assertOk()->assertJsonPath('horario_a_combinar', true);

        // Agendar com horário inventado é recusado: o horário é combinado com o proprietário.
        $this->actingAs($cliente)->post(route('cliente.agendar.store', $local->id), [
            'servico_id' => $servico->id, 'data_agendamento' => now()->addDays(2)->toDateString(), 'hora_agendamento' => '10:00',
            'forma_pagamento' => 'presencial',
        ])->assertSessionHasErrors('hora_agendamento');
        $this->assertSame(0, Agendamento::where('servico_id', $servico->id)->count());
    }

    public function test_assinar_com_cartao_envia_o_cartao_ao_asaas_e_mostra_pix_perto_do_vencimento(): void
    {
        \Illuminate\Support\Facades\Mail::fake();
        config(['services.asaas.url' => 'https://asaas.teste/v3', 'services.asaas.key' => 'chave']);
        $cliente = $this->usuario();
        $cliente->update(['asaas_customer_id' => 'cus_1', 'cpf_cnpj' => '52998224725']);

        \Illuminate\Support\Facades\Http::fake([
            'asaas.teste/v3/subscriptions/*/payments*' => \Illuminate\Support\Facades\Http::response(['data' => [
                ['id' => 'pay_9', 'status' => 'PENDING', 'value' => 8, 'dueDate' => now()->addDay()->toDateString(), 'billingType' => 'PIX', 'invoiceUrl' => 'https://asaas.teste/i/pay_9'],
            ]]),
            'asaas.teste/v3/payments/pay_9/pixQrCode' => \Illuminate\Support\Facades\Http::response(['encodedImage' => 'QUJD', 'payload' => '000201PIX', 'expirationDate' => now()->addDay()->toDateString()]),
            'asaas.teste/v3/subscriptions' => \Illuminate\Support\Facades\Http::response(['id' => 'sub_novo']),
        ]);

        $this->actingAs($cliente)->postJson('/minha-assinatura/assinar', [
            'plano' => 'premium', 'metodo' => 'credit_card',
            'cartao' => ['numero' => '4111 1111 1111 1111', 'titular' => 'MARIA SILVA', 'mes' => 12, 'ano' => 30, 'cvv' => '123'],
            'titular' => ['cpf_cnpj' => '529.982.247-25', 'cep' => '01000-000', 'numero' => '10'],
        ])->assertOk();

        \Illuminate\Support\Facades\Http::assertSent(fn ($r) => str_ends_with($r->url(), '/subscriptions')
            && $r['billingType'] === 'CREDIT_CARD'
            && $r['creditCard']['number'] === '4111111111111111'
            && $r['creditCard']['expiryYear'] === '2030'
            && $r['creditCardHolderInfo']['postalCode'] === '01000000');

        // Cobrança Pix que vence amanhã: a tela mostra o QR code.
        $this->actingAs($cliente)->getJson('/minha-assinatura/cobranca')->assertOk()
            ->assertJsonPath('cobranca.mostrar', true)
            ->assertJsonPath('cobranca.pix.copia_e_cola', '000201PIX');

        // A tela recebe os planos com os benefícios explicados.
        $this->actingAs($cliente)->get(route('assinatura.status'))->assertOk()
            ->assertInertia(fn ($p) => $p->where('planos.0.id', 'premium')
                ->where('planos.0.beneficios.0.titulo', 'Use pontos em qualquer serviço ou reserva'));
    }

    private function carteiraDoSocio(User $socio): void
    {
        \Illuminate\Support\Facades\DB::table('providers')->insert([
            'user_id' => $socio->id, 'name' => 'Loja', 'email' => uniqid() . '@p.com', 'birth_date' => '1990-01-01',
            'document' => (string) random_int(10000000000000, 99999999999999), 'pix_key_type' => 'CNPJ', 'pix_key' => '11222333000181', 'person_type' => 'JURIDICA',
            'mobile_phone' => '11999998888', 'postal_code' => '01000000', 'address' => 'Rua', 'address_number' => '1', 'province' => 'Centro',
            'asaas_wallet_id' => 'wal_' . uniqid(), 'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    public function test_agendamento_cobra_o_valor_com_a_promocao_do_servico(): void
    {
        $socio = $this->usuario('socio');
        $local = Estabelecimento::create(['nome' => 'Barbearia Promo', 'ativo' => true]);
        $local->proprietarios()->attach($socio->id, ['tipo' => 'socio']);
        $servico = Servico::create([
            'estabelecimento_id' => $local->id, 'nome' => 'Corte', 'tipo_servico' => 'Beleza', 'valor' => 100, 'duracao_minutos' => 30,
            'ativo' => true, 'tem_promocao' => true, 'tipo_desconto' => 'percentual', 'valor_desconto' => 20,
            'horarios_disponiveis' => ['10:00'], 'configuracoes' => ['tipo_pagamento' => 'presencial'],
        ]);

        $cliente = $this->usuario();
        $this->actingAs($cliente)->get(route('cliente.agendar', $local->id))->assertOk()
            ->assertInertia(fn ($p) => $p->where('servicos.0.tem_promocao', true)->where('aceitaPagamentoOnline', false));

        $this->actingAs($cliente)->post(route('cliente.agendar.store', $local->id), [
            'servico_id' => $servico->id, 'data_agendamento' => now()->addDays(2)->toDateString(), 'hora_agendamento' => '10:00',
            'forma_pagamento' => 'presencial',
        ])->assertSessionHasNoErrors();

        $this->assertEquals(80.0, (float) Agendamento::where('servico_id', $servico->id)->value('valor_final'));
    }

    public function test_socio_sem_carteira_so_recebe_pagamento_no_local(): void
    {
        $socio = $this->usuario('socio');
        $local = Estabelecimento::create(['nome' => 'Sem Carteira', 'ativo' => true]);
        $local->proprietarios()->attach($socio->id, ['tipo' => 'socio']);
        $servico = Servico::create([
            'estabelecimento_id' => $local->id, 'nome' => 'Massagem', 'tipo_servico' => 'Bem-estar', 'valor' => 120, 'duracao_minutos' => 60,
            'ativo' => true, 'horarios_disponiveis' => ['14:00'], 'configuracoes' => ['tipo_pagamento' => 'online'],
        ]);
        $cliente = $this->usuario();

        // Mesmo cadastrado como "somente online", o cliente vê só "pagar no local".
        $this->actingAs($cliente)->get(route('cliente.servicos.show', $servico->id))->assertOk()
            ->assertInertia(fn ($p) => $p->where('servico.tipo_pagamento', 'presencial')->where('servico.aceita_pagamento_online', false));
        \Laravel\Sanctum\Sanctum::actingAs($cliente);
        $this->getJson("/api/mobile/servicos/{$servico->id}")->assertOk()->assertJsonPath('aceita_pagamento_online', false);

        $dados = ['servico_id' => $servico->id, 'data_agendamento' => now()->addDays(2)->toDateString(), 'hora_agendamento' => '14:00'];
        $this->actingAs($cliente)->post(route('cliente.agendar.store', $local->id), $dados + ['forma_pagamento' => 'online_agora', 'metodo_pagamento' => 'pix'])
            ->assertSessionHasErrors('forma_pagamento');
        $this->actingAs($cliente)->post(route('cliente.agendar.store', $local->id), $dados + ['forma_pagamento' => 'presencial'])
            ->assertSessionHasNoErrors();
        $this->assertSame(1, Agendamento::where('servico_id', $servico->id)->count());

        // Com a carteira aberta, o online volta a aparecer.
        $this->carteiraDoSocio($socio);
        $this->actingAs($cliente)->get(route('cliente.servicos.show', $servico->id))->assertOk()
            ->assertInertia(fn ($p) => $p->where('servico.tipo_pagamento', 'online')->where('servico.aceita_pagamento_online', true));
    }

    public function test_busca_do_explorar_no_app_encontra_resultados_mesmo_sem_acento(): void
    {
        $local = Estabelecimento::create(['nome' => 'Salão Busca ' . uniqid(), 'ativo' => true, 'ramo_atuacao' => 'Beleza']);
        Servico::create([
            'estabelecimento_id' => $local->id, 'nome' => 'Escova Progressiva Única', 'tipo_servico' => 'Beleza', 'valor' => 90,
            'duracao_minutos' => 60, 'ativo' => true,
        ]);
        \Laravel\Sanctum\Sanctum::actingAs($this->usuario());

        $this->getJson('/api/mobile/explorar?tipo_busca=estabelecimentos&busca=salao busca')->assertOk()
            ->assertJsonPath('data.0.id', $local->id);
        $this->getJson('/api/mobile/explorar?tipo_busca=servicos&busca=progressiva unica')->assertOk()
            ->assertJsonPath('data.0.nome', 'Escova Progressiva Única');
    }
}
