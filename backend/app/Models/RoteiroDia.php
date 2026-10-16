<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RoteiroDia extends Model
{
    protected $table = 'roteiro_dias';

    protected $fillable = ['roteiro_id', 'numero', 'data'];

    protected $casts = ['data' => 'date'];

    public function roteiro(): BelongsTo
    {
        return $this->belongsTo(Roteiro::class);
    }

    public function itens(): HasMany
    {
        return $this->hasMany(RoteiroItem::class)->orderByRaw("CASE periodo WHEN 'manha' THEN 0 WHEN 'tarde' THEN 1 ELSE 2 END")->orderBy('ordem');
    }
}
