<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Oferta relâmpago: desconto por tempo curto em vagas ociosas, avisada a quem está na cidade. */
class FlashDeal extends Model
{
    protected $table = 'flash_deals';
    protected $guarded = ['id'];

    protected $casts = [
        'inicia_em' => 'datetime',
        'expira_em' => 'datetime',
        'promocao_anterior' => 'array',
        'latitude' => 'float',
        'longitude' => 'float',
    ];

    public function criador(): BelongsTo
    {
        return $this->belongsTo(User::class, 'criado_por');
    }

    public function avisos(): HasMany
    {
        return $this->hasMany(FlashDealAviso::class);
    }

    public function estaAtivo(): bool
    {
        return $this->status === 'ativo' && $this->expira_em->isFuture() && $this->usados < $this->quantidade;
    }
}
