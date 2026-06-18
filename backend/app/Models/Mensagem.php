<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Mensagem extends Model
{
    // Define explicitamente o nome correto da tabela no banco de dados
    protected $table = 'mensagens';

    protected $guarded = [];

    protected $casts = [
        'lida_em' => 'datetime',
    ];

    public function conversa()
    {
        return $this->belongsTo(Conversa::class);
    }
}