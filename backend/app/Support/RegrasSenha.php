<?php

namespace App\Support;

use Illuminate\Validation\Rules\Password;

/** Regras e mensagens da troca de senha logada (web e app): 8+ caracteres, letra e número, diferente da atual. */
class RegrasSenha
{
    public static function regras(): array
    {
        return [
            'current_password' => ['required', 'current_password'],
            'password' => ['required', Password::min(8)->letters()->numbers(), 'confirmed', 'different:current_password'],
        ];
    }

    public static function mensagens(): array
    {
        return [
            'current_password.required' => 'Digite sua senha atual.',
            'current_password.current_password' => 'A senha atual está incorreta.',
            'password.required' => 'Digite a nova senha.',
            'password.confirmed' => 'A confirmação não é igual à nova senha.',
            'password.different' => 'A nova senha precisa ser diferente da atual.',
            'password.min' => 'A nova senha precisa ter pelo menos 8 caracteres.',
            'password.letters' => 'A nova senha precisa ter pelo menos uma letra.',
            'password.numbers' => 'A nova senha precisa ter pelo menos um número.',
        ];
    }
}
