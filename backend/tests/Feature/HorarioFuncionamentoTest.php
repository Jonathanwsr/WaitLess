<?php

namespace Tests\Feature;

use App\Models\Estabelecimento;
use App\Models\HorarioFuncionamento;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class HorarioFuncionamentoTest extends TestCase
{
    use DatabaseTransactions;

    private function criarSocioComEstabelecimento(): array
    {
        $socio = User::create(['name' => 'Socio Horario', 'email' => 'horario' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'socio']);
        $estabelecimento = Estabelecimento::create(['nome' => 'Loja Horario ' . uniqid()]);
        $estabelecimento->proprietarios()->attach($socio->id, ['tipo' => 'socio']);

        return [$socio, $estabelecimento];
    }

    public function test_socio_cadastra_horario_de_um_dia(): void
    {
        [$socio, $estabelecimento] = $this->criarSocioComEstabelecimento();

        $response = $this->actingAs($socio)->post("/estabelecimentos/{$estabelecimento->id}/horarios", [
            'dia_semana' => 1, 'hora_abertura' => '09:00', 'hora_fechamento' => '18:00',
        ]);

        $response->assertRedirect();
        $horario = HorarioFuncionamento::where('estabelecimento_id', $estabelecimento->id)->where('dia_semana', 1)->first();
        $this->assertNotNull($horario);
        $this->assertSame('09:00:00', $horario->hora_abertura);
        $this->assertFalse($horario->fechado);
    }

    public function test_editar_o_mesmo_dia_atualiza_em_vez_de_duplicar(): void
    {
        [$socio, $estabelecimento] = $this->criarSocioComEstabelecimento();

        $this->actingAs($socio)->post("/estabelecimentos/{$estabelecimento->id}/horarios", [
            'dia_semana' => 2, 'hora_abertura' => '08:00', 'hora_fechamento' => '17:00',
        ]);
        $this->actingAs($socio)->post("/estabelecimentos/{$estabelecimento->id}/horarios", [
            'dia_semana' => 2, 'hora_abertura' => '10:00', 'hora_fechamento' => '20:00',
        ]);

        $this->assertSame(1, HorarioFuncionamento::where('estabelecimento_id', $estabelecimento->id)->where('dia_semana', 2)->count());
        $horario = HorarioFuncionamento::where('estabelecimento_id', $estabelecimento->id)->where('dia_semana', 2)->first();
        $this->assertSame('10:00:00', $horario->hora_abertura);
    }

    public function test_pode_marcar_um_dia_como_fechado_sem_horario(): void
    {
        [$socio, $estabelecimento] = $this->criarSocioComEstabelecimento();

        $response = $this->actingAs($socio)->post("/estabelecimentos/{$estabelecimento->id}/horarios", [
            'dia_semana' => 0, 'fechado' => true,
        ]);

        $response->assertRedirect();
        $horario = HorarioFuncionamento::where('estabelecimento_id', $estabelecimento->id)->where('dia_semana', 0)->first();
        $this->assertTrue($horario->fechado);
        $this->assertNull($horario->hora_abertura);
    }

    public function test_socio_apaga_um_horario(): void
    {
        [$socio, $estabelecimento] = $this->criarSocioComEstabelecimento();
        $horario = HorarioFuncionamento::create(['estabelecimento_id' => $estabelecimento->id, 'dia_semana' => 3, 'hora_abertura' => '09:00', 'hora_fechamento' => '18:00']);

        $response = $this->actingAs($socio)->delete("/estabelecimentos/{$estabelecimento->id}/horarios/{$horario->id}");

        $response->assertRedirect();
        $this->assertNull(HorarioFuncionamento::find($horario->id));
    }

    public function test_quem_nao_administra_o_local_nao_pode_mexer_no_horario(): void
    {
        [, $estabelecimento] = $this->criarSocioComEstabelecimento();
        $outro = User::create(['name' => 'Outro', 'email' => 'outro-horario' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'socio']);

        $response = $this->actingAs($outro)->post("/estabelecimentos/{$estabelecimento->id}/horarios", [
            'dia_semana' => 1, 'hora_abertura' => '09:00', 'hora_fechamento' => '18:00',
        ]);

        $response->assertForbidden();
    }

    public function test_tela_de_configuracoes_carrega_os_horarios(): void
    {
        [$socio, $estabelecimento] = $this->criarSocioComEstabelecimento();
        HorarioFuncionamento::create(['estabelecimento_id' => $estabelecimento->id, 'dia_semana' => 1, 'hora_abertura' => '09:00', 'hora_fechamento' => '18:00']);

        $response = $this->actingAs($socio)->get("/estabelecimentos/{$estabelecimento->id}/configuracoes");

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page->has('horariosFuncionamento', 1));
    }
}
