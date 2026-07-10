<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Pagamento extends Model
{
    protected $guarded = ['id'];

   
    protected $casts = [
        'data_pagamento' => 'datetime',
        'valor_total',
    'taxa_plataforma',
    'valor_prestador',
    'status_repasse',
    'data_liberacao_repasse',
    ];

    public function usuario()
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }

    public function estabelecimento()
    {
        return $this->belongsTo(Estabelecimento::class);
    }

    public function agendamento()
    {
        return $this->belongsTo(Agendamento::class);
    }
}
