<?php

namespace App\Models;

use App\Models\Estorno;
use Illuminate\Database\Eloquent\Model;

class Pagamento extends Model
{
    protected $guarded = ['id'];

    // CORREÇÃO: O array casts precisa do formato 'campo' => 'tipo'
    protected $casts = [
        'data_pagamento' => 'datetime',
        'data_liberacao_repasse' => 'datetime',
        'valor_total' => 'decimal:2',
        'taxa_plataforma' => 'decimal:2',
        'valor_prestador' => 'decimal:2',
    ];

    public function usuario()
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }

    public function estabelecimento()
    {
        return $this->belongsTo(Estabelecimento::class);
    }

    public function agendamento()
    {
        return $this->belongsTo(Agendamento::class);
    }

    public function estorno()
    {
        return $this->hasOne(Estorno::class, 'pagamento_id');
    }

    // ==========================================
    // 🐛 RELACIONAMENTOS ADICIONADOS
    // ==========================================

    public function servico()
    {
        return $this->belongsTo(Servico::class, 'servico_id');
    }

    public function itemAluguel()
    {
        return $this->belongsTo(ItemAluguel::class, 'item_aluguel_id');
    }
}