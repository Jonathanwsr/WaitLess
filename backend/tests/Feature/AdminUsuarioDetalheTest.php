<?php

namespace Tests\Feature;

use App\Models\Estabelecimento;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AdminUsuarioDetalheTest extends TestCase
{
    use DatabaseTransactions;

    public function test_usuario_comum_nao_acessa_a_ficha_de_outro_usuario(): void
    {
        $intruso = User::create(['name' => 'Intruso', 'email' => 'advd1' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'user']);
        $alvo = User::create(['name' => 'Alvo', 'email' => 'advd2' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'user']);

        $response = $this->actingAs($intruso)->get("/admin/usuarios/{$alvo->id}");

        $response->assertStatus(403);
    }

    public function test_admin_ve_a_ficha_completa_com_telefone_email_endereco(): void
    {
        $admin = User::create(['name' => 'Admin', 'email' => 'advd3' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'admin']);
        $alvo = User::create([
            // Os campos de endereço que o app realmente grava (MobileAuthController::atualizarPerfil
            // salva o form em português nas colunas em inglês do Asaas: address/province/city/state).
            'name' => 'Cliente Completo', 'email' => 'advd4' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'user',
            'telefone' => '11999998888', 'address' => 'Rua das Flores', 'province' => 'Centro', 'city' => 'São Paulo', 'state' => 'SP',
        ]);

        $response = $this->actingAs($admin)->getJson("/admin/usuarios/{$alvo->id}");

        $response->assertOk();
        $response->assertJsonPath('telefone', '11999998888');
        $response->assertJsonPath('endereco_completo', 'Rua das Flores, Centro, São Paulo, SP');
    }

    public function test_ficha_lista_estabelecimentos_do_socio(): void
    {
        $admin = User::create(['name' => 'Admin', 'email' => 'advd5' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'admin']);
        $socio = User::create(['name' => 'Socio Alvo', 'email' => 'advd6' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'socio']);
        $estabelecimento = Estabelecimento::create(['nome' => 'Loja do Socio Alvo', 'cidade' => 'Rio de Janeiro']);
        $estabelecimento->proprietarios()->attach($socio->id, ['tipo' => 'socio']);

        $response = $this->actingAs($admin)->getJson("/admin/usuarios/{$socio->id}");

        $response->assertOk();
        $response->assertJsonPath('estabelecimentos.0.nome', 'Loja do Socio Alvo');
        $response->assertJsonPath('estabelecimentos.0.tipo', 'socio');
    }
}
