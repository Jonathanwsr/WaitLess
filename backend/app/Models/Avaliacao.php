<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Avaliacao extends Model
{
  
    protected $table = 'avaliacoes'; 
    
    protected $guarded = ['id'];

    protected $casts = [
        'publica' => 'boolean',
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