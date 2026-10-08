<?php

namespace Tests\Feature;

use App\Models\Estabelecimento;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class LimiteFuncionariosTest extends TestCase
{
    use DatabaseTransactions;

    private function criarSocioComLocal(?string $plano = null): array
    {
        $dados = ['name' => 'Socio Limite', 'email' => 'limite' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'socio'];
        if ($plano) {
            $dados['plano_assinatura'] = $plano;
            $dados['plano_expira_em'] = now()->addMonth();
        }
        $socio = User::create($dados);
        $estabelecimento = Estabelecimento::create(['nome' => 'Loja Limite ' . uniqid()]);
        $estabelecimento->proprietarios()->attach($socio->id, ['tipo' => 'socio']);

        return [$socio, $estabelecimento];
    }

    private function criarFuncionario($socio, Estabelecimento $estabelecimento, int $numero)
    {
        return $this->actingAs($socio)->post("/estabelecimentos/{$estabelecimento->id}/funcionarios", [
            'nome' => "Funcionario {$numero}", 'cargo' => 'Atendente',
            'email' => "func{$numero}-" . uniqid() . '@x.com', 'password' => 'senha12345',
        ]);
    }

    public function test_plano_gratuito_so_cria_ate_o_limite_de_funcionarios(): void
    {
        [$socio, $estabelecimento] = $this->criarSocioComLocal();

        $this->criarFuncionario($socio, $estabelecimento, 1)->assertRedirect();
        $this->criarFuncionario($socio, $estabelecimento, 2)->assertRedirect();
        $this->criarFuncionario($socio, $estabelecimento, 3)->assertRedirect();
        $this->assertSame(3, $estabelecimento->funcionarios()->count());

        $resposta = $this->criarFuncionario($socio, $estabelecimento, 4);
        $resposta->assertSessionHasErrors('cargo');
        $this->assertSame(3, $estabelecimento->funcionarios()->count());
    }

    public function test_plano_socio_premium_cria_funcionarios_ilimitados(): void
    {
        [$socio, $estabelecimento] = $this->criarSocioComLocal('premium-socio-anual');

        for ($i = 1; $i <= 5; $i++) {
            $this->criarFuncionario($socio, $estabelecimento, $i)->assertRedirect();
        }

        $this->assertSame(5, $estabelecimento->funcionarios()->count());
    }
}
