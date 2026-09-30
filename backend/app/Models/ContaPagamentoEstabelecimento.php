<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ContaPagamentoEstabelecimento extends Model
{
    protected $table = 'contas_pagamento_estabelecimento';

    protected $fillable = [
        'estabelecimento_id',
        'gateway',
        'id_conta_gateway',
        'chave_pix',
        'ativo',
    ];

    protected $casts = [
        'ativo' => 'boolean',
    ];

    public function estabelecimento(): BelongsTo
    {
        return $this->belongsTo(Estabelecimento::class);
    }
}
