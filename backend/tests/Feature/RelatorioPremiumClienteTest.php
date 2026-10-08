<?php

namespace Tests\Feature;

use App\Models\Agendamento;
use App\Models\Estabelecimento;
use App\Models\Servico;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class RelatorioPremiumClienteTest extends TestCase
{
    use DatabaseTransactions;

    public function test_cliente_sem_premium_recebe_403(): void
    {
        $cliente = User::create(['name' => 'Cliente', 'email' => 'relpc' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'user', 'plano_assinatura' => 'gratuito']);

        $response = $this->actingAs($cliente)->getJson('/api/mobile/relatorio-premium');

        $response->assertStatus(403);
    }

    public function test_cliente_com_premium_vencido_recebe_403(): void
    {
        $cliente = User::create(['name' => 'Cliente Vencido', 'email' => 'relpc3' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'user', 'plano_assinatura' => 'premium', 'plano_expira_em' => now()->subDay()]);

        $response = $this->actingAs($cliente)->getJson('/api/mobile/relatorio-premium');

        $response->assertStatus(403, 'Plano Premium vencido não deveria liberar o relatório.');
    }

    public function test_cliente_premium_recebe_resumo_com_gastos_e_favoritos(): void
    {
        $cliente = User::create(['name' => 'Cliente Premium', 'email' => 'relpc2' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'user', 'plano_assinatura' => 'premium', 'plano_expira_em' => now()->addMonth()]);
        $estabelecimento = Estabelecimento::create(['nome' => 'Salao Premium ' . uniqid(), 'ramo_atuacao' => 'Salão de Beleza']);
        $servico = Servico::create(['estabelecimento_id' => $estabelecimento->id, 'nome' => 'Corte', 'tipo_servico' => 'Outro', 'valor' => 80, 'duracao_minutos' => 30, 'ativo' => true]);

        Agendamento::create([
            'usuario_id' => $cliente->id, 'estabelecimento_id' => $estabelecimento->id, 'servico_id' => $servico->id,
            'data_agendamento' => now()->toDateString(), 'hora_agendamento' => '14:00',
            'status' => 'finalizado', 'status_pagamento' => 'pago', 'valor_final' => 80,
        ]);

        $response = $this->actingAs($cliente)->getJson('/api/mobile/relatorio-premium');

        $response->assertOk();
        $response->assertJsonPath('resumo.total_gasto', 80);
        $response->assertJsonPath('resumo.total_reservas', 1);
        $response->assertJsonPath('estabelecimentos_favoritos.0.nome', $estabelecimento->nome);
    }
}
