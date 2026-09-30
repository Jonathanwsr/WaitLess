<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Ficha de triagem: perguntas respondidas pelo cliente antes de um atendimento (serviço)
 * ou de uma reserva (aluguel), que o responsável analisa e aprova ou recusa.
 */
class Triagem extends Model
{
    protected $table = 'triagens';

    protected $guarded = ['id'];

    protected $casts = ['decidida_em' => 'datetime'];

    public function respostas()
    {
        return $this->hasMany(RespostaTriagem::class, 'triagem_id');
    }

    public function usuario()
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }

    public function agendamento()
    {
        return $this->belongsTo(Agendamento::class);
    }

    public function aluguel()
    {
        return $this->belongsTo(Aluguel::class);
    }
}
