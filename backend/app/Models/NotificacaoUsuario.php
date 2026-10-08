<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NotificacaoUsuario extends Model
{
    protected $table = 'notificacoes_usuario';

    protected $fillable = ['usuario_id', 'titulo', 'mensagem', 'lida_em'];

    protected $casts = ['lida_em' => 'datetime'];

    public static function avisar(int $usuarioId, string $titulo, string $mensagem): void
    {
        self::create(['usuario_id' => $usuarioId, 'titulo' => $titulo, 'mensagem' => $mensagem]);
    }
}
