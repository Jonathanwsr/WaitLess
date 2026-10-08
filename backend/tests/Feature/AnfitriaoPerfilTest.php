<?php

namespace Tests\Feature;

use App\Models\Estabelecimento;
use App\Models\ItemAluguel;
use App\Models\Servico;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AnfitriaoPerfilTest extends TestCase
{
    use DatabaseTransactions;

    public function test_retorna_404_para_estabelecimento_inexistente(): void
    {
        $cliente = User::create(['name' => 'Cliente', 'email' => 'anfp1' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'user']);

        $response = $this->actingAs($cliente)->getJson('/api/mobile/catalogo/estabelecimentos/999999');

        $response->assertStatus(404);
    }

    public function test_perfil_sem_itens_de_locacao_nao_quebra_e_traz_servicos(): void
    {
        $cliente = User::create(['name' => 'Cliente', 'email' => 'anfp2' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'user']);
        $estabelecimento = Estabelecimento::create(['nome' => 'Salao Anfitriao ' . uniqid(), 'cidade' => 'Curitiba']);
        Servico::create(['estabelecimento_id' => $estabelecimento->id, 'nome' => 'Corte', 'tipo_servico' => 'Outro', 'valor' => 60, 'duracao_minutos' => 30, 'ativo' => true]);

        $response = $this->actingAs($cliente)->getJson("/api/mobile/catalogo/estabelecimentos/{$estabelecimento->id}");

        $response->assertOk();
        $response->assertJsonCount(1, 'destaques');
        $response->assertJsonPath('destaques.0.tipo', 'servico');
    }

    public function test_perfil_com_itens_de_locacao_nao_quebra_no_merge_e_resolve_dono_correto(): void
    {
        // Regressão do bug: itens_aluguel.estabelecimento_id referencia USERS
        // (o sócio dono), não a tabela estabelecimentos — e o merge() de duas
        // coleções (itens + serviços) quebrava com "Call to a member function
        // getKey() on array" sempre que havia pelo menos um item de locação.
        $cliente = User::create(['name' => 'Cliente', 'email' => 'anfp3' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'user']);
        $socio = User::create(['name' => 'Socio Dono', 'email' => 'anfp4' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'socio']);
        $estabelecimento = Estabelecimento::create(['nome' => 'Locadora Anfitriao ' . uniqid()]);
        $estabelecimento->proprietarios()->attach($socio->id, ['tipo' => 'socio']);

        ItemAluguel::create(['estabelecimento_id' => $socio->id, 'nome' => 'Van', 'categoria' => 'carro', 'valor_diaria' => 150, 'ativo' => true]);
        Servico::create(['estabelecimento_id' => $estabelecimento->id, 'nome' => 'Corte', 'tipo_servico' => 'Outro', 'valor' => 60, 'duracao_minutos' => 30, 'ativo' => true]);

        $response = $this->actingAs($cliente)->getJson("/api/mobile/catalogo/estabelecimentos/{$estabelecimento->id}");

        $response->assertOk();
        $response->assertJsonCount(2, 'destaques');
        $tipos = collect($response->json('destaques'))->pluck('tipo')->sort()->values()->all();
        $this->assertSame(['item', 'servico'], $tipos);
    }
}
