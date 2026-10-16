<?php

namespace Tests\Feature;

use App\Models\Estabelecimento;
use App\Models\FlashDeal;
use App\Models\ItemAluguel;
use App\Models\Servico;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\Support\FalsaWikimedia;
use Tests\TestCase;

class GuiaLocalTest extends TestCase
{
    use DatabaseTransactions;
    use FalsaWikimedia;

    private function usuario(string $papel = 'user', array $extra = []): User
    {
        return User::create(array_merge([
            'name' => 'U' . uniqid(), 'email' => uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'),
            'papel' => $papel, 'plano_assinatura' => 'gratuito',
        ], $extra));
    }

    /** Local com um serviço, numa coordenada. */
    private function servicoEm(string $nome, float $lat, float $lng, string $ramo = 'Restaurante', array $extra = [], ?User $dono = null): Servico
    {
        $dono ??= $this->usuario('socio');
        $local = Estabelecimento::create(['nome' => $nome, 'ativo' => true, 'ramo_atuacao' => $ramo, 'cidade' => 'Recife', 'latitude' => $lat, 'longitude' => $lng]);
        $local->proprietarios()->attach($dono->id, ['tipo' => 'socio']);

        return Servico::create(array_merge([
            'estabelecimento_id' => $local->id, 'nome' => $nome . ' - prato', 'tipo_servico' => 'Gastronomia', 'valor' => 50,
            'duracao_minutos' => 60, 'ativo' => true, 'horarios_disponiveis' => ['12:30', '19:30'],
        ], $extra));
    }

    private function carteira(User $dono): void
    {
        DB::table('providers')->insert([
            'user_id' => $dono->id, 'name' => 'Loja', 'email' => uniqid() . '@p.com', 'birth_date' => '1990-01-01',
            'document' => (string) random_int(10000000000000, 99999999999999), 'pix_key_type' => 'CNPJ', 'pix_key' => '1', 'person_type' => 'JURIDICA',
            'mobile_phone' => '11999998888', 'postal_code' => '01000000', 'address' => 'Rua', 'address_number' => '1', 'province' => 'Centro',
            'asaas_wallet_id' => 'wal_' . uniqid(), 'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    public function test_guia_por_nome_traz_descricao_dados_dicas_pontos_e_locacoes_proximas(): void
    {
        $this->fingirWikimedia($this->pontosRecife());
        $restaurante = $this->servicoEm('Bode do Nô', -8.0640, -34.8720);
        $chale = ItemAluguel::create(['estabelecimento_id' => $this->usuario('socio')->id, 'nome' => 'Flat no Recife Antigo', 'categoria' => 'flat',
            'valor_diaria' => 200, 'ativo' => true, 'latitude' => -8.0625, 'longitude' => -34.8715, 'cidade' => 'Recife']);
        FlashDeal::create(['criado_por' => $this->usuario('socio')->id, 'alvo_tipo' => 'servico', 'alvo_id' => $restaurante->id, 'alvo_nome' => 'x',
            'percentual' => 20, 'quantidade' => 10, 'usados' => 0, 'inicia_em' => now()->subMinute(), 'expira_em' => now()->addHour(), 'status' => 'ativo']);
        Servico::create(['estabelecimento_id' => Estabelecimento::create(['nome' => 'Longe', 'ativo' => true, 'latitude' => -9.6, 'longitude' => -35.7])->id,
            'nome' => 'Fora do raio', 'tipo_servico' => 'x', 'valor' => 10, 'duracao_minutos' => 30, 'ativo' => true]);

        Sanctum::actingAs($this->usuario());
        $r = $this->getJson('/api/mobile/guia-local?termo=Recife')->assertOk();

        $r->assertJsonPath('local.titulo', 'Recife')
            ->assertJsonPath('local.dados.populacao', 1488920)
            ->assertJsonPath('local.dados.estado', 'Pernambuco')
            ->assertJsonPath('local.dados.area_km2', 218.4)
            ->assertJsonPath('local.link', 'https://pt.wikipedia.org/wiki/Recife')
            ->assertJsonPath('local.imagem', 'https://upload.wikimedia.org/recife.jpg');
        $this->assertStringContainsString('Veneza brasileira', $r->json('local.descricao'));
        $this->assertStringContainsString('Wikipédia', $r->json('local.fonte'));

        $secoes = collect($r->json('local.infos_uteis'))->pluck('texto', 'secao');
        $this->assertSame(['Sobre o destino', 'Como chegar', 'O que ver'], $secoes->keys()->all());
        $this->assertStringContainsString('De avião:', $secoes['Como chegar']);
        $this->assertStringNotContainsString('==', $secoes['Como chegar']);

        $pontos = collect($r->json('pontos_turisticos'));
        $this->assertNotContains('Recife', $pontos->pluck('titulo')); // a própria cidade não é "ponto próximo"
        $this->assertSame('Marco Zero', $pontos->first()['titulo']);
        $this->assertSame('Confira o horário de funcionamento', $pontos->first()['aviso_horario']);

        $locs = $r->json('locacoes_proximas');
        $this->assertSame($restaurante->id, $locs['restaurantes']['itens'][0]['id']);
        $this->assertSame(20, $locs['restaurantes']['itens'][0]['flash_deal']['percentual']);
        $this->assertSame($chale->id, $locs['hospedagem']['itens'][0]['id']);
        $this->assertNotContains('Fora do raio', collect($locs)->pluck('itens')->flatten(1)->pluck('titulo'));

        Http::assertSent(fn (Request $req) => $req->hasHeader('User-Agent', 'LOKYVA/1.0 (TCC UNIFACOL; jonathan.rocha@unifacol.edu.br)'));
    }

    public function test_respostas_ficam_em_cache_e_a_busca_por_localizacao_arredonda_a_chave(): void
    {
        $this->fingirWikimedia($this->pontosRecife());
        Sanctum::actingAs($this->usuario());

        $this->getJson('/api/mobile/guia-local?lat=-8.06311&lng=-34.87112')->assertOk();
        $chamadas = count(Http::recorded());
        $this->getJson('/api/mobile/guia-local?lat=-8.06349&lng=-34.87148')->assertOk(); // mesma chave com 2 casas

        $this->assertSame($chamadas, count(Http::recorded()), 'A segunda busca deveria vir do cache.');
    }

    public function test_wikimedia_sem_resultado_ou_fora_do_ar_mostra_so_as_locacoes_com_mensagem_amigavel(): void
    {
        $restaurante = $this->servicoEm('Cantina', -8.0640, -34.8720);
        Sanctum::actingAs($this->usuario());

        foreach (['vazio', 'falha'] as $modo) {
            \Illuminate\Support\Facades\Cache::flush();
            $this->fingirWikimedia($this->pontosRecife(), $modo);

            $r = $this->getJson('/api/mobile/guia-local?lat=-8.0631&lng=-34.8711')->assertOk();
            $r->assertJsonPath('local', null)->assertJsonPath('pontos_turisticos', []);
            $this->assertNotEmpty($r->json('mensagem'));
            $this->assertSame($restaurante->id, $r->json('locacoes_proximas.restaurantes.itens.0.id'));

            // Por nome, sem a Wikimedia e sem geocodificador, não dá para saber onde fica: 404 com texto amigável.
            $nome = $this->getJson('/api/mobile/guia-local?termo=Cidade%20Inexistente')->assertNotFound();
            $this->assertStringContainsString('Não encontramos esse lugar', $nome->json('mensagem'));
            $this->assertStringNotContainsString('Exception', (string) $nome->getContent());
        }
    }

    public function test_locacoes_proximas_seguem_o_ranking_do_explorar_e_depois_a_distancia(): void
    {
        $this->fingirWikimedia([], 'vazio');

        // Demais, bem perto.
        $demais = $this->servicoEm('Demais Perto', -8.0632, -34.8712);
        // Aceita pagamento online, um pouco mais longe.
        $donoOnline = $this->usuario('socio');
        $this->carteira($donoOnline);
        $online = $this->servicoEm('Online', -8.0660, -34.8740, 'Restaurante', [], $donoOnline);
        // Aceita pontos, mais longe.
        $pontos = $this->servicoEm('Pontos', -8.0700, -34.8800, 'Restaurante', ['aceita_pontos' => true]);
        // Premium, o mais longe de todos (mas dentro do raio) — e um segundo premium mais perto que ele.
        $premiumLonge = $this->servicoEm('Premium Longe', -8.0900, -34.9000, 'Restaurante', [], $this->usuario('socio', ['plano_assinatura' => 'premium', 'plano_expira_em' => now()->addMonth()]));
        $premiumPerto = $this->servicoEm('Premium Perto', -8.0750, -34.8850, 'Restaurante', [], $this->usuario('socio', ['plano_assinatura' => 'premium', 'plano_expira_em' => now()->addMonth()]));

        Sanctum::actingAs($this->usuario());
        $itens = collect($this->getJson('/api/mobile/guia-local?lat=-8.0631&lng=-34.8711')->assertOk()->json('locacoes_proximas.restaurantes.itens'));
        $nossos = $itens->whereIn('id', [$demais->id, $online->id, $pontos->id, $premiumLonge->id, $premiumPerto->id])->pluck('id')->values()->all();

        $this->assertSame([$premiumPerto->id, $premiumLonge->id, $pontos->id, $online->id, $demais->id], $nossos);
        $this->assertTrue($itens->firstWhere('id', $premiumPerto->id)['destaque_premium']);
        $this->assertTrue($itens->firstWhere('id', $online->id)['aceita_pagamento_online']);
        $this->assertLessThan($itens->firstWhere('id', $premiumLonge->id)['distancia_km'], $itens->firstWhere('id', $premiumPerto->id)['distancia_km']);
    }

    public function test_guia_exige_termo_ou_localizacao_e_tem_limite_de_requisicoes(): void
    {
        $this->fingirWikimedia([], 'vazio');
        Sanctum::actingAs($this->usuario());

        $this->getJson('/api/mobile/guia-local')->assertStatus(422)->assertJsonValidationErrors('termo');

        for ($i = 0; $i < 30; $i++) {
            $this->getJson('/api/mobile/guia-local?lat=-8.0631&lng=-34.8711');
        }
        $this->getJson('/api/mobile/guia-local?lat=-8.0631&lng=-34.8711')->assertStatus(429);
    }

    public function test_paginas_proximas_que_nao_sao_turisticas_ficam_de_fora(): void
    {
        $guia = \App\Services\Viagem\GuiaLocalService::class;
        $this->assertFalse($guia::ehPontoTuristico('TV Nova', 'emissora de televisão brasileira'));
        $this->assertFalse($guia::ehPontoTuristico('CBN Recife', 'emissora de rádio'));
        $this->assertFalse($guia::ehPontoTuristico('Escola Estadual X', null));
        $this->assertTrue($guia::ehPontoTuristico('Observatório do Alto da Sé', 'mirante em Olinda'));
        $this->assertTrue($guia::ehPontoTuristico('Museu Cais do Sertão', 'museu no Recife'));
    }

    public function test_web_usa_o_mesmo_guia_pela_sessao(): void
    {
        $this->fingirWikimedia($this->pontosRecife());

        $this->actingAs($this->usuario())->getJson('/viagens/api/guia-local?termo=Recife')->assertOk()->assertJsonPath('local.titulo', 'Recife');
        $this->actingAs($this->usuario())->get('/viagens/guia')->assertOk()->assertInertia(fn ($p) => $p->component('Cliente/Viagens/Guia'));
    }
}
