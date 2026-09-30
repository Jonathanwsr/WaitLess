<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Saldo de pontos de fidelidade do usuário NESTE estabelecimento específico
 * (distinto do saldo global em `users.pontos_saldo`). Faltava, igual ao
 * `HistoricoPonto` — usado por `HistoricoPontoController::store()` sem a
 * classe existir, derrubando qualquer ajuste manual de pontos com um erro
 * fatal de "Class not found".
 */
class PontoUsuarioEstabelecimento extends Model
{
    protected $table = 'pontos_usuario_estabelecimento';

    protected $fillable = [
        'usuario_id',
        'estabelecimento_id',
        'total_pontos',
        'nivel',
    ];

    public function usuario()
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }

    public function estabelecimento()
    {
        return $this->belongsTo(Estabelecimento::class, 'estabelecimento_id');
    }
}
