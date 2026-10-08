<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HorarioFuncionamento extends Model
{
    protected $table = 'horarios_funcionamento';

    protected $fillable = [
        'estabelecimento_id',
        'dia_semana',
        'hora_abertura',
        'hora_fechamento',
        'fechado',
    ];

    protected $casts = [
        'fechado' => 'boolean',
        'dia_semana' => 'integer',
    ];

    public const DIAS = [
        0 => 'Domingo',
        1 => 'Segunda-feira',
        2 => 'Terça-feira',
        3 => 'Quarta-feira',
        4 => 'Quinta-feira',
        5 => 'Sexta-feira',
        6 => 'Sábado',
    ];

    public function estabelecimento()
    {
        return $this->belongsTo(Estabelecimento::class);
    }
}
