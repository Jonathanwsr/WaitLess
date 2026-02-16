<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Desconto extends Model
{
    protected $guarded = ['id'];

  
    protected $casts = [
        'data_inicio' => 'date',
        'data_fim' => 'date',
        'ativo' => 'boolean',
    ];

    public function estabelecimento()
    {
        return $this->belongsTo(Estabelecimento::class);
    }
}
