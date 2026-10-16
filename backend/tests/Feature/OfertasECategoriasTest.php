<?php

namespace Tests\Feature;

use App\Models\Conversa;
use App\Models\Cupom;
use App\Models\Estabelecimento;
use App\Models\Favorito;
use App\Models\ItemAluguel;
use App\Models\Mensagem;
use App\Models\Servico;
use App\Models\User;
use App\Support\Categorias;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OfertasECategoriasTest extends TestCase
{
    use DatabaseTransactions;

    private function usuario(string $papel = 'user'): User
    {
        return User::create([
            'name' => 'U' . uniqid(), 'email' => uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'),
            'papel' => $papel, 'plano_assinatura' => 'gratuito',
        ]);
    }

    /** Local com sócio, um serviço, uma reserva e clientes que favoritaram de jeitos diferentes. */
    private function cenario(): array
    {
        $socio = $this->usuario('socio');
        $local = Estabelecimento::create(['nome' => 'Pousada Sol', 'ativo' => true, 'ramo_atuacao' => 'Pousada', 'cidade' => 'Gravatá']);
        $local->proprietarios()->attach($socio->id, ['tipo' => 'socio']);
        $servico = Servico::create(['estabelecimento_id' => $local->id, 'nome' => 'Café colonial', 'tipo_servico' => 'Gastronomia e Bebidas', 'valor' => 40, 'duracao_minutos' => 60, 'ativo' => true]);
        $chale = ItemAluguel::create(['estabelecimento_id' => $socio->id, 'local_id' => $local->id, 'nome' => 'Chalé', 'categoria' => 'chalé', 'valor_diaria' => 300, 'ativo' => true]);

        $fa1 = $this->usuario();
        $fa2 = $this->usuario();
        $fa3 = $this->usuario();
        $naoFa = $this->usuario();
        Favorito::create(['usuario_id' => $fa1->id, 'estabelecimento_id' => $local->id]);
        Favorito::create(['usuario_id' => $fa2->id, 'servico_id' => $servico->id]);
        Favorito::create(['usuario_id' => $fa3->id, 'item_aluguel_id' => $chale->id]);
        Favorito::create(['usuario_id' => $fa1->id, 'servico_id' => $servico->id]); // repetido: recebe uma vez só
        Favorito::create(['usuario_id' => $socio->id, 'estabelecimento_id' => $local->id]); // equipe não recebe

        $cupom = Cupom::create(['estabelecimento_id' => $local->id, 'codigo' => 'FAS' . random_int(100, 999), 'titulo' => '15% no café', 'tipo_desconto' => 'percentual',
            'valor_desconto' => 15, 'pontos_custo' => 500, 'ativo' => true, 'data_validade' => now()->addMonth()->toDateString()]);

        return compact('socio', 'local', 'servico', 'chale', 'fa1', 'fa2', 'fa3', 'naoFa', 'cupom');
    }

    public function test_socio_envia_oferta_com_cupom_para_quem_favoritou_pelo_chat(): void
    {
        ['socio' => $socio, 'local' => $local, 'fa1' => $fa1, 'fa2' => $fa2, 'fa3' => $fa3, 'naoFa' => $naoFa, 'cupom' => $cupom] = $this->cenario();

        $this->actingAs($socio)->getJson(route('ofertas-favoritos.painel', $local->id))->assertOk()
            ->assertJsonPath('publico', 3)->assertJsonPath('cupons.0.id', $cupom->id);

        $this->actingAs($socio)->postJson(route('ofertas-favoritos.enviar', $local->id), [
            'titulo' => 'Fim de semana com desconto', 'mensagem' => 'Quem favoritou a pousada ganha 15% no café colonial.', 'cupom_id' => $cupom->id,
        ])->assertCreated()->assertJsonPath('oferta.destinatarios', 3);

        foreach ([$fa1, $fa2, $fa3] as $cliente) {
            $conversa = Conversa::where('usuario_id', $cliente->id)->where('estabelecimento_id', $local->id)->firstOrFail();
            $msg = Mensagem::where('conversa_id', $conversa->id)->firstOrFail();
            $this->assertSame('oferta', $msg->tipo);
            $this->assertSame($cupom->id, $msg->cupom_id);
            // O cupom já fica na carteira, sem gastar pontos.
            $this->assertTrue(DB::table('cupom_user')->where('user_id', $cliente->id)->where('cupom_id', $cupom->id)->where('usado', false)->exists());
        }
        $this->assertFalse(Conversa::where('usuario_id', $naoFa->id)->exists());
        $this->assertFalse(Conversa::where('usuario_id', $socio->id)->exists());
        $this->assertSame(1, Mensagem::whereHas('conversa', fn ($q) => $q->where('usuario_id', $fa1->id))->count());

        // O cliente vê o cartão da oferta no chat (app e site).
        $conversa = Conversa::where('usuario_id', $fa2->id)->first();
        Sanctum::actingAs($fa2);
        $this->getJson("/api/mobile/mensagens/{$conversa->id}")->assertOk()
            ->assertJsonPath('mensagens.0.oferta.cupom.codigo', $cupom->codigo)
            ->assertJsonPath('mensagens.0.oferta.cupom.desconto', '15% de desconto')
            ->assertJsonPath('mensagens.0.oferta.local.id', $local->id);
    }

    public function test_oferta_tem_limite_diario_permissao_e_cupom_do_proprio_local(): void
    {
        ['socio' => $socio, 'local' => $local, 'naoFa' => $estranho] = $this->cenario();
        $outroLocal = Estabelecimento::create(['nome' => 'Outro', 'ativo' => true]);
        $cupomDeOutro = Cupom::create(['estabelecimento_id' => $outroLocal->id, 'codigo' => 'OUT' . random_int(100, 999), 'titulo' => 'x', 'tipo_desconto' => 'fixo', 'valor_desconto' => 5, 'ativo' => true]);
        $dados = ['titulo' => 'Novidade', 'mensagem' => 'Temos novidades para você.'];

        $this->actingAs($estranho)->postJson(route('ofertas-favoritos.enviar', $local->id), $dados)->assertForbidden();
        $this->actingAs($socio)->postJson(route('ofertas-favoritos.enviar', $local->id), $dados + ['cupom_id' => $cupomDeOutro->id])->assertStatus(422)->assertJsonValidationErrors('cupom_id');

        for ($i = 0; $i < 3; $i++) {
            $this->actingAs($socio)->postJson(route('ofertas-favoritos.enviar', $local->id), $dados)->assertCreated();
        }
        $this->actingAs($socio)->postJson(route('ofertas-favoritos.enviar', $local->id), $dados)->assertStatus(422)->assertJsonValidationErrors('mensagem');

        // App do sócio usa o mesmo endpoint.
        Sanctum::actingAs($socio);
        $this->getJson("/api/mobile/proprietario/ofertas-favoritos?estabelecimento_id={$local->id}")->assertOk()->assertJsonPath('enviadas_hoje', 3);
    }

    public function test_categorias_resolvem_filtros_novos_antigos_ramos_e_tipos(): void
    {
        $casos = [
            'hospedagem' => 'hospedagem', 'flats' => 'hospedagem', 'chalé' => 'hospedagem', 'Pousada' => 'hospedagem',
            'Restaurante/Lanchonete' => 'gastronomia', 'restaurante' => 'gastronomia', 'Pets' => 'pets', 'pets' => 'pets',
            'Pet Shop' => 'pets', 'Salão de Beleza' => 'beleza', 'Estética' => 'beleza', 'Saúde e Bem-Estar' => 'saude',
            'carro' => 'veiculos', 'Locadoras' => 'veiculos', 'Academia' => 'fitness', 'Escola de Esportes' => 'fitness',
            'Auto Escola' => 'automotivo', 'Barbearia' => 'barbearia',
        ];
        foreach ($casos as $filtro => $slug) {
            $this->assertSame($slug, Categorias::grupo($filtro)['slug'] ?? null, "Filtro \"{$filtro}\"");
        }
        $this->assertNull(Categorias::grupo('tudo'));
        $this->assertNull(Categorias::grupo('qualquer coisa que não existe'));

        // Toda categoria de reserva da lista existe no banco; os ícones dos chips também são nomes válidos.
        $this->assertContains('chalé', Categorias::valoresReserva());
        $this->assertGreaterThan(15, count(Categorias::explorar()));
        $this->assertGreaterThan(25, count(Categorias::valores()));
    }

    public function test_explorar_do_app_puxa_as_categorias_e_filtra_locais_servicos_e_reservas(): void
    {
        ['local' => $local, 'servico' => $servico, 'chale' => $chale] = $this->cenario();
        $barbearia = Estabelecimento::create(['nome' => 'Barbearia do Zé', 'ativo' => true, 'ramo_atuacao' => 'Barbearia']);
        Sanctum::actingAs($this->usuario());

        $grupos = collect($this->getJson('/api/mobile/explorar/categorias')->assertOk()->json('grupos'));
        $this->assertTrue($grupos->contains('slug', 'hospedagem'));
        $this->assertGreaterThan(0, $grupos->firstWhere('slug', 'hospedagem')['total']);

        $locais = collect($this->getJson('/api/mobile/explorar?tipo_busca=estabelecimentos&categoria=hospedagem')->assertOk()->json('data'))->pluck('id');
        $this->assertContains($local->id, $locais);
        $this->assertNotContains($barbearia->id, $locais);

        $servicos = collect($this->getJson('/api/mobile/explorar?tipo_busca=servicos&categoria=gastronomia')->assertOk()->json('data'))->pluck('id');
        $this->assertContains($servico->id, $servicos);

        $reservas = collect($this->getJson('/api/mobile/explorar?tipo_busca=reservas&categoria=flats')->assertOk()->json('data'))->pluck('id');
        $this->assertContains($chale->id, $reservas);

        $this->getJson('/api/categorias')->assertOk()->assertJsonStructure(['explorar', 'servicos', 'ramos', 'reservas', 'explorar_totais']);
    }

    public function test_explorar_coloca_primeiro_o_que_esta_perto_de_quem_viaja(): void
    {
        $longePremium = Estabelecimento::create(['nome' => 'Longe Premium', 'ativo' => true, 'ramo_atuacao' => 'Restaurante', 'latitude' => -23.55, 'longitude' => -46.63, 'avaliacao_media' => 5]);
        $dono = $this->usuario('socio');
        $dono->update(['plano_assinatura' => 'premium', 'plano_expira_em' => now()->addMonth()]);
        $longePremium->proprietarios()->attach($dono->id, ['tipo' => 'socio']);
        $perto = Estabelecimento::create(['nome' => 'Perto Simples', 'ativo' => true, 'ramo_atuacao' => 'Restaurante', 'latitude' => -8.20, 'longitude' => -35.57]);
        Sanctum::actingAs($this->usuario());

        $r = $this->getJson('/api/mobile/explorar?tipo_busca=estabelecimentos&categoria=gastronomia&lat=-8.21&lng=-35.56')->assertOk();
        $ids = collect($r->json('data'))->pluck('id')->values();
        $this->assertLessThan($ids->search($longePremium->id), $ids->search($perto->id));
        $this->assertGreaterThanOrEqual(1, $r->json('meta.perto_de_voce'));

        // Sem localização, o ranking de sempre (premium primeiro) continua.
        $ids = collect($this->getJson('/api/mobile/explorar?tipo_busca=estabelecimentos&categoria=gastronomia')->json('data'))->pluck('id')->values();
        $this->assertLessThan($ids->search($perto->id), $ids->search($longePremium->id));
    }

    public function test_categoria_de_reserva_invalida_e_recusada_com_mensagem_e_nao_com_erro_500(): void
    {
        $socio = $this->usuario('socio');
        Sanctum::actingAs($socio);

        $this->postJson('/api/mobile/proprietario/locacoes-avulsas', [
            'nome' => 'Pesque pague', 'categoria' => 'pesque_pague', 'valor_diaria' => 50, 'quantidade' => 1,
        ])->assertStatus(422)->assertJsonValidationErrors('categoria');
    }
}
