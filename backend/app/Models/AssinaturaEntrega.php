<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AssinaturaEntrega extends Model
{
    protected $table = 'assinaturas_entrega';

    protected $fillable = [
        'cliente_id', 'produto_entrega_id', 'quantidade', 'modo_recebimento', 'modo_pagamento',
        'frequencia_dias', 'proxima_entrega_em', 'endereco', 'status',
    ];

    protected $casts = ['proxima_entrega_em' => 'date', 'endereco' => 'array'];

    public function produto()
    {
        return $this->belongsTo(ProdutoEntrega::class, 'produto_entrega_id');
    }

    public function cliente()
    {
        return $this->belongsTo(User::class, 'cliente_id');
    }
}
