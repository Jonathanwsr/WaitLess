<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Inertia\Response;

class AuthenticatedSessionController extends Controller
{
    /**
     * Display the login view.
     */
    public function create(): Response
    {
        return Inertia::render('Auth/Login', [
            'canResetPassword' => Route::has('password.request'),
            'status' => session('status'),
        ]);
    }

    /**
     * Handle an incoming authentication request.
     */
    public function store(LoginRequest $request): RedirectResponse
    {
        $request->authenticate();
        $request->session()->regenerate();

        $user = Auth::user();
        
        // 1. Limpa espaços invisíveis e converte para minúsculas (Blindagem total)
        $papel = strtolower(trim($user->papel ?? ''));

        // 2. Verifica se o ID deste usuário existe na tabela de funcionários
        $isFuncionario = \App\Models\Funcionario::where('usuario_id', $user->id)->exists();

        // 👉 SE FOR FUNCIONÁRIO, FORÇA A IDA PARA O PAINEL DELE
        if ($papel === 'funcionario' || $papel === 'atendente' || $isFuncionario) {
            return redirect()->to('/meu-painel'); // Vai direto para a URL do profissional
        }

        // Se for Cliente, Gerente ou Admin, vai para o Dashboard normal
        return redirect()->intended('/dashboard');
    }

    /**
     * Destroy an authenticated session.
     */
    public function destroy(Request $request): RedirectResponse
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();

        $request->session()->regenerateToken();

        return redirect('/');
    }
}