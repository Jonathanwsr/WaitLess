<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MensagemEstorno extends Model
{
    protected $table = 'mensagens_estorno';

    protected $guarded = ['id'];

    protected $casts = [
        'visualizada' => 'boolean',
    ];

    public function estorno()
    {
        return $this->belongsTo(Estorno::class);
    }

    // Quem enviou a mensagem (pode ser o cliente, admin ou o dono do local)
    public function remetente()
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }

    // Se a mensagem foi respondida por um funcionário do estabelecimento em nome do dono
    public function funcionario()
    {
        return $this->belongsTo(User::class, 'funcionario_id');
    }
}