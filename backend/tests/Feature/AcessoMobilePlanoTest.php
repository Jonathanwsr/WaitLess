<?php

namespace Tests\Feature;

use App\Models\Estabelecimento;
use App\Models\Funcionario;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AcessoMobilePlanoTest extends TestCase
{
    use DatabaseTransactions;

    private const SENHA = 'senha-teste-123';

    private function criarCenario(?string $planoDono, $expiraEm = null): array
    {
        $socio = User::create(['name' => 'Socio Acesso', 'email' => 'accsoc' . uniqid() . '@x.com', 'password' => Hash::make(self::SENHA), 'papel' => 'socio', 'plano_assinatura' => $planoDono ?? 'gratuito', 'plano_expira_em' => $expiraEm]);
        $estabelecimento = Estabelecimento::create(['nome' => 'Salao Acesso ' . uniqid()]);
        $estabelecimento->proprietarios()->attach($socio->id, ['tipo' => 'socio']);

        $usuario1 = User::create(['name' => 'Funcionario 1', 'email' => 'acc1_' . uniqid() . '@x.com', 'password' => Hash::make(self::SENHA), 'papel' => 'atendente']);
        $funcionario1 = Funcionario::create(['estabelecimento_id' => $estabelecimento->id, 'usuario_id' => $usuario1->id, 'nome' => 'Funcionario 1', 'cargo' => 'Atendente', 'ativo' => true]);

        $usuario2 = User::create(['name' => 'Funcionario 2', 'email' => 'acc2_' . uniqid() . '@x.com', 'password' => Hash::make(self::SENHA), 'papel' => 'atendente']);
        $funcionario2 = Funcionario::create(['estabelecimento_id' => $estabelecimento->id, 'usuario_id' => $usuario2->id, 'nome' => 'Funcionario 2', 'cargo' => 'Atendente', 'ativo' => true]);

        return compact('socio', 'estabelecimento', 'usuario1', 'funcionario1', 'usuario2', 'funcionario2');
    }

    public function test_primeiro_funcionario_sempre_acessa_mesmo_no_plano_gratuito(): void
    {
        ['usuario1' => $usuario1] = $this->criarCenario('gratuito');

        $response = $this->postJson('/api/mobile/login', ['email' => $usuario1->email, 'password' => self::SENHA]);

        $response->assertOk();
    }

    public function test_segundo_funcionario_e_bloqueado_no_plano_gratuito(): void
    {
        ['usuario2' => $usuario2] = $this->criarCenario('gratuito');

        $response = $this->postJson('/api/mobile/login', ['email' => $usuario2->email, 'password' => self::SENHA]);

        $response->assertStatus(403);
    }

    public function test_segundo_funcionario_e_liberado_com_qualquer_plano_premium_de_socio_valido(): void
    {
        // 'premium' é o nível mais básico dos planos premium de sócio — antes
        // desta sessão, só 'premium-socio'/'premium-socio-anual' liberavam a equipe toda.
        ['usuario2' => $usuario2] = $this->criarCenario('premium', now()->addMonth());

        $response = $this->postJson('/api/mobile/login', ['email' => $usuario2->email, 'password' => self::SENHA]);

        $response->assertOk();
    }

    public function test_segundo_funcionario_e_bloqueado_se_o_plano_premium_do_socio_estiver_vencido(): void
    {
        ['usuario2' => $usuario2] = $this->criarCenario('premium-socio', now()->subDay());

        $response = $this->postJson('/api/mobile/login', ['email' => $usuario2->email, 'password' => self::SENHA]);

        $response->assertStatus(403, 'Plano Premium vencido do sócio não deveria continuar liberando a equipe inteira.');
    }
}
