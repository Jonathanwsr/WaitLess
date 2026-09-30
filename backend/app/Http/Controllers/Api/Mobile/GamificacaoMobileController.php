<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Models\Sugestao;
use App\Services\GamificacaoService;
use Illuminate\Http\Request;

/** Check-in diário ("Estou usando") e sugestões enviadas no app — ver App\Services\GamificacaoService. */
class GamificacaoMobileController extends Controller
{
    public function __construct(private GamificacaoService $gamificacao)
    {
    }

    /** Estado atual do card de gamificação: já fez check-in hoje, quantos pontos ganha, etc. */
    public function resumo(Request $request)
    {
        $user = $request->user();

        return response()->json([
            'ja_fez_checkin_hoje' => $this->gamificacao->jaFezCheckinHoje($user),
            'pontos_checkin' => $user->isPremium()
                ? (int) config('gamificacao.checkin.pontos') * 2
                : (int) config('gamificacao.checkin.pontos'),
            'pontos_sugestao' => $user->isPremium()
                ? (int) config('gamificacao.sugestao.pontos') * 2
                : (int) config('gamificacao.sugestao.pontos'),
            'premium' => $user->isPremium(),
            'pontos_saldo' => (int) $user->pontos_saldo,
        ]);
    }

    /** Clique em "Estou usando o app" — concede pontos uma vez por dia. */
    public function checkin(Request $request)
    {
        $resultado = $this->gamificacao->registrarCheckin($request->user());

        if ($resultado['ja_feito']) {
            return response()->json([
                'message' => 'Você já fez o check-in de hoje. Volte amanhã!',
                'ja_feito' => true,
                'pontos' => 0,
            ]);
        }

        return response()->json([
            'message' => "Check-in registrado! Você ganhou {$resultado['pontos']} pontos.",
            'ja_feito' => false,
            'pontos' => $resultado['pontos'],
        ]);
    }

    /** Envia uma sugestão/feedback — a primeira do dia concede pontos. */
    public function enviarSugestao(Request $request)
    {
        $dados = $request->validate([
            'texto' => 'required|string|min:5|max:2000',
            'categoria' => 'nullable|string|max:50',
        ]);

        $resultado = $this->gamificacao->registrarSugestao($request->user(), $dados['texto'], $dados['categoria'] ?? null);

        return response()->json([
            'message' => $resultado['pontos'] > 0
                ? "Sugestão enviada! Você ganhou {$resultado['pontos']} pontos."
                : 'Sugestão enviada! Você já ganhou pontos por sugestão hoje, mas a equipe vai ler a sua também.',
            'pontos' => $resultado['pontos'],
        ]);
    }

    /** Histórico das sugestões enviadas pelo próprio usuário. */
    public function minhasSugestoes(Request $request)
    {
        $sugestoes = Sugestao::where('usuario_id', $request->user()->id)
            ->latest()
            ->limit(50)
            ->get(['id', 'categoria', 'texto', 'status', 'resposta_admin', 'pontos_concedidos', 'created_at']);

        return response()->json($sugestoes);
    }
}
