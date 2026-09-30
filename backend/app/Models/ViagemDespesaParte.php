<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ViagemDespesaParte extends Model
{
    protected $table = 'viagem_despesa_partes';

    protected $guarded = ['id'];

    protected $casts = ['valor' => 'float'];
}
