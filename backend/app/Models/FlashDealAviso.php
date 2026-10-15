<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FlashDealAviso extends Model
{
    protected $table = 'flash_deal_avisos';
    protected $guarded = ['id'];

    protected $casts = ['clicado_em' => 'datetime', 'convertido_em' => 'datetime'];

    public function flashDeal(): BelongsTo
    {
        return $this->belongsTo(FlashDeal::class);
    }
}
