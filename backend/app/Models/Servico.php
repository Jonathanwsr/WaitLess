<?php

namespace App\Models;
use Illuminate\Database\Eloquent\SoftDeletes;

use Illuminate\Database\Eloquent\Model;

class Servico extends Model
{

      use SoftDeletes; 
      
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

    public function favoritadoPor() {
    return $this->hasMany(Favorito::class);
}
}