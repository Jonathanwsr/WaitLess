<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Avaliacao extends Model
{
    protected $table = 'avaliacoes'; 
    
    protected $guarded = ['id'];

    protected $casts = [
        'publica' => 'boolean',
        'fotos' => 'array', // Garante que o JSON de fotos seja convertido para array automaticamente
    ];

    public function usuario()
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }

    public function estabelecimento()
    {
        return $this->belongsTo(Estabelecimento::class, 'estabelecimento_id');
    }

    public function agendamento()
    {
        return $this->belongsTo(Agendamento::class, 'agendamento_id');
    }

    // Adicionado para resolver o erro "Call to undefined relationship [aluguel]"
    public function aluguel()
    {
        return $this->belongsTo(Aluguel::class, 'aluguel_id');
    }
}