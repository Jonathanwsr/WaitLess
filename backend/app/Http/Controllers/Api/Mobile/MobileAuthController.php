<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use App\Models\User;
use App\Models\Funcionario;

class MobileAuthController extends Controller
{
    /**
     * Trata o login vindo do aplicativo móvel.
     */
    public function login(Request $request)
    {
        // Validação básica dos dados recebidos do App
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        // Busca o usuário pelo e-mail
        $user = User::where('email', $request->email)->first();

        // Verifica se o usuário existe e se a senha está correta
        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json([
                'message' => 'As credenciais fornecidas estão incorretas.'
            ], 421);
        }

        // Aplica a mesma blindagem de papel/função que você usa na Web
        $papel = strtolower(trim($user->papel ?? ''));
        $isFuncionario = Funcionario::where('usuario_id', $user->id)->exists();

        // Define o destino com base no perfil do usuário
        $destino = 'cliente';
        if ($papel === 'funcionario' || $papel === 'atendente' || $isFuncionario) {
            $destino = 'funcionario';
        }

        // Gera o token de acesso exclusivo para o dispositivo móvel (Sanctum)
        $token = $user->createToken('mobile_auth_token')->plainTextToken;

        // Retorna a resposta para o React Native
        return response()->json([
            'status' => 'success',
            'token' => $token,
            'usuario' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'papel' => $papel,
            ],
            'destino' => $destino // Diz ao app para onde redirecionar
        ], 200);
    }

    /**
     * Trata o logout invalidando o token do aparelho.
     */
    public function logout(Request $request)
    {
        // Remove o token atual que o dispositivo usou para se autenticar
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Sessão encerrada com sucesso no dispositivo móvel.'
        ], 200);
    }


    public function register(Request $request)
    {
        // Validação idêntica à do seu Controller Web
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|lowercase|email|max:255|unique:'.User::class,
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
            'papel' => 'required|string|in:admin,socio,user,gerente,atendente',
        ]);

        // Criação do usuário
        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'papel' => $request->papel, 
        ]);

        // Dispara o evento de registro do Laravel
        event(new Registered($user));

        // Aplica a blindagem de papel/função para descobrir o destino correto no app
        $papel = strtolower(trim($user->papel ?? ''));
        $isFuncionario = Funcionario::where('usuario_id', $user->id)->exists();

        $destino = 'cliente';
        if ($papel === 'funcionario' || $papel === 'atendente' || $isFuncionario) {
            $destino = 'funcionario';
        }

        // Gera o token do Sanctum para o aparelho móvel logar imediatamente
        $token = $user->createToken('mobile_auth_token')->plainTextToken;

        return response()->json([
            'status' => 'success',
            'token' => $token,
            'usuario' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'papel' => $papel,
            ],
            'destino' => $destino
        ], 201);
    }
}