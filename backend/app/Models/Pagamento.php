<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Pagamento extends Model
{
    protected $guarded = ['id'];

    // Garante que o Laravel trate esse campo como um objeto Carbon (Data/Hora)
    protected $casts = [
        'data_pagamento' => 'datetime',
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
