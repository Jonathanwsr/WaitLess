<?php

namespace Tests\Feature;

use App\Models\Aluguel;
use App\Models\ItemAluguel;
use App\Models\Pagamento;
use App\Models\User;
use App\Services\Locacao\PoliticaCancelamentoService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PoliticaCancelamentoReservaTest extends TestCase
{
    use DatabaseTransactions;

    private function usuario(string $papel, string $nome): User
    {
        return User::create([
            'name' => $nome, 'email' => strtolower($nome) . uniqid() . '@x.com',
            'password' => Hash::make('senha-teste-123'), 'papel' => $papel, 'plano_assinatura' => 'gratuito',
        ]);
    }

    private function item(User $dono, string $politica): ItemAluguel
    {
        return ItemAluguel::create([
            'estabelecimento_id' => $dono->id, 'nome' => 'Casa de praia', 'categoria' => 'casa',
            'periodo_faturamento_padrao' => 'diaria', 'valor_diaria' => 100, 'quantidade' => 1,
            'ativo' => true, 'disponivel' => true, 'sempre_disponivel' => true, 'politica_cancelamento' => $politica,
        ]);
    }

    /** Reserva paga online: valor total = diárias + caução. Início daqui a $diasAte dias, com $dias dias de duração. */
    private function reservaPaga(User $dono, User $cliente, ItemAluguel $item, int $diasAte, int $dias, float $valorDiarias, float $caucao = 0): Aluguel
    {
        $inicio = now('America/Sao_Paulo')->startOfDay()->addDays($diasAte);
        $aluguel = Aluguel::create([
            'codigo_reserva' => 'RES-' . strtoupper(uniqid()), 'estabelecimento_id' => $dono->id, 'item_aluguel_id' => $item->id,
            'proprietario_id' => $dono->id, 'locatario_id' => $cliente->id, 'tipo_periodo' => 'diaria',
            'quantidade_periodos' => $dias, 'data_inicio' => $inicio->toDateString(), 'data_fim' => $inicio->copy()->addDays($dias)->toDateString(),
            'valor_unitario' => $valorDiarias / $dias, 'valor_total' => $valorDiarias + $caucao, 'valor_caucao' => $caucao,
            'forma_pagamento' => 'online', 'status' => 'confirmado', 'quantidade' => 1,
        ]);
        $pagamento = Pagamento::create([
            'usuario_id' => $cliente->id, 'aluguel_id' => $aluguel->id, 'gateway_pagamento' => 'Asaas',
            'id_transacao_gateway' => 'pay_' . uniqid(), 'valor' => $valorDiarias + $caucao, 'taxa' => 0,
            'valor_liquido' => $valorDiarias + $caucao, 'status' => 'pago', 'metodo_pagamento' => 'pix',
        ]);
        $aluguel->update(['pagamento_id' => $pagamento->id]);

        return $aluguel->fresh('item');
    }

    private function calcular(Aluguel $aluguel, bool $peloDono = false): array
    {
        return app(PoliticaCancelamentoService::class)->calcular($aluguel, (float) $aluguel->valor_total, $peloDono);
    }

    private function cenario(string $politica, int $diasAte, int $dias = 2, float $valor = 200, float $caucao = 0): Aluguel
    {
        $dono = $this->usuario('socio', 'Dono');

        return $this->reservaPaga($dono, $this->usuario('user', 'Cliente'), $this->item($dono, $politica), $diasAte, $dias, $valor, $caucao);
    }

    // -------------------------------------------------------------- regras

    public function test_moderada_reembolso_total_com_5_dias_e_metade_depois(): void
    {
        $this->assertSame(200.0, $this->calcular($this->cenario('moderada', 6))['valor_reembolso']);
        $this->assertSame(100.0, $this->calcular($this->cenario('moderada', 3))['valor_reembolso']);
    }

    public function test_firme_por_faixas_e_caucao_sempre_volta(): void
    {
        $this->assertSame(500.0, $this->calcular($this->cenario('firme', 40, 2, 400, 100))['valor_reembolso']);
        // 10 dias: 50% de 400 + caução 100
        $this->assertSame(300.0, $this->calcular($this->cenario('firme', 10, 2, 400, 100))['valor_reembolso']);
        // 3 dias: sem reembolso das diárias, só a caução
        $tarde = $this->calcular($this->cenario('firme', 3, 2, 400, 100));
        $this->assertSame(100.0, $tarde['valor_reembolso']);
        $this->assertSame(400.0, $tarde['valor_retido']);
    }

    public function test_flexivel_perde_so_o_primeiro_dia_quando_cancela_em_cima_da_hora(): void
    {
        $this->assertSame(300.0, $this->calcular($this->cenario('flexivel', 2, 3, 300))['valor_reembolso']);
        // começa hoje (menos de 24h): perde 1 dos 3 dias
        $this->assertSame(200.0, $this->calcular($this->cenario('flexivel', 0, 3, 300))['valor_reembolso']);
    }

    public function test_rigorosa_total_em_48h_se_faltar_14_dias(): void
    {
        $aluguel = $this->cenario('rigorosa', 20);
        $this->assertSame(200.0, $this->calcular($aluguel)['valor_reembolso']);

        $aluguel->forceFill(['created_at' => now()->subDays(3)])->save();
        $this->assertSame(100.0, $this->calcular($aluguel->fresh('item'))['valor_reembolso']);
    }

    public function test_reserva_longa_usa_politica_de_longa_duracao(): void
    {
        // 60 dias por R$ 6.000 (R$ 100/dia) em item "flexível": vale a de longa duração.
        $longaCedo = $this->calcular($this->cenario('flexivel', 40, 60, 6000));
        $this->assertSame('longa_duracao', $longaCedo['politica']);
        $this->assertSame(6000.0, $longaCedo['valor_reembolso']);

        // A menos de 30 dias: os primeiros 30 dias (R$ 3.000) ficam retidos.
        $longaTarde = $this->calcular($this->cenario('flexivel', 10, 60, 6000));
        $this->assertSame(3000.0, $longaTarde['valor_reembolso']);
    }

    public function test_dono_cancelando_sempre_devolve_tudo(): void
    {
        $resultado = $this->calcular($this->cenario('firme', 1, 2, 400, 100), true);

        $this->assertSame(500.0, $resultado['valor_reembolso']);
        $this->assertSame(100, $resultado['percentual']);
    }

    // -------------------------------------------------------------- fluxos

    public function test_cliente_cancela_e_recebe_pela_politica_sem_pedir_estorno(): void
    {
        Http::fake(['*' => Http::response(['ok' => true], 200)]);
        $aluguel = $this->cenario('moderada', 3, 2, 200);

        $resposta = $this->actingAs(User::find($aluguel->locatario_id))->deleteJson("/minhas-reservas/cancelar/{$aluguel->id}");

        $resposta->assertOk();
        $aluguel->refresh();
        $this->assertSame('cancelado', $aluguel->status);
        $this->assertEquals(100, (float) $aluguel->valor_reembolsado);
        $this->assertSame('moderada', $aluguel->politica_aplicada);
        Http::assertSent(fn ($r) => str_contains($r->url(), '/refund') && (float) ($r->data()['value'] ?? 0) === 100.0);
        // O que ficou retido é liberado para o dono.
        Http::assertSent(fn ($r) => str_contains($r->url(), '/releaseEscrow'));
    }

    public function test_dono_cancela_pela_web_e_cliente_recebe_tudo_e_os_pontos(): void
    {
        Http::fake(['*' => Http::response(['ok' => true], 200)]);
        $aluguel = $this->cenario('firme', 2, 2, 400, 50);
        $aluguel->update(['pontos_utilizados' => 5000]);
        $cliente = User::find($aluguel->locatario_id);
        $saldoAntes = (int) $cliente->pontos_saldo;

        $this->actingAs(User::find($aluguel->proprietario_id))
            ->post("/minhas-locacoes/reservas/{$aluguel->id}/cancelar")
            ->assertSessionHas('success');

        $aluguel->refresh();
        $this->assertSame('cancelado', $aluguel->status);
        $this->assertEquals(450, (float) $aluguel->valor_reembolsado);
        $this->assertSame((int) $aluguel->proprietario_id, (int) $aluguel->cancelado_por_usuario_id);
        $this->assertSame($saldoAntes + 5000, (int) $cliente->fresh()->pontos_saldo);
        Http::assertSent(fn ($r) => str_contains($r->url(), '/refund') && (float) ($r->data()['value'] ?? 0) === 450.0);
    }

    public function test_dono_cancela_pelo_app_e_registro_nao_e_apagado(): void
    {
        Http::fake(['*' => Http::response(['ok' => true], 200)]);
        $aluguel = $this->cenario('moderada', 10);
        Sanctum::actingAs(User::find($aluguel->proprietario_id));

        $this->postJson("/api/mobile/proprietario/locacoes-avulsas/reservas/{$aluguel->id}/cancelar")
            ->assertOk()->assertJsonPath('reembolso.percentual', 100);

        $this->assertNotNull(Aluguel::find($aluguel->id));
        $this->assertSame('cancelado', Aluguel::find($aluguel->id)->status);
    }

    public function test_quem_nao_e_dono_nao_cancela_nem_ve(): void
    {
        $aluguel = $this->cenario('moderada', 10);
        $estranho = $this->usuario('socio', 'Estranho');

        $this->actingAs($estranho)->post("/minhas-locacoes/reservas/{$aluguel->id}/cancelar")->assertForbidden();

        Sanctum::actingAs($estranho);
        $this->postJson("/api/mobile/proprietario/locacoes-avulsas/reservas/{$aluguel->id}/cancelar")->assertForbidden();
        $this->deleteJson("/api/v1/mobile/alugueis/{$aluguel->id}")->assertForbidden();
        $this->getJson("/api/v1/mobile/alugueis/{$aluguel->id}")->assertForbidden();
        $this->assertSame('confirmado', $aluguel->fresh()->status);
    }

    public function test_detalhe_da_reserva_mostra_quanto_volta_se_cancelar_agora(): void
    {
        $aluguel = $this->cenario('moderada', 3, 2, 200);

        $dados = $this->actingAs(User::find($aluguel->locatario_id))
            ->get("/meus-pedidos/aluguel/{$aluguel->id}")
            ->assertOk()
            ->viewData('page')['props']['dados'];

        $this->assertSame('Moderada', $dados['cancelamento']['nome']);
        $this->assertSame(100.0, $dados['cancelamento']['se_cancelar_agora']['valor_reembolso']);
    }
}
