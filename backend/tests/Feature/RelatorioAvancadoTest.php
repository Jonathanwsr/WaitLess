<?php

namespace Tests\Feature;

use App\Models\Agendamento;
use App\Models\Estabelecimento;
use App\Models\Servico;
use App\Models\User;
use App\Services\RelatorioAvancadoService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class RelatorioAvancadoTest extends TestCase
{
    use DatabaseTransactions;

    private function criarSocio(array $overrides = []): User
    {
        return User::create(array_merge([
            'name' => 'Socio Relatorio', 'email' => 'relsoc' . uniqid() . '@x.com',
            'password' => Hash::make('senha-teste-123'), 'papel' => 'socio',
        ], $overrides));
    }

    public function test_bloqueia_socio_sem_plano_premium(): void
    {
        $socio = $this->criarSocio(['plano_assinatura' => 'gratuito']);

        $resultado = app(RelatorioAvancadoService::class)->montar($socio);

        $this->assertTrue($resultado['bloqueado']);
    }

    public function test_bloqueia_socio_com_plano_premium_vencido(): void
    {
        $socio = $this->criarSocio(['plano_assinatura' => 'premium-socio', 'plano_expira_em' => now()->subDay()]);

        $resultado = app(RelatorioAvancadoService::class)->montar($socio);

        $this->assertTrue($resultado['bloqueado'], 'Plano Premium vencido não deveria liberar o relatório.');
    }

    public function test_libera_socio_com_plano_premium_valido_mas_sem_estabelecimento(): void
    {
        $socio = $this->criarSocio(['plano_assinatura' => 'premium', 'plano_expira_em' => now()->addMonth()]);

        $resultado = app(RelatorioAvancadoService::class)->montar($socio);

        $this->assertFalse($resultado['bloqueado']);
        $this->assertTrue($resultado['semDados'] ?? false);
    }

    public function test_calcula_faturamento_e_ticket_medio_apenas_de_agendamentos_finalizados(): void
    {
        $socio = $this->criarSocio(['plano_assinatura' => 'premium-socio', 'plano_expira_em' => now()->addMonth()]);
        $estabelecimento = Estabelecimento::create(['nome' => 'Salao Relatorio ' . uniqid()]);
        $estabelecimento->proprietarios()->attach($socio->id, ['tipo' => 'socio']);

        $servico = Servico::create(['estabelecimento_id' => $estabelecimento->id, 'nome' => 'Corte', 'tipo_servico' => 'Outro', 'valor' => 100, 'duracao_minutos' => 30, 'ativo' => true]);
        $cliente = User::create(['name' => 'Cliente', 'email' => 'relcli' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'user']);

        Agendamento::create([
            'usuario_id' => $cliente->id, 'estabelecimento_id' => $estabelecimento->id, 'servico_id' => $servico->id,
            'data_agendamento' => now()->toDateString(), 'hora_agendamento' => '10:00',
            'status' => 'finalizado', 'status_pagamento' => 'pago', 'valor_final' => 100,
        ]);
        // Confirmado (não finalizado) não deveria contar como faturamento.
        Agendamento::create([
            'usuario_id' => $cliente->id, 'estabelecimento_id' => $estabelecimento->id, 'servico_id' => $servico->id,
            'data_agendamento' => now()->toDateString(), 'hora_agendamento' => '11:00',
            'status' => 'confirmado', 'status_pagamento' => 'presencial', 'valor_final' => 999,
        ]);

        $resultado = app(RelatorioAvancadoService::class)->montar($socio);

        $this->assertFalse($resultado['bloqueado']);
        $this->assertSame(100.0, $resultado['resumo']['faturamento_mes_atual']);
        $this->assertSame(100.0, $resultado['resumo']['ticket_medio']);
        $this->assertSame(100.0, $resultado['faturamento_por_mes']->last()['valor']);
    }
}
