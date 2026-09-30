<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Sugestao extends Model
{
    protected $table = 'sugestoes';

    protected $fillable = [
        'usuario_id',
        'categoria',
        'texto',
        'status',
        'resposta_admin',
        'pontos_concedidos',
    ];

    public function usuario()
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }
}
