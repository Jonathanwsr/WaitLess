<?php

use App\Models\User;
use App\Notifications\RedefinirSenhaNotification;
use Illuminate\Support\Facades\Notification;

test('reset password link screen can be rendered', function () {
    $response = $this->get('/forgot-password');

    $response->assertStatus(200);
});

test('reset password link can be requested', function () {
    Notification::fake();

    $user = User::factory()->create();

    $this->post('/forgot-password', ['email' => $user->email])
        ->assertSessionHas('status', __('passwords.sent', [], 'pt_BR'));

    Notification::assertSentTo($user, RedefinirSenhaNotification::class);
});

test('o e-mail de recuperação é em português, com a marca e o link de nova senha', function () {
    $user = User::factory()->create(['name' => 'Maria']);

    $mensagem = (new RedefinirSenhaNotification('token-teste'))->toMail($user);
    $html = $mensagem->render();

    expect($mensagem->subject)->toBe('Redefinir sua senha na Lokyva')
        ->and($html)->toContain('Olá, Maria!')
        ->and($html)->toContain('Criar nova senha')
        ->and($html)->toContain('/reset-password/token-teste');
});

test('e-mail sem cadastro recebe a mesma resposta, sem revelar se a conta existe', function () {
    Notification::fake();

    $this->post('/forgot-password', ['email' => 'ninguem-' . uniqid() . '@exemplo.com'])
        ->assertSessionHasNoErrors()
        ->assertSessionHas('status', __('passwords.sent', [], 'pt_BR'));

    Notification::assertNothingSent();
});

test('reset password screen can be rendered', function () {
    Notification::fake();

    $user = User::factory()->create();

    $this->post('/forgot-password', ['email' => $user->email]);

    Notification::assertSentTo($user, RedefinirSenhaNotification::class, function ($notification) {
        $response = $this->get('/reset-password/'.$notification->token);

        $response->assertStatus(200);

        return true;
    });
});

test('password can be reset with valid token', function () {
    Notification::fake();

    $user = User::factory()->create();

    $this->post('/forgot-password', ['email' => $user->email]);

    Notification::assertSentTo($user, RedefinirSenhaNotification::class, function ($notification) use ($user) {
        $response = $this->post('/reset-password', [
            'token' => $notification->token,
            'email' => $user->email,
            'password' => 'password',
            'password_confirmation' => 'password',
        ]);

        $response
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('login'));

        return true;
    });
});
