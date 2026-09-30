<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ViagemPagamento extends Model
{
    protected $table = 'viagem_pagamentos';

    protected $guarded = ['id'];

    protected $casts = ['valor' => 'float'];
}
