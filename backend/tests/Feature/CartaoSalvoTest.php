<?php

namespace Tests\Feature;

use App\Models\CartaoSalvo;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class CartaoSalvoTest extends TestCase
{
    use DatabaseTransactions;

    private function criarUsuario(): User
    {
        return User::create(['name' => 'Cliente Cartao', 'email' => 'cartao' . uniqid() . '@x.com', 'password' => Hash::make('senha-teste-123'), 'papel' => 'user']);
    }

    public function test_lista_apenas_os_cartoes_do_proprio_usuario(): void
    {
        $dono = $this->criarUsuario();
        $outro = $this->criarUsuario();

        CartaoSalvo::create(['user_id' => $dono->id, 'token' => 'tok_' . uniqid(), 'bandeira' => 'VISA', 'ultimos_digitos' => '4242', 'padrao' => true]);
        CartaoSalvo::create(['user_id' => $outro->id, 'token' => 'tok_' . uniqid(), 'bandeira' => 'MASTERCARD', 'ultimos_digitos' => '1111', 'padrao' => true]);

        $response = $this->actingAs($dono)->getJson('/api/mobile/cartoes-salvos');

        $response->assertOk();
        $this->assertCount(1, $response->json('data'));
        $this->assertSame('4242', $response->json('data.0.ultimos_digitos'));
    }

    public function test_nunca_expoe_o_token_do_gateway_na_listagem(): void
    {
        $dono = $this->criarUsuario();
        CartaoSalvo::create(['user_id' => $dono->id, 'token' => 'tok_secreto_xyz', 'bandeira' => 'VISA', 'ultimos_digitos' => '4242', 'padrao' => true]);

        $response = $this->actingAs($dono)->getJson('/api/mobile/cartoes-salvos');

        $response->assertOk();
        $this->assertArrayNotHasKey('token', $response->json('data.0'));
    }

    public function test_usuario_nao_consegue_remover_cartao_de_outra_pessoa(): void
    {
        $dono = $this->criarUsuario();
        $estranho = $this->criarUsuario();
        $cartao = CartaoSalvo::create(['user_id' => $dono->id, 'token' => 'tok_' . uniqid(), 'bandeira' => 'VISA', 'ultimos_digitos' => '4242', 'padrao' => true]);

        $response = $this->actingAs($estranho)->deleteJson("/api/mobile/cartoes-salvos/{$cartao->id}");

        $response->assertStatus(404);
        $this->assertNotNull($cartao->fresh());
    }

    public function test_ao_remover_o_cartao_padrao_outro_vira_padrao_automaticamente(): void
    {
        $dono = $this->criarUsuario();
        $antigo = CartaoSalvo::create(['user_id' => $dono->id, 'token' => 'tok_a_' . uniqid(), 'bandeira' => 'VISA', 'ultimos_digitos' => '1111', 'padrao' => false]);
        $padrao = CartaoSalvo::create(['user_id' => $dono->id, 'token' => 'tok_b_' . uniqid(), 'bandeira' => 'MASTERCARD', 'ultimos_digitos' => '2222', 'padrao' => true]);

        $response = $this->actingAs($dono)->deleteJson("/api/mobile/cartoes-salvos/{$padrao->id}");

        $response->assertOk();
        $this->assertTrue($antigo->fresh()->padrao);
    }
}
