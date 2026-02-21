<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Servico extends Model
{
    protected $guarded = ['id'];

   
    protected $casts = [
        'configuracoes' => 'array',
        'ativo' => 'boolean',
        'horarios_disponiveis' => 'array',
    ];

    public function estabelecimento()
    {
        return $this->belongsTo(Estabelecimento::class);
    }

    public function agendamentos()
    {
        return $this->hasMany(Agendamento::class);
    }
}