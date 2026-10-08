<?php

namespace Tests\Feature;

use App\Models\Aluguel;
use App\Models\Estabelecimento;
use App\Models\Funcionario;
use App\Models\ItemAluguel;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AtribuicaoFuncionarioAluguelTest extends TestCase
{
    use DatabaseTransactions;

    private function criarCenario(): array
    {
        $socio = User::create(['name' => 'Socio Locacao', 'email' => 'socloc' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'socio']);
        $estabelecimento = Estabelecimento::create(['nome' => 'Locadora ' . uniqid()]);
        $estabelecimento->proprietarios()->attach($socio->id, ['tipo' => 'socio']);

        $item = ItemAluguel::create(['estabelecimento_id' => $socio->id, 'nome' => 'Carro', 'categoria' => 'carro', 'valor_diaria' => 100, 'ativo' => true]);

        $usuarioFunc = User::create(['name' => 'Func Locacao', 'email' => 'funcloc' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'atendente']);
        $funcionario = Funcionario::create(['estabelecimento_id' => $estabelecimento->id, 'usuario_id' => $usuarioFunc->id, 'nome' => 'Func Locacao', 'cargo' => 'Atendente', 'ativo' => true]);

        $locatario = User::create(['name' => 'Locatario', 'email' => 'locat' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'user']);

        $aluguel = Aluguel::create([
            'codigo_reserva' => 'RES-' . uniqid(),
            'estabelecimento_id' => $socio->id, 'item_aluguel_id' => $item->id,
            'proprietario_id' => $socio->id, 'locatario_id' => $locatario->id,
            'tipo_periodo' => 'diaria', 'quantidade_periodos' => 1,
            'data_inicio' => now()->addDay()->toDateString(), 'data_fim' => now()->addDays(2)->toDateString(),
            'valor_unitario' => 100, 'valor_total' => 100, 'forma_pagamento' => 'presencial', 'status' => 'confirmado',
        ]);

        return compact('socio', 'estabelecimento', 'item', 'usuarioFunc', 'funcionario', 'locatario', 'aluguel');
    }

    public function test_estranho_nao_consegue_atualizar_status_do_aluguel(): void
    {
        ['aluguel' => $aluguel] = $this->criarCenario();
        $estranho = User::create(['name' => 'Estranho', 'email' => 'estrloc' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'user']);

        $response = $this->actingAs($estranho)->putJson("/api/v1/mobile/alugueis/{$aluguel->id}", ['status' => 'finalizado']);

        $response->assertStatus(403);
    }

    public function test_dono_consegue_atualizar_status_do_proprio_aluguel(): void
    {
        ['aluguel' => $aluguel, 'socio' => $socio] = $this->criarCenario();

        $response = $this->actingAs($socio)->putJson("/api/v1/mobile/alugueis/{$aluguel->id}", ['status' => 'finalizado']);

        $response->assertOk();
        $this->assertSame('finalizado', $aluguel->fresh()->status);
    }

    public function test_estranho_nao_consegue_atribuir_funcionario_na_locacao(): void
    {
        ['aluguel' => $aluguel, 'funcionario' => $funcionario] = $this->criarCenario();
        $estranho = User::create(['name' => 'Estranho', 'email' => 'estrloc2' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'user']);

        $response = $this->actingAs($estranho)->putJson("/api/v1/mobile/alugueis/{$aluguel->id}/funcionario", ['funcionario_id' => $funcionario->id]);

        $response->assertStatus(403);
        $this->assertNull($aluguel->fresh()->funcionario_id);
    }

    public function test_dono_consegue_atribuir_funcionario_na_locacao_e_fica_registrado_quem_atribuiu(): void
    {
        ['aluguel' => $aluguel, 'funcionario' => $funcionario, 'socio' => $socio] = $this->criarCenario();

        $response = $this->actingAs($socio)->putJson("/api/v1/mobile/alugueis/{$aluguel->id}/funcionario", ['funcionario_id' => $funcionario->id]);

        $response->assertOk();
        $aluguel->refresh();
        $this->assertSame($funcionario->id, $aluguel->funcionario_id);
        $this->assertSame($socio->id, $aluguel->atribuido_por);
    }

    public function test_funcionario_consegue_pegar_para_si_uma_locacao_livre(): void
    {
        ['aluguel' => $aluguel, 'funcionario' => $funcionario, 'usuarioFunc' => $usuarioFunc] = $this->criarCenario();

        $response = $this->actingAs($usuarioFunc)->putJson("/api/v1/mobile/alugueis/{$aluguel->id}/funcionario", ['funcionario_id' => $funcionario->id]);

        $response->assertOk();
        $this->assertSame($funcionario->id, $aluguel->fresh()->funcionario_id);
    }
}
