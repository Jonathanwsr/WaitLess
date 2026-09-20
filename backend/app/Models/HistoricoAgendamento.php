<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HistoricoAgendamento extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'agendamento_id',
        'status_anterior',
        'status_novo',
        'alterado_por_id',
        'alterado_por_nome',
        'descricao',
        'created_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    public function agendamento()
    {
        return $this->belongsTo(Agendamento::class);
    }

    public function alteradoPor()
    {
        return $this->belongsTo(User::class, 'alterado_por_id');
    }
}
