<?php

namespace Tests\Feature;

use App\Models\Agendamento;
use App\Models\Aluguel;
use App\Models\Estabelecimento;
use App\Models\ItemAluguel;
use App\Models\Servico;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class HistoricoAtendimentosTest extends TestCase
{
    use DatabaseTransactions;

    private function usuario(string $papel, string $nome): User
    {
        return User::create([
            'name' => $nome, 'email' => strtolower($nome) . uniqid() . '@x.com',
            'password' => Hash::make('senha-teste-123'), 'papel' => $papel, 'plano_assinatura' => 'gratuito',
        ]);
    }

    /** Sócio com um local, 3 serviços no dia (concluído, cancelado, confirmado), 1 em outro dia e 1 reserva no dia. */
    private function cenario(): array
    {
        $socio = $this->usuario('socio', 'Socio');
        $estab = Estabelecimento::create(['nome' => 'Studio ' . uniqid()]);
        $estab->proprietarios()->attach($socio->id, ['tipo' => 'socio']);
        $servico = Servico::create(['estabelecimento_id' => $estab->id, 'nome' => 'Corte', 'tipo_servico' => 'Outro', 'valor' => 50, 'duracao_minutos' => 30, 'ativo' => true]);
        $cliente = $this->usuario('user', 'Maria');
        $dia = '2026-10-05';

        foreach (['finalizado' => '09:00', 'cancelado' => '10:00', 'confirmado' => '11:00'] as $status => $hora) {
            Agendamento::create([
                'usuario_id' => $cliente->id, 'estabelecimento_id' => $estab->id, 'servico_id' => $servico->id,
                'data_agendamento' => $dia, 'hora_agendamento' => $hora, 'status' => $status,
                'status_pagamento' => 'presencial', 'valor_final' => 50,
            ]);
        }
        Agendamento::create([
            'usuario_id' => $cliente->id, 'estabelecimento_id' => $estab->id, 'servico_id' => $servico->id,
            'data_agendamento' => '2026-10-20', 'hora_agendamento' => '09:00', 'status' => 'finalizado',
            'status_pagamento' => 'presencial', 'valor_final' => 80,
        ]);

        $item = ItemAluguel::create([
            'estabelecimento_id' => $socio->id, 'nome' => 'Quadra', 'categoria' => 'quadra', 'periodo_faturamento_padrao' => 'diaria',
            'valor_diaria' => 120, 'quantidade' => 1, 'ativo' => true, 'disponivel' => true, 'sempre_disponivel' => true,
        ]);
        Aluguel::create([
            'codigo_reserva' => 'RES-HIST1', 'estabelecimento_id' => $socio->id, 'item_aluguel_id' => $item->id,
            'proprietario_id' => $socio->id, 'locatario_id' => $cliente->id, 'tipo_periodo' => 'diaria', 'quantidade_periodos' => 1,
            'data_inicio' => $dia, 'data_fim' => '2026-10-06', 'valor_unitario' => 120, 'valor_total' => 120,
            'forma_pagamento' => 'presencial', 'status' => 'cancelado', 'valor_reembolsado' => 0,
        ]);

        return [$socio, $estab];
    }

    public function test_resumo_do_dia_conta_servicos_e_reservas_por_situacao(): void
    {
        [$socio] = $this->cenario();

        $resumo = $this->actingAs($socio)->getJson('/gestao/historico-resumo?periodo=dia&data=2026-10-05')->assertOk()->json('resumo');

        $this->assertSame(3, $resumo['servicos_total']);
        $this->assertSame(1, $resumo['servicos_concluidos']);
        $this->assertSame(1, $resumo['servicos_cancelados']);
        $this->assertSame(1, $resumo['servicos_abertos']);
        $this->assertEquals(50, $resumo['servicos_faturado']);
        $this->assertSame(1, $resumo['reservas_total']);
        $this->assertSame(1, $resumo['reservas_canceladas']);
    }

    public function test_resumo_do_mes_inclui_o_mes_inteiro(): void
    {
        [$socio] = $this->cenario();

        $resumo = $this->actingAs($socio)->getJson('/gestao/historico-resumo?periodo=mes&mes=2026-10')->assertOk()->json('resumo');

        $this->assertSame(4, $resumo['servicos_total']);
        $this->assertEquals(130, $resumo['servicos_faturado']);
    }

    public function test_pdf_e_baixado_na_web_e_no_app(): void
    {
        [$socio] = $this->cenario();

        $web = $this->actingAs($socio)->get('/gestao/historico-pdf?periodo=dia&data=2026-10-05');
        $web->assertOk();
        $this->assertSame('application/pdf', $web->headers->get('content-type'));
        $this->assertStringContainsString('Historico_2026-10-05.pdf', (string) $web->headers->get('content-disposition'));

        Sanctum::actingAs($socio);
        $app = $this->get('/api/mobile/gestao/historico-pdf?periodo=mes&mes=2026-10');
        $app->assertOk();
        $this->assertSame('application/pdf', $app->headers->get('content-type'));
    }

    public function test_so_socio_ou_gerente_do_local_acessa(): void
    {
        [, $estab] = $this->cenario();
        $cliente = $this->usuario('user', 'Cliente');
        [$outroSocio] = [$this->usuario('socio', 'Outro')];
        Estabelecimento::create(['nome' => 'Outro ' . uniqid()])->proprietarios()->attach($outroSocio->id, ['tipo' => 'socio']);

        $this->actingAs($cliente)->getJson('/gestao/historico-resumo?periodo=dia&data=2026-10-05')->assertForbidden();
        $this->actingAs($outroSocio)->getJson("/gestao/historico-resumo?periodo=dia&data=2026-10-05&estabelecimento_id={$estab->id}")->assertForbidden();
    }

    public function test_periodo_invalido_e_recusado(): void
    {
        [$socio] = $this->cenario();

        $this->actingAs($socio)->getJson('/gestao/historico-resumo?periodo=semana')->assertStatus(422);
        $this->actingAs($socio)->getJson('/gestao/historico-resumo?periodo=mes')->assertStatus(422);
    }

    public function test_muitos_registros_viram_varias_paginas(): void
    {
        [$socio, $estab] = $this->cenario();
        $servico = Servico::where('estabelecimento_id', $estab->id)->first();
        $cliente = $this->usuario('user', 'Joao');
        for ($i = 0; $i < 150; $i++) {
            Agendamento::create([
                'usuario_id' => $cliente->id, 'estabelecimento_id' => $estab->id, 'servico_id' => $servico->id,
                'data_agendamento' => '2026-10-' . str_pad((string) (($i % 28) + 1), 2, '0', STR_PAD_LEFT),
                'hora_agendamento' => '08:00', 'status' => $i % 3 ? 'finalizado' : 'cancelado',
                'status_pagamento' => 'presencial', 'valor_final' => 40,
            ]);
        }

        $pdf = $this->actingAs($socio)->get('/gestao/historico-pdf?periodo=mes&mes=2026-10')->assertOk()->getContent();
        $paginas = preg_match_all('#/Type\s*/Page[^s]#', $pdf);

        $this->assertGreaterThanOrEqual(4, $paginas, 'Com 150+ registros o histórico deve continuar em várias páginas.');
        if (getenv('SALVAR_PDF_HISTORICO')) {
            file_put_contents(getenv('SALVAR_PDF_HISTORICO'), $pdf);
        }
    }
}
