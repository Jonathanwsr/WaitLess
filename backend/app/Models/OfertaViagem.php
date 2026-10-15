<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Oferta de venda cruzada disparada a partir de uma reserva de hospedagem (ver CrossSellViagemService). */
class OfertaViagem extends Model
{
    protected $table = 'ofertas_viagem';

    protected $guarded = ['id'];

    protected $casts = [
        'disparar_em' => 'datetime',
        'enviada_em' => 'datetime',
        'clicada_em' => 'datetime',
        'convertida_em' => 'datetime',
    ];

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }

    public function aluguel(): BelongsTo
    {
        return $this->belongsTo(Aluguel::class);
    }
}
