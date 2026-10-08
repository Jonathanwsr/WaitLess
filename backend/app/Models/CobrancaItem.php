<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Um serviço ou uma reserva dentro de uma cobrança, com o funcionário que vai fazer o trabalho. */
class CobrancaItem extends Model
{
    protected $table = 'cobranca_itens';

    protected $guarded = ['id'];

    protected $casts = [
        'valor' => 'decimal:2',
        'data_referencia' => 'datetime',
    ];

    public function cobranca(): BelongsTo
    {
        return $this->belongsTo(Cobranca::class);
    }

    public function servico(): BelongsTo
    {
        return $this->belongsTo(Servico::class);
    }

    public function agendamento(): BelongsTo
    {
        return $this->belongsTo(Agendamento::class);
    }

    public function funcionario(): BelongsTo
    {
        return $this->belongsTo(Funcionario::class);
    }
}
