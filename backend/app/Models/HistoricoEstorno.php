<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HistoricoEstorno extends Model
{
    protected $table = 'historico_estornos';

    protected $guarded = ['id'];

    public function estorno()
    {
        return $this->belongsTo(Estorno::class);
    }

    public function usuario()
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }
}