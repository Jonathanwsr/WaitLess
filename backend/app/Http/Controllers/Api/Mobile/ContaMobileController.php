<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Services\ExclusaoContaService;
use App\Services\TrocaSenhaService;
use App\Support\RegrasSenha;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

/** Segurança da conta no app: trocar senha e apagar a conta (mesmas regras da web). */
class ContaMobileController extends Controller
{
    public function __construct(private ExclusaoContaService $exclusao)
    {
    }

    /** O que impede apagar a conta agora. Lista vazia = pode apagar. */
    public function pendencias(Request $request)
    {
        return response()->json(['pendencias' => $this->exclusao->pendencias($request->user())]);
    }

    public function alterarSenha(Request $request)
    {
        $validated = $request->validate(RegrasSenha::regras(), RegrasSenha::mensagens());

        $trocas = app(TrocaSenhaService::class);
        $trocas->garantirPodeTrocar($request->user());

        $request->user()->update(['password' => Hash::make($validated['password'])]);
        $trocas->registrar($request->user(), 'mobile_perfil', $request->ip());

        return response()->json(['message' => 'Senha alterada com sucesso.']);
    }

    public function apagar(Request $request)
    {
        $request->validate(['password' => ['required', 'current_password']], [
            'password.required' => 'Digite sua senha para confirmar.',
            'password.current_password' => 'Senha incorreta.',
        ]);

        $user = $request->user();
        $pendencias = $this->exclusao->pendencias($user);
        if (!empty($pendencias)) {
            return response()->json([
                'error' => 'Resolva as pendências antes de apagar a conta.',
                'pendencias' => $pendencias,
            ], 409);
        }

        // Encerra todas as sessões do app antes de remover a conta.
        $user->tokens()->delete();
        $user->delete();

        return response()->json(['message' => 'Sua conta foi apagada.']);
    }
}
