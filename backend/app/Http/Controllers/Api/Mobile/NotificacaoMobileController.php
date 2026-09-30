<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Models\NotificacaoEstorno;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Sininho do app: avisos de estorno (solicitado, em análise, aprovado, reprovado) do cliente e do local. */
class NotificacaoMobileController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $uid = $request->user()->id;

        $lista = NotificacaoEstorno::where('usuario_id', $uid)->latest('id')->limit(50)->get()->map(fn (NotificacaoEstorno $n) => [
            'id' => $n->id,
            'tipo' => 'estorno',
            'titulo' => $n->titulo,
            'mensagem' => $n->mensagem,
            'lida' => (bool) $n->lida,
            'estorno_id' => $n->estorno_id,
            'criado_em' => optional($n->created_at)->toIso8601String(),
        ]);

        return response()->json([
            'nao_lidas' => NotificacaoEstorno::where('usuario_id', $uid)->where('lida', false)->count(),
            'data' => $lista,
        ]);
    }

    /** Só a contagem — chamada leve para o número vermelho do ícone. */
    public function contagem(Request $request): JsonResponse
    {
        return response()->json(['nao_lidas' => NotificacaoEstorno::where('usuario_id', $request->user()->id)->where('lida', false)->count()]);
    }

    public function marcarLida(Request $request, int $id): JsonResponse
    {
        NotificacaoEstorno::where('usuario_id', $request->user()->id)->where('id', $id)->update(['lida' => true]);

        return response()->json(['message' => 'ok']);
    }

    public function marcarTodasLidas(Request $request): JsonResponse
    {
        NotificacaoEstorno::where('usuario_id', $request->user()->id)->where('lida', false)->update(['lida' => true]);

        return response()->json(['message' => 'ok']);
    }
}
