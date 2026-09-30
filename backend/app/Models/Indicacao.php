<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Indicacao extends Model
{
    protected $table = 'indicacoes';

    protected $guarded = ['id'];

    protected $casts = ['recompensada_em' => 'datetime'];

    public function indicador()
    {
        return $this->belongsTo(User::class, 'indicador_id');
    }

    public function indicado()
    {
        return $this->belongsTo(User::class, 'indicado_id');
    }
}
