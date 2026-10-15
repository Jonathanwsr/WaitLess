<?php

namespace Tests\Feature;

use App\Models\Agendamento;
use App\Models\Aluguel;
use App\Models\Estabelecimento;
use App\Models\Estorno;
use App\Models\ItemAluguel;
use App\Models\Pagamento;
use App\Models\Servico;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class CancelamentoComEstornoTest extends TestCase
{
    use DatabaseTransactions;

    private function fakeAsaasRefundOk(): void
    {
        Http::fake([
            '*/payments/*/refund' => Http::response(['id' => 'ref_' . uniqid(), 'status' => 'REFUNDED'], 200),
        ]);
    }

    private function criarCenarioServico(): array
    {
        $socio = User::create(['name' => 'Socio Cancel', 'email' => 'canc1' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'socio']);
        $estabelecimento = Estabelecimento::create(['nome' => 'Salao Cancel ' . uniqid()]);
        $estabelecimento->proprietarios()->attach($socio->id, ['tipo' => 'socio']);
        $servico = Servico::create(['estabelecimento_id' => $estabelecimento->id, 'nome' => 'Corte', 'tipo_servico' => 'Outro', 'valor' => 100, 'duracao_minutos' => 30, 'ativo' => true]);
        $cliente = User::create(['name' => 'Cliente Cancel', 'email' => 'canc2' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'user']);

        return compact('socio', 'estabelecimento', 'servico', 'cliente');
    }

    public function test_cancelamento_dentro_do_prazo_gratuito_estorna_100_porcento_e_fica_visivel_para_admin(): void
    {
        $this->fakeAsaasRefundOk();
        ['estabelecimento' => $estabelecimento, 'servico' => $servico, 'cliente' => $cliente] = $this->criarCenarioServico();

        $agendamento = Agendamento::create([
            'usuario_id' => $cliente->id, 'estabelecimento_id' => $estabelecimento->id, 'servico_id' => $servico->id,
            'data_agendamento' => now()->addDays(2)->toDateString(), 'hora_agendamento' => '15:00',
            'status' => 'confirmado', 'status_pagamento' => 'pago_online', 'valor_final' => 100,
        ]);
        $pagamento = Pagamento::create([
            'usuario_id' => $cliente->id, 'estabelecimento_id' => $estabelecimento->id, 'agendamento_id' => $agendamento->id,
            'valor' => 100, 'valor_total' => 100, 'valor_liquido' => 94, 'metodo_pagamento' => 'pix',
            'status' => 'pago', 'id_transacao_gateway' => 'pay_' . uniqid(),
        ]);

        $response = $this->actingAs($cliente)->post("/agendamento/{$agendamento->id}/cancelar");

        $response->assertRedirect();
        $this->assertSame('cancelado', $agendamento->fresh()->status);
        $this->assertSame('estornado', $pagamento->fresh()->status);

        $estorno = Estorno::where('pagamento_id', $pagamento->id)->first();
        $this->assertNotNull($estorno, 'O cancelamento deveria ter criado um registro em estornos.');
        $this->assertSame('ESTORNADO', $estorno->status);
        $this->assertSame('TOTAL', $estorno->tipo_estorno);
        $this->assertSame(100.0, (float) $estorno->valor_estornado);

        // Visível pro admin na mesma tela que já lista disputas de estorno.
        $admin = User::create(['name' => 'Admin', 'email' => 'canc3' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'admin']);
        $respAdmin = $this->actingAs($admin)->getJson('/api/admin/estornos');
        $respAdmin->assertOk();
        $ids = collect($respAdmin->json('data.data'))->pluck('id');
        $this->assertTrue($ids->contains($estorno->id), 'O estorno automático de cancelamento deveria aparecer na listagem do admin.');
    }

    public function test_cancelamento_tardio_retem_taxa_e_estorna_o_restante(): void
    {
        $this->fakeAsaasRefundOk();
        ['estabelecimento' => $estabelecimento, 'servico' => $servico, 'cliente' => $cliente] = $this->criarCenarioServico();

        $agendamento = Agendamento::create([
            'usuario_id' => $cliente->id, 'estabelecimento_id' => $estabelecimento->id, 'servico_id' => $servico->id,
            'data_agendamento' => now()->toDateString(), 'hora_agendamento' => now()->addMinutes(10)->format('H:i:s'),
            'status' => 'confirmado', 'status_pagamento' => 'pago_online', 'valor_final' => 100,
        ]);
        $pagamento = Pagamento::create([
            'usuario_id' => $cliente->id, 'estabelecimento_id' => $estabelecimento->id, 'agendamento_id' => $agendamento->id,
            'valor' => 100, 'valor_total' => 100, 'valor_liquido' => 94, 'metodo_pagamento' => 'pix',
            'status' => 'pago', 'id_transacao_gateway' => 'pay_' . uniqid(),
        ]);

        $response = $this->actingAs($cliente)->post("/agendamento/{$agendamento->id}/cancelar");
        $response->assertRedirect();

        $estorno = Estorno::where('pagamento_id', $pagamento->id)->first();
        $this->assertNotNull($estorno);
        $this->assertSame('PARCIAL', $estorno->tipo_estorno);
        $this->assertSame(98.0, (float) $estorno->valor_estornado, 'Deveria reter 2% e estornar os 98% restantes.');
    }

    public function test_cancelamento_de_locacao_processa_estorno_real_no_endpoint_ao_vivo(): void
    {
        // Regressão do bug crítico: AgendamentoController::destroyAluguel
        // (o endpoint que web E mobile realmente chamam pra cancelar uma
        // locação) só marcava status=cancelado e NUNCA devolvia o dinheiro.
        $this->fakeAsaasRefundOk();
        $socio = User::create(['name' => 'Socio Loc', 'email' => 'canc4' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'socio']);
        $estabelecimento = Estabelecimento::create(['nome' => 'Locadora Cancel ' . uniqid()]);
        $estabelecimento->proprietarios()->attach($socio->id, ['tipo' => 'socio']);
        $item = ItemAluguel::create(['estabelecimento_id' => $socio->id, 'nome' => 'Van', 'categoria' => 'carro', 'valor_diaria' => 200, 'ativo' => true]);
        $locatario = User::create(['name' => 'Locatario Cancel', 'email' => 'canc5' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'user']);

        $aluguel = Aluguel::create([
            'codigo_reserva' => 'RES-' . uniqid(), 'estabelecimento_id' => $socio->id, 'item_aluguel_id' => $item->id,
            'proprietario_id' => $socio->id, 'locatario_id' => $locatario->id,
            'tipo_periodo' => 'diaria', 'quantidade_periodos' => 1,
            // 6 dias: com folga acima do prazo de reembolso total da política padrão (moderada, 5 dias).
            'data_inicio' => now()->addDays(6)->toDateString(), 'data_fim' => now()->addDays(7)->toDateString(),
            'valor_unitario' => 200, 'valor_total' => 200, 'forma_pagamento' => 'online', 'status' => 'confirmado',
        ]);
        $pagamento = Pagamento::create([
            'usuario_id' => $locatario->id, 'estabelecimento_id' => $estabelecimento->id, 'aluguel_id' => $aluguel->id,
            'valor' => 200, 'valor_total' => 200, 'valor_liquido' => 188, 'metodo_pagamento' => 'pix',
            'status' => 'pago', 'id_transacao_gateway' => 'pay_' . uniqid(),
        ]);

        $response = $this->actingAs($locatario)->deleteJson("/minhas-reservas/cancelar/{$aluguel->id}");

        $response->assertOk();
        $response->assertJsonPath('estornado', true);
        $this->assertSame('cancelado', $aluguel->fresh()->status);
        $this->assertSame('estornado', $pagamento->fresh()->status);

        $estorno = Estorno::where('pagamento_id', $pagamento->id)->first();
        $this->assertNotNull($estorno, 'Cancelar a locação deveria ter gerado um estorno de verdade, não só mudado o status.');
        $this->assertSame('ALUGUEL', $estorno->categoria);
        $this->assertSame(200.0, (float) $estorno->valor_estornado, 'Cancelado com 6 dias de antecedência (política moderada): deveria estornar 100%.');
    }

    public function test_endpoint_mobile_de_cancelar_locacao_funciona(): void
    {
        // Regressão: a rota mobile (api/mobile/alugueis/{id}/cancelar, chamada
        // por mobile/app/agendamentos/detalhes.tsx) apontava pra um método que
        // nunca existiu em MobileAgendamentoController — todo cancelamento de
        // locação pelo app quebrava com "Call to undefined method".
        $this->fakeAsaasRefundOk();
        $socio = User::create(['name' => 'Socio Loc Mob', 'email' => 'canc9' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'socio']);
        $estabelecimento = Estabelecimento::create(['nome' => 'Locadora Mobile ' . uniqid()]);
        $estabelecimento->proprietarios()->attach($socio->id, ['tipo' => 'socio']);
        $item = ItemAluguel::create(['estabelecimento_id' => $socio->id, 'nome' => 'Moto', 'categoria' => 'moto', 'valor_diaria' => 80, 'ativo' => true]);
        $locatario = User::create(['name' => 'Locatario Mobile', 'email' => 'canc10' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'user']);

        $aluguel = Aluguel::create([
            'codigo_reserva' => 'RES-' . uniqid(), 'estabelecimento_id' => $socio->id, 'item_aluguel_id' => $item->id,
            'proprietario_id' => $socio->id, 'locatario_id' => $locatario->id,
            'tipo_periodo' => 'diaria', 'quantidade_periodos' => 1,
            'data_inicio' => now()->addDays(5)->toDateString(), 'data_fim' => now()->addDays(6)->toDateString(),
            'valor_unitario' => 80, 'valor_total' => 80, 'forma_pagamento' => 'presencial', 'status' => 'confirmado',
        ]);

        $response = $this->actingAs($locatario)->deleteJson("/api/mobile/alugueis/{$aluguel->id}/cancelar");

        $response->assertOk();
        $this->assertSame('cancelado', $aluguel->fresh()->status);
    }

    public function test_nao_processa_o_mesmo_estorno_duas_vezes(): void
    {
        // Blindagem: antes, aprovar o mesmo estorno duas vezes em sequência
        // dependia só de uma checagem feita ANTES da transação — uma corrida
        // (dois cliques, ou uma tentativa automática junto com o admin
        // aprovando na mesma hora) podia acionar o Asaas duas vezes.
        $this->fakeAsaasRefundOk();
        ['estabelecimento' => $estabelecimento, 'servico' => $servico, 'cliente' => $cliente] = $this->criarCenarioServico();

        $agendamento = Agendamento::create([
            'usuario_id' => $cliente->id, 'estabelecimento_id' => $estabelecimento->id, 'servico_id' => $servico->id,
            'data_agendamento' => now()->addDays(2)->toDateString(), 'hora_agendamento' => '15:00',
            'status' => 'confirmado', 'status_pagamento' => 'pago_online', 'valor_final' => 100,
        ]);
        $pagamento = Pagamento::create([
            'usuario_id' => $cliente->id, 'estabelecimento_id' => $estabelecimento->id, 'agendamento_id' => $agendamento->id,
            'valor' => 100, 'valor_total' => 100, 'valor_liquido' => 94, 'metodo_pagamento' => 'pix',
            'status' => 'pago', 'id_transacao_gateway' => 'pay_' . uniqid(),
        ]);

        app(\App\Services\PagamentoService::class)->processarCancelamentoAgendamento($agendamento);
        $estorno = Estorno::where('pagamento_id', $pagamento->id)->firstOrFail();

        $this->expectException(\Exception::class);
        app(\App\Services\EstornoService::class)->aprovarEstorno($estorno, $cliente);
    }

    public function test_locatario_nao_consegue_cancelar_locacao_de_outra_pessoa(): void
    {
        $socio = User::create(['name' => 'Socio Loc2', 'email' => 'canc6' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'socio']);
        $estabelecimento = Estabelecimento::create(['nome' => 'Locadora Cancel2 ' . uniqid()]);
        $item = ItemAluguel::create(['estabelecimento_id' => $socio->id, 'nome' => 'Van', 'categoria' => 'carro', 'valor_diaria' => 200, 'ativo' => true]);
        $locatario = User::create(['name' => 'Dono da Reserva', 'email' => 'canc7' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'user']);
        $estranho = User::create(['name' => 'Estranho', 'email' => 'canc8' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'user']);

        $aluguel = Aluguel::create([
            'codigo_reserva' => 'RES-' . uniqid(), 'estabelecimento_id' => $socio->id, 'item_aluguel_id' => $item->id,
            'proprietario_id' => $socio->id, 'locatario_id' => $locatario->id,
            'tipo_periodo' => 'diaria', 'quantidade_periodos' => 1,
            'data_inicio' => now()->addDays(5)->toDateString(), 'data_fim' => now()->addDays(6)->toDateString(),
            'valor_unitario' => 200, 'valor_total' => 200, 'forma_pagamento' => 'presencial', 'status' => 'confirmado',
        ]);

        $response = $this->actingAs($estranho)->deleteJson("/minhas-reservas/cancelar/{$aluguel->id}");

        $response->assertStatus(403);
        $this->assertSame('confirmado', $aluguel->fresh()->status);
    }
}
