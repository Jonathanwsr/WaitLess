<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RespostaTriagem extends Model
{
    protected $table = 'respostas_triagem';

    protected $guarded = ['id'];

    public function triagem()
    {
        return $this->belongsTo(Triagem::class, 'triagem_id');
    }
}
