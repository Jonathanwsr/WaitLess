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

class AtribuicaoFuncionarioTest extends TestCase
{
    use DatabaseTransactions;

    private function criarCenario(): array
    {
        $estabelecimento = Estabelecimento::create(['nome' => 'Salão Atrib ' . uniqid()]);
        $servico = Servico::create([
            'estabelecimento_id' => $estabelecimento->id,
            'nome' => 'Corte', 'tipo_servico' => 'Outro', 'valor' => 50, 'duracao_minutos' => 30, 'ativo' => true,
        ]);

        $socio = User::create(['name' => 'Socio', 'email' => 'socioaf' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'socio']);
        $estabelecimento->proprietarios()->attach($socio->id, ['tipo' => 'socio']);

        $usuarioAtendenteA = User::create(['name' => 'Atendente A', 'email' => 'atdA' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'atendente']);
        $funcionarioA = Funcionario::create(['estabelecimento_id' => $estabelecimento->id, 'usuario_id' => $usuarioAtendenteA->id, 'nome' => 'Atendente A', 'cargo' => 'Atendente', 'ativo' => true]);

        $usuarioAtendenteB = User::create(['name' => 'Atendente B', 'email' => 'atdB' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'atendente']);
        $funcionarioB = Funcionario::create(['estabelecimento_id' => $estabelecimento->id, 'usuario_id' => $usuarioAtendenteB->id, 'nome' => 'Atendente B', 'cargo' => 'Atendente', 'ativo' => true]);

        $cliente = User::create(['name' => 'Cliente', 'email' => 'cliaf' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'user']);
        $agendamento = Agendamento::create([
            'usuario_id' => $cliente->id, 'estabelecimento_id' => $estabelecimento->id, 'servico_id' => $servico->id,
            'data_agendamento' => now()->addDay()->toDateString(), 'hora_agendamento' => '10:00',
            'status' => 'confirmado', 'status_pagamento' => 'presencial', 'valor_final' => 50,
        ]);

        $estranho = User::create(['name' => 'Estranho', 'email' => 'estaf' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'user']);

        return compact('estabelecimento', 'socio', 'funcionarioA', 'funcionarioB', 'usuarioAtendenteA', 'usuarioAtendenteB', 'agendamento', 'estranho');
    }

    public function test_usuario_sem_vinculo_nao_consegue_atribuir_funcionario(): void
    {
        ['agendamento' => $agendamento, 'funcionarioA' => $funcionarioA, 'estranho' => $estranho] = $this->criarCenario();

        $response = $this->actingAs($estranho)->putJson("/api/mobile/agendamentos/{$agendamento->id}/funcionario", [
            'funcionario_id' => $funcionarioA->id,
        ]);

        $response->assertStatus(403);
        $this->assertNull($agendamento->fresh()->funcionario_id);
    }

    public function test_socio_consegue_atribuir_livremente_e_fica_registrado_quem_atribuiu(): void
    {
        ['agendamento' => $agendamento, 'funcionarioA' => $funcionarioA, 'socio' => $socio] = $this->criarCenario();

        $response = $this->actingAs($socio)->putJson("/api/mobile/agendamentos/{$agendamento->id}/funcionario", [
            'funcionario_id' => $funcionarioA->id,
        ]);

        $response->assertOk();
        $agendamento->refresh();
        $this->assertSame($funcionarioA->id, $agendamento->funcionario_id);
        $this->assertSame($socio->id, $agendamento->atribuido_por);
    }

    public function test_atendente_consegue_pegar_para_si_um_atendimento_livre(): void
    {
        ['agendamento' => $agendamento, 'funcionarioA' => $funcionarioA, 'usuarioAtendenteA' => $usuarioAtendenteA] = $this->criarCenario();

        $response = $this->actingAs($usuarioAtendenteA)->putJson("/api/mobile/agendamentos/{$agendamento->id}/funcionario", [
            'funcionario_id' => $funcionarioA->id,
        ]);

        $response->assertOk();
        $this->assertSame($funcionarioA->id, $agendamento->fresh()->funcionario_id);
    }

    public function test_atendente_nao_consegue_roubar_atendimento_de_colega(): void
    {
        ['agendamento' => $agendamento, 'funcionarioA' => $funcionarioA, 'funcionarioB' => $funcionarioB, 'usuarioAtendenteB' => $usuarioAtendenteB] = $this->criarCenario();

        $agendamento->update(['funcionario_id' => $funcionarioA->id]);

        $response = $this->actingAs($usuarioAtendenteB)->putJson("/api/mobile/agendamentos/{$agendamento->id}/funcionario", [
            'funcionario_id' => $funcionarioB->id,
        ]);

        $response->assertStatus(403);
        $this->assertSame($funcionarioA->id, $agendamento->fresh()->funcionario_id);
    }

    public function test_atendente_nao_consegue_atribuir_atendimento_a_outro_colega(): void
    {
        ['agendamento' => $agendamento, 'funcionarioB' => $funcionarioB, 'usuarioAtendenteA' => $usuarioAtendenteA] = $this->criarCenario();

        $response = $this->actingAs($usuarioAtendenteA)->putJson("/api/mobile/agendamentos/{$agendamento->id}/funcionario", [
            'funcionario_id' => $funcionarioB->id,
        ]);

        $response->assertStatus(403);
        $this->assertNull($agendamento->fresh()->funcionario_id);
    }

    public function test_nao_aceita_funcionario_de_outro_estabelecimento(): void
    {
        ['agendamento' => $agendamento, 'socio' => $socio] = $this->criarCenario();

        $outroEstabelecimento = Estabelecimento::create(['nome' => 'Outro Salão ' . uniqid()]);
        $outroUsuario = User::create(['name' => 'Atendente Fora', 'email' => 'fora' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'atendente']);
        $funcionarioFora = Funcionario::create(['estabelecimento_id' => $outroEstabelecimento->id, 'usuario_id' => $outroUsuario->id, 'nome' => 'Fora', 'cargo' => 'Atendente', 'ativo' => true]);

        $response = $this->actingAs($socio)->putJson("/api/mobile/agendamentos/{$agendamento->id}/funcionario", [
            'funcionario_id' => $funcionarioFora->id,
        ]);

        $response->assertStatus(422);
        $this->assertNull($agendamento->fresh()->funcionario_id);
    }
}
