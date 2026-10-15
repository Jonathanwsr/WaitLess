<?php

namespace Tests\Feature;

use App\Models\Agendamento;
use App\Models\Aluguel;
use App\Models\Estabelecimento;
use App\Models\ItemAluguel;
use App\Models\OfertaViagem;
use App\Models\Servico;
use App\Models\User;
use App\Services\Viagem\CrossSellViagemService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CrossSellViagemTest extends TestCase
{
    use DatabaseTransactions;

    private string $cidade;

    protected function setUp(): void
    {
        parent::setUp();
        Http::fake();
        // Cidade única por teste para não cruzar com dados de outros testes/seed.
        $this->cidade = 'Gramado' . uniqid();
    }

    private function usuario(string $papel = 'user'): User
    {
        return User::create([
            'name' => 'U' . uniqid(), 'email' => uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'),
            'papel' => $papel, 'plano_assinatura' => 'gratuito', 'expo_push_token' => 'ExponentPushToken[teste]',
        ]);
    }

    private function item(User $dono, string $categoria, array $extra = []): ItemAluguel
    {
        return ItemAluguel::create($extra + [
            'estabelecimento_id' => $dono->id, 'nome' => ucfirst($categoria) . ' ' . uniqid(), 'categoria' => $categoria,
            'periodo_faturamento_padrao' => 'diaria', 'valor_diaria' => 200, 'quantidade' => 1, 'ativo' => true,
            'disponivel' => true, 'sempre_disponivel' => true, 'cidade' => $this->cidade, 'estado' => 'RS',
            'latitude' => -29.3746, 'longitude' => -50.8764,
        ]);
    }

    private function reservar(User $cliente, ItemAluguel $item, string $inicio, string $fim): Aluguel
    {
        return Aluguel::create([
            'codigo_reserva' => 'RES-' . uniqid(), 'estabelecimento_id' => $item->estabelecimento_id, 'item_aluguel_id' => $item->id,
            'proprietario_id' => $item->estabelecimento_id, 'locatario_id' => $cliente->id, 'tipo_periodo' => 'diaria',
            'quantidade_periodos' => 1, 'data_inicio' => $inicio, 'data_fim' => $fim, 'valor_unitario' => 200,
            'valor_total' => 200, 'forma_pagamento' => 'online', 'status' => 'confirmado',
        ]);
    }

    private function crossSell(): CrossSellViagemService
    {
        return app(CrossSellViagemService::class);
    }

    public function test_reservar_hospedagem_agenda_veiculo_2_dias_antes_e_gatilho_de_chegada(): void
    {
        $hotel = $this->item($this->usuario('socio'), 'hotel');
        $inicio = now('America/Sao_Paulo')->addDays(10)->toDateString();
        $aluguel = $this->reservar($this->usuario(), $hotel, $inicio, now()->addDays(12)->toDateString());

        $veiculo = OfertaViagem::where('aluguel_id', $aluguel->id)->where('tipo', 'veiculo_pre_checkin')->firstOrFail();
        $this->assertSame('agendada', $veiculo->status);
        $this->assertSame(
            Carbon::parse($inicio . ' 10:00', 'America/Sao_Paulo')->subDays(2)->utc()->format('Y-m-d H:i'),
            $veiculo->disparar_em->utc()->format('Y-m-d H:i')
        );
        $this->assertSame($this->cidade, $veiculo->cidade);
        $this->assertSame('aguardando_chegada', OfertaViagem::where('aluguel_id', $aluguel->id)->where('tipo', 'chegada')->value('status'));
    }

    public function test_reserva_que_nao_e_hospedagem_nao_agenda_nada(): void
    {
        $quadra = $this->item($this->usuario('socio'), 'quadra');
        $aluguel = $this->reservar($this->usuario(), $quadra, now()->addDays(5)->toDateString(), now()->addDays(5)->toDateString());

        $this->assertSame(0, OfertaViagem::where('aluguel_id', $aluguel->id)->count());
    }

    public function test_disparo_oferece_o_melhor_veiculo_da_cidade_e_manda_push(): void
    {
        $hotel = $this->item($this->usuario('socio'), 'hotel');
        $this->item($this->usuario('socio'), 'carro', ['avaliacao_media' => 3.5, 'nome' => 'Carro Fraco']);
        $melhor = $this->item($this->usuario('socio'), 'carro', ['avaliacao_media' => 4.9, 'nome' => 'Carro Top']);
        $cliente = $this->usuario();
        // Check-in amanhã: o horário "2 dias antes" já passou, então a oferta vale para agora.
        $aluguel = $this->reservar($cliente, $hotel, now()->addDay()->toDateString(), now()->addDays(3)->toDateString());

        $this->crossSell()->dispararVencidas();

        $oferta = OfertaViagem::where('aluguel_id', $aluguel->id)->where('tipo', 'veiculo_pre_checkin')->first();
        $this->assertSame('enviada', $oferta->status);
        $this->assertSame('item_aluguel', $oferta->alvo_tipo);
        $this->assertSame($melhor->id, $oferta->alvo_id);
        Http::assertSent(fn ($r) => str_contains($r->url(), 'exp.host') && str_contains($r['body'], 'Carro Top'));
    }

    public function test_sem_veiculo_na_cidade_fica_sem_oferta(): void
    {
        $hotel = $this->item($this->usuario('socio'), 'hotel');
        $aluguel = $this->reservar($this->usuario(), $hotel, now()->addDay()->toDateString(), now()->addDays(2)->toDateString());

        $this->crossSell()->dispararVencidas();

        $this->assertSame('sem_oferta', OfertaViagem::where('aluguel_id', $aluguel->id)->where('tipo', 'veiculo_pre_checkin')->value('status'));
    }

    public function test_cancelar_a_reserva_cancela_as_ofertas(): void
    {
        $hotel = $this->item($this->usuario('socio'), 'hotel');
        $aluguel = $this->reservar($this->usuario(), $hotel, now()->addDays(8)->toDateString(), now()->addDays(9)->toDateString());

        $aluguel->update(['status' => 'cancelado']);

        $this->assertSame(['cancelada'], OfertaViagem::where('aluguel_id', $aluguel->id)->pluck('status')->unique()->values()->all());
    }

    public function test_chegada_na_cidade_oferece_restaurante_e_spa_uma_vez(): void
    {
        $hotel = $this->item($this->usuario('socio'), 'hotel');
        $restaurante = Estabelecimento::create(['nome' => 'Cantina', 'ramo_atuacao' => 'Restaurante', 'cidade' => $this->cidade, 'estado' => 'RS', 'ativo' => true, 'avaliacao_media' => 4.8]);
        $spa = Estabelecimento::create(['nome' => 'Spa Serra', 'ramo_atuacao' => 'Spa', 'cidade' => $this->cidade, 'estado' => 'RS', 'ativo' => true]);
        $massagem = Servico::create(['estabelecimento_id' => $spa->id, 'nome' => 'Massagem relaxante', 'tipo_servico' => 'Outro', 'valor' => 180, 'duracao_minutos' => 60, 'ativo' => true]);
        $cliente = $this->usuario();
        $this->reservar($cliente, $hotel, now('America/Sao_Paulo')->toDateString(), now()->addDays(2)->toDateString());

        Sanctum::actingAs($cliente);
        // Longe do hotel (São Paulo): nada acontece.
        $this->postJson('/api/mobile/viagem/chegada', ['latitude' => -23.55, 'longitude' => -46.63])->assertOk()->assertJsonPath('novas', 0);

        $resposta = $this->postJson('/api/mobile/viagem/chegada', ['latitude' => -29.37, 'longitude' => -50.87])->assertOk();
        $this->assertSame(2, $resposta->json('novas'));
        $alvos = collect($resposta->json('ofertas'))->pluck('alvo_id', 'tipo');
        $this->assertSame($restaurante->id, $alvos['chegada_restaurante']);
        $this->assertSame($massagem->id, $alvos['chegada_spa']);

        // Uma segunda leitura de localização não repete as ofertas.
        $this->postJson('/api/mobile/viagem/chegada', ['latitude' => -29.37, 'longitude' => -50.87])->assertOk()->assertJsonPath('novas', 0);
    }

    public function test_clique_e_conversao_sao_medidos(): void
    {
        $hotel = $this->item($this->usuario('socio'), 'hotel');
        $carro = $this->item($this->usuario('socio'), 'carro');
        $cliente = $this->usuario();
        $aluguel = $this->reservar($cliente, $hotel, now()->addDay()->toDateString(), now()->addDays(3)->toDateString());
        $this->crossSell()->dispararVencidas();
        $oferta = OfertaViagem::where('aluguel_id', $aluguel->id)->where('tipo', 'veiculo_pre_checkin')->first();

        Sanctum::actingAs($cliente);
        $this->postJson("/api/mobile/ofertas-viagem/{$oferta->id}/clique")->assertOk();
        $this->assertSame('clicada', $oferta->fresh()->status);

        // O cliente reserva o carro oferecido: a oferta vira conversão.
        $this->reservar($cliente, $carro, now()->addDay()->toDateString(), now()->addDays(3)->toDateString());
        $this->assertSame('convertida', $oferta->fresh()->status);

        $metricas = $this->crossSell()->metricas(now()->subHour());
        $this->assertGreaterThanOrEqual(1, $metricas['convertidas']);
    }

    public function test_conversao_por_agendamento_no_restaurante(): void
    {
        $cliente = $this->usuario();
        $restaurante = Estabelecimento::create(['nome' => 'Bistrô', 'cidade' => $this->cidade]);
        $servico = Servico::create(['estabelecimento_id' => $restaurante->id, 'nome' => 'Mesa', 'tipo_servico' => 'Outro', 'valor' => 0, 'duracao_minutos' => 60, 'ativo' => true]);
        $hotel = $this->item($this->usuario('socio'), 'hotel');
        $aluguel = $this->reservar($cliente, $hotel, now()->addDays(20)->toDateString(), now()->addDays(21)->toDateString());
        $oferta = OfertaViagem::create([
            'usuario_id' => $cliente->id, 'aluguel_id' => $aluguel->id, 'tipo' => 'chegada_restaurante', 'status' => 'enviada',
            'alvo_tipo' => 'estabelecimento', 'alvo_id' => $restaurante->id, 'enviada_em' => now(),
        ]);

        Agendamento::create([
            'usuario_id' => $cliente->id, 'estabelecimento_id' => $restaurante->id, 'servico_id' => $servico->id,
            'data_agendamento' => now()->toDateString(), 'hora_agendamento' => '20:00', 'status' => 'pendente', 'valor_final' => 0,
        ]);

        $this->assertSame('convertida', $oferta->fresh()->status);
    }

    public function test_cliente_nao_registra_clique_em_oferta_de_outro(): void
    {
        $hotel = $this->item($this->usuario('socio'), 'hotel');
        $aluguel = $this->reservar($this->usuario(), $hotel, now()->addDays(5)->toDateString(), now()->addDays(6)->toDateString());
        $oferta = OfertaViagem::where('aluguel_id', $aluguel->id)->first();

        Sanctum::actingAs($this->usuario());
        $this->postJson("/api/mobile/ofertas-viagem/{$oferta->id}/clique")->assertNotFound();
    }
}
