<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Favorito extends Model
{
    protected $fillable = ['usuario_id', 'estabelecimento_id', 'servico_id'];

    public function usuario() {
        return $this->belongsTo(User::class);
    }

    public function estabelecimento() {
        return $this->belongsTo(Estabelecimento::class);
    }

    public function servico() {
        return $this->belongsTo(Servico::class);
    }
}