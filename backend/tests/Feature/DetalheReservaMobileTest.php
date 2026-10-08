<?php

namespace Tests\Feature;

use App\Models\Agendamento;
use App\Models\Estabelecimento;
use App\Models\Funcionario;
use App\Models\Servico;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class DetalheReservaMobileTest extends TestCase
{
    use DatabaseTransactions;

    public function test_detalhe_do_agendamento_inclui_o_profissional_responsavel(): void
    {
        $estabelecimento = Estabelecimento::create(['nome' => 'Salao Detalhe ' . uniqid()]);
        $servico = Servico::create(['estabelecimento_id' => $estabelecimento->id, 'nome' => 'Corte', 'tipo_servico' => 'Outro', 'valor' => 70, 'duracao_minutos' => 30, 'ativo' => true]);

        $usuarioFunc = User::create(['name' => 'Barbeiro', 'email' => 'barb' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'atendente']);
        $funcionario = Funcionario::create(['estabelecimento_id' => $estabelecimento->id, 'usuario_id' => $usuarioFunc->id, 'nome' => 'Barbeiro Top', 'cargo' => 'Atendente', 'ativo' => true]);

        $cliente = User::create(['name' => 'Cliente', 'email' => 'detr' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'user']);
        $agendamento = Agendamento::create([
            'usuario_id' => $cliente->id, 'estabelecimento_id' => $estabelecimento->id, 'servico_id' => $servico->id,
            'funcionario_id' => $funcionario->id, 'data_agendamento' => now()->addDay()->toDateString(), 'hora_agendamento' => '10:00',
            'status' => 'confirmado', 'status_pagamento' => 'presencial', 'valor_final' => 70,
        ]);

        $response = $this->actingAs($cliente)->getJson("/api/mobile/agendamentos/{$agendamento->id}");

        $response->assertOk();
        $response->assertJsonPath('funcionario.nome', 'Barbeiro Top');
    }

    public function test_outro_cliente_nao_acessa_detalhe_de_agendamento_alheio(): void
    {
        $estabelecimento = Estabelecimento::create(['nome' => 'Salao Detalhe2 ' . uniqid()]);
        $servico = Servico::create(['estabelecimento_id' => $estabelecimento->id, 'nome' => 'Corte', 'tipo_servico' => 'Outro', 'valor' => 70, 'duracao_minutos' => 30, 'ativo' => true]);
        $dono = User::create(['name' => 'Dono', 'email' => 'detrd' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'user']);
        $intruso = User::create(['name' => 'Intruso', 'email' => 'detri' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'user']);

        $agendamento = Agendamento::create([
            'usuario_id' => $dono->id, 'estabelecimento_id' => $estabelecimento->id, 'servico_id' => $servico->id,
            'data_agendamento' => now()->addDay()->toDateString(), 'hora_agendamento' => '10:00',
            'status' => 'confirmado', 'status_pagamento' => 'presencial', 'valor_final' => 70,
        ]);

        $response = $this->actingAs($intruso)->getJson("/api/mobile/agendamentos/{$agendamento->id}");

        $response->assertStatus(403);
    }
}
