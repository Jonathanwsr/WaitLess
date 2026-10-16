<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Roteiro de viagem dia a dia (Guia do Local + locações do Lokyva + anotações). */
class Roteiro extends Model
{
    protected $table = 'roteiros';

    protected $fillable = [
        'user_id', 'titulo', 'destino', 'estado', 'latitude', 'longitude', 'data_inicio', 'data_fim', 'pessoas',
        'orcamento', 'interesses', 'partida', 'partida_latitude', 'partida_longitude', 'token_compartilhamento',
    ];

    protected $casts = [
        'data_inicio' => 'date',
        'data_fim' => 'date',
        'interesses' => 'array',
        'orcamento' => 'float',
        'latitude' => 'float',
        'longitude' => 'float',
        'partida_latitude' => 'float',
        'partida_longitude' => 'float',
    ];

    protected $hidden = ['token_compartilhamento'];

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function dias(): HasMany
    {
        return $this->hasMany(RoteiroDia::class)->orderBy('numero');
    }

    public function itens(): HasMany
    {
        return $this->hasMany(RoteiroItem::class);
    }

    public function pedidos(): HasMany
    {
        return $this->hasMany(RoteiroPedido::class)->latest();
    }
}
