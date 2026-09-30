<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Assinatura extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'nome_plano',
        'tipo_publico',
        'valor_mensal',
        'gateway_assinatura_id',
        'status',
        'data_inicio',
        'data_vencimento',
        'cancelada_em',
        // Essas 3 colunas já existem na tabela mas nunca tinham sido liberadas
        // pra mass-assignment — qualquer Assinatura::create() com esses campos
        // os descartava em silêncio.
        'ciclo',
        'metodo_pagamento',
        'fatura_id',
    ];

    protected $casts = [
        'data_inicio' => 'datetime',
        'data_vencimento' => 'datetime',
        'cancelada_em' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}