<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use App\Services\TrocaSenhaService;

class PasswordController extends Controller
{
    /**
     * Update the user's password.
     */
    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate(\App\Support\RegrasSenha::regras(), \App\Support\RegrasSenha::mensagens());

        $trocas = app(TrocaSenhaService::class);
        $trocas->garantirPodeTrocar($request->user());

        $request->user()->update([
            'password' => Hash::make($validated['password']),
        ]);
        $trocas->registrar($request->user(), 'web_perfil', $request->ip());

        return back();
    }
}
