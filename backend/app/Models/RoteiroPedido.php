<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Pedido único do "Reservar tudo" de um roteiro: agrupa as reservas criadas. */
class RoteiroPedido extends Model
{
    protected $table = 'roteiro_pedidos';

    protected $fillable = ['roteiro_id', 'user_id', 'codigo', 'status', 'total', 'reservas', 'nao_reservados'];

    protected $casts = ['reservas' => 'array', 'nao_reservados' => 'array', 'total' => 'float'];

    public function roteiro(): BelongsTo
    {
        return $this->belongsTo(Roteiro::class);
    }
}
