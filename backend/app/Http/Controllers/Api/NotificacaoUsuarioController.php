<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\NotificacaoUsuario;
use Illuminate\Support\Facades\Auth;

class NotificacaoUsuarioController extends Controller
{
    public function marcarLido(NotificacaoUsuario $notificacao)
    {
        abort_unless((int) $notificacao->usuario_id === (int) Auth::id(), 403);

        $notificacao->update(['lida_em' => now()]);

        return request()->wantsJson() ? response()->json(['message' => 'Aviso marcado como lido.']) : back();
    }

    public function listar()
    {
        return response()->json([
            'avisos' => NotificacaoUsuario::where('usuario_id', Auth::id())
                ->whereNull('lida_em')
                ->latest()
                ->limit(20)
                ->get(['id', 'titulo', 'mensagem', 'created_at']),
        ]);
    }
}
