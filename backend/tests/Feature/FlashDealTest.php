<?php

namespace Tests\Feature;

use App\Models\Agendamento;
use App\Models\Aluguel;
use App\Models\Estabelecimento;
use App\Models\FlashDeal;
use App\Models\FlashDealAviso;
use App\Models\ItemAluguel;
use App\Models\Servico;
use App\Models\User;
use App\Services\FlashDealService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FlashDealTest extends TestCase
{
    use DatabaseTransactions;

    // Hotel em Bonito-MS (coordenadas aproximadas do centro).
    private const LAT = -21.1261;
    private const LNG = -56.4836;

    private string $cidade;

    protected function setUp(): void
    {
        parent::setUp();
        Http::fake();
        $this->cidade = 'Bonito' . uniqid();
    }

    private function usuario(string $papel = 'user', array $extra = []): User
    {
        $user = User::create([
            'name' => 'U' . uniqid(), 'email' => uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'),
            'papel' => $papel, 'plano_assinatura' => 'gratuito', 'expo_push_token' => 'ExponentPushToken[' . uniqid() . ']',
        ]);
        if ($extra) {
            $user->forceFill($extra)->save();
        }

        return $user;
    }

    /** Cliente com o app aberto há pouco, a ~2 km do hotel. */
    private function clienteNaCidade(): User
    {
        return $this->usuario('user', ['ultima_latitude' => self::LAT + 0.02, 'ultima_longitude' => self::LNG, 'ultima_cidade' => $this->cidade, 'ultima_localizacao_em' => now()->subMinutes(20)]);
    }

    private function hotel(User $dono, array $extra = []): ItemAluguel
    {
        return ItemAluguel::create($extra + [
            'estabelecimento_id' => $dono->id, 'nome' => 'Quarto Standard', 'categoria' => 'hotel', 'periodo_faturamento_padrao' => 'diaria',
            'valor_diaria' => 300, 'quantidade' => 5, 'ativo' => true, 'disponivel' => true, 'sempre_disponivel' => true,
            'cidade' => $this->cidade, 'estado' => 'MS', 'latitude' => self::LAT, 'longitude' => self::LNG,
        ]);
    }

    private function reservar(User $cliente, ItemAluguel $item): Aluguel
    {
        return Aluguel::create([
            'codigo_reserva' => 'RES-' . uniqid(), 'estabelecimento_id' => $item->estabelecimento_id, 'item_aluguel_id' => $item->id,
            'proprietario_id' => $item->estabelecimento_id, 'locatario_id' => $cliente->id, 'tipo_periodo' => 'diaria',
            'quantidade_periodos' => 1, 'data_inicio' => now()->toDateString(), 'data_fim' => now()->addDay()->toDateString(),
            'valor_unitario' => 150, 'valor_total' => 150, 'forma_pagamento' => 'online', 'status' => 'confirmado',
        ]);
    }

    public function test_socio_cria_flash_deal_e_so_quem_esta_na_cidade_e_avisado(): void
    {
        $socio = $this->usuario('socio');
        $hotel = $this->hotel($socio);
        $perto = $this->clienteNaCidade();
        $longe = $this->usuario('user', ['ultima_latitude' => -23.55, 'ultima_longitude' => -46.63, 'ultima_cidade' => 'São Paulo', 'ultima_localizacao_em' => now()]);
        $antigo = $this->usuario('user', ['ultima_latitude' => self::LAT, 'ultima_longitude' => self::LNG, 'ultima_localizacao_em' => now()->subDays(2)]);

        $this->actingAs($socio)->post('/gestao/flash-deals', [
            'alvo_tipo' => 'item_aluguel', 'alvo_id' => $hotel->id, 'percentual' => 50, 'quantidade' => 5, 'duracao_minutos' => 120,
        ])->assertRedirect()->assertSessionHas('success');

        $deal = FlashDeal::where('alvo_id', $hotel->id)->firstOrFail();
        $this->assertSame('ativo', $deal->status);
        $this->assertEqualsWithDelta(now()->addHours(2)->timestamp, $deal->expira_em->timestamp, 5);
        $this->assertSame([$perto->id], FlashDealAviso::where('flash_deal_id', $deal->id)->pluck('usuario_id')->all());
        $this->assertNotContains($longe->id, FlashDealAviso::pluck('usuario_id'));
        $this->assertNotContains($antigo->id, FlashDealAviso::pluck('usuario_id'));
        Http::assertSent(fn ($r) => str_contains($r->url(), 'exp.host') && str_contains(json_encode($r->data()), '50% OFF'));

        // O desconto entra no campo de promoção que toda a cobrança já usa.
        $hotel->refresh();
        $this->assertTrue((bool) $hotel->tem_promocao);
        $this->assertSame('percentual', $hotel->tipo_desconto);
        $this->assertEquals(50, $hotel->valor_desconto);
    }

    public function test_ao_vencer_a_promocao_original_volta(): void
    {
        $socio = $this->usuario('socio');
        $hotel = $this->hotel($socio, ['tem_promocao' => true, 'tipo_desconto' => 'fixo', 'valor_desconto' => 20]);
        $deal = app(FlashDealService::class)->criar($socio, ['alvo_tipo' => 'item_aluguel', 'alvo_id' => $hotel->id, 'percentual' => 40, 'quantidade' => 3]);

        $this->travel(121)->minutes();
        $this->artisan('flash-deals:encerrar')->assertSuccessful();

        $this->assertSame('encerrado', $deal->fresh()->status);
        $hotel->refresh();
        $this->assertTrue((bool) $hotel->tem_promocao);
        $this->assertSame('fixo', $hotel->tipo_desconto);
        $this->assertEquals(20, $hotel->valor_desconto);
    }

    public function test_reservas_consomem_vagas_e_o_deal_esgota(): void
    {
        $socio = $this->usuario('socio');
        $hotel = $this->hotel($socio);
        $cliente = $this->clienteNaCidade();
        $deal = app(FlashDealService::class)->criar($socio, ['alvo_tipo' => 'item_aluguel', 'alvo_id' => $hotel->id, 'percentual' => 50, 'quantidade' => 2]);

        $this->reservar($cliente, $hotel);
        $this->assertSame(1, $deal->fresh()->usados);
        $this->assertNotNull(FlashDealAviso::where('flash_deal_id', $deal->id)->where('usuario_id', $cliente->id)->value('convertido_em'));

        $this->reservar($this->usuario(), $hotel);
        $this->assertSame('esgotado', $deal->fresh()->status);
        $this->assertFalse((bool) $hotel->fresh()->tem_promocao, 'Esgotou: o preço normal volta na hora.');
    }

    public function test_cancelar_devolve_o_preco_normal(): void
    {
        $socio = $this->usuario('socio');
        $hotel = $this->hotel($socio);
        $deal = app(FlashDealService::class)->criar($socio, ['alvo_tipo' => 'item_aluguel', 'alvo_id' => $hotel->id, 'percentual' => 30, 'quantidade' => 2]);

        Sanctum::actingAs($socio);
        $this->postJson("/api/mobile/proprietario/flash-deals/{$deal->id}/cancelar")->assertOk();

        $this->assertSame('cancelado', $deal->fresh()->status);
        $this->assertFalse((bool) $hotel->fresh()->tem_promocao);
    }

    public function test_regras_de_seguranca(): void
    {
        $socio = $this->usuario('socio');
        $hotel = $this->hotel($socio);
        $outro = $this->usuario('socio');
        $dados = ['alvo_tipo' => 'item_aluguel', 'alvo_id' => $hotel->id, 'percentual' => 50, 'quantidade' => 5];

        Sanctum::actingAs($outro);
        $this->postJson('/api/mobile/proprietario/flash-deals', $dados)->assertNotFound();

        Sanctum::actingAs($socio);
        $this->postJson('/api/mobile/proprietario/flash-deals', ['percentual' => 90] + $dados)->assertStatus(422);
        $this->postJson('/api/mobile/proprietario/flash-deals', ['duracao_minutos' => 600] + $dados)->assertStatus(422);
        $this->postJson('/api/mobile/proprietario/flash-deals', $dados)->assertCreated();
        $this->postJson('/api/mobile/proprietario/flash-deals', $dados)->assertStatus(422)->assertJsonValidationErrors('alvo_id');

        $deal = FlashDeal::where('alvo_id', $hotel->id)->first();
        Sanctum::actingAs($outro);
        $this->postJson("/api/mobile/proprietario/flash-deals/{$deal->id}/cancelar")->assertForbidden();
    }

    public function test_cliente_ve_deals_perto_e_nao_os_longe(): void
    {
        $socio = $this->usuario('socio');
        $hotel = $this->hotel($socio);
        app(FlashDealService::class)->criar($socio, ['alvo_tipo' => 'item_aluguel', 'alvo_id' => $hotel->id, 'percentual' => 50, 'quantidade' => 5]);

        Sanctum::actingAs($this->usuario());
        $perto = $this->getJson('/api/mobile/flash-deals/perto?latitude=' . (self::LAT + 0.01) . '&longitude=' . self::LNG)->assertOk()->json('deals');
        $deal = collect($perto)->firstWhere('alvo_id', $hotel->id);
        $this->assertNotNull($deal);
        $this->assertEquals(150, $deal['valor_com_desconto']);
        $this->assertSame(5, $deal['restantes']);

        $longe = $this->getJson('/api/mobile/flash-deals/perto?latitude=-23.55&longitude=-46.63')->assertOk()->json('deals');
        $this->assertNull(collect($longe)->firstWhere('alvo_id', $hotel->id));
    }

    public function test_cliente_recebe_no_maximo_3_deals_por_dia(): void
    {
        $cliente = $this->clienteNaCidade();
        $service = app(FlashDealService::class);

        foreach (range(1, 4) as $i) {
            $socio = $this->usuario('socio');
            $service->criar($socio, ['alvo_tipo' => 'item_aluguel', 'alvo_id' => $this->hotel($socio)->id, 'percentual' => 50, 'quantidade' => 1]);
        }

        $this->assertSame(3, FlashDealAviso::where('usuario_id', $cliente->id)->count());
    }

    public function test_gerente_faz_flash_deal_de_servico_e_agendamento_consome_vaga(): void
    {
        $gerente = $this->usuario('gerente');
        $local = Estabelecimento::create(['nome' => 'Restaurante Rio', 'cidade' => $this->cidade, 'estado' => 'MS', 'latitude' => self::LAT, 'longitude' => self::LNG]);
        $local->proprietarios()->attach($gerente->id, ['tipo' => 'gerente']);
        $mesa = Servico::create(['estabelecimento_id' => $local->id, 'nome' => 'Mesa para 2', 'tipo_servico' => 'Outro', 'valor' => 100, 'duracao_minutos' => 90, 'ativo' => true]);

        $this->actingAs($gerente)->get('/gestao/flash-deals')->assertOk()
            ->assertInertia(fn ($p) => $p->component('Gestao/FlashDeals')->where('opcoes.servicos.0.id', $mesa->id));

        $deal = app(FlashDealService::class)->criar($gerente, ['alvo_tipo' => 'servico', 'alvo_id' => $mesa->id, 'percentual' => 25, 'quantidade' => 4]);
        $this->assertEquals(25, $mesa->fresh()->valor_desconto);

        Agendamento::create([
            'usuario_id' => $this->usuario()->id, 'estabelecimento_id' => $local->id, 'servico_id' => $mesa->id,
            'data_agendamento' => now()->toDateString(), 'hora_agendamento' => '20:00', 'status' => 'pendente', 'valor_final' => 75,
        ]);
        $this->assertSame(1, $deal->fresh()->usados);
    }
}
