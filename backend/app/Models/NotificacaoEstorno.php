<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NotificacaoEstorno extends Model
{
    protected $table = 'notificacoes_estorno';

    protected $guarded = ['id'];

    protected $casts = [
        'lida' => 'boolean',
    ];

    public function estorno()
    {
        return $this->belongsTo(Estorno::class);
    }

    public function usuarioDestino()
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }
}