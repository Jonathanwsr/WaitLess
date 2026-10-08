<?php

use App\Models\User;
use Illuminate\Support\Facades\Http;

/** Dados que o formulário de cadastro realmente envia. */
function dadosCadastro(array $extra = []): array
{
    return array_merge([
        'name' => 'Test User',
        'email' => 'cadastro' . uniqid() . '@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
        'papel' => 'user',
        'cpf_cnpj' => '529.982.247-25',
        'mobile_phone' => '(11) 99999-8888',
        'postal_code' => '01001-000',
        'address' => 'Praça da Sé',
        'address_number' => '100',
        'province' => 'Sé',
        'city' => 'São Paulo',
        'state' => 'SP',
        'person_type' => 'FISICA',
        'birth_date' => '1990-05-10',
        'termo_compromisso_aceito' => true,
    ], $extra);
}

test('registration screen can be rendered', function () {
    $this->get('/register')->assertStatus(200);
});

test('new users can register', function () {
    Http::fake(['*/customers' => Http::response(['id' => 'cus_teste123'], 200), '*' => Http::response([], 200)]);

    $dados = dadosCadastro();
    $response = $this->post('/register', $dados);

    $this->assertAuthenticated();
    $response->assertRedirect(route('dashboard', absolute: false));

    $user = User::where('email', $dados['email'])->first();
    expect($user->asaas_customer_id)->toBe('cus_teste123')
        ->and($user->cpf_cnpj)->toBe('52998224725')
        ->and((int) $user->pontos_saldo)->toBe(100);
});

test('ninguem se cadastra como admin pelo formulario', function () {
    Http::fake();

    $this->post('/register', dadosCadastro(['papel' => 'admin']))->assertSessionHasErrors('papel');

    $this->assertGuest();
    Http::assertNothingSent();
});

test('cadastro recusado pelo gateway nao cria usuario nem mostra o nome do gateway', function () {
    Http::fake(['*/customers' => Http::response(['errors' => [['description' => 'O CPF informado é inválido.']]], 400)]);

    $dados = dadosCadastro();
    $response = $this->post('/register', $dados);

    $response->assertSessionHasErrors('cpf_cnpj');
    $this->assertGuest();
    expect(User::where('email', $dados['email'])->exists())->toBeFalse();
    expect(session('errors')->first('cpf_cnpj'))->not->toContain('Asaas');
});
