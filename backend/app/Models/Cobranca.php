<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Cobrança parcelada que um sócio premium envia a um cliente (serviços e/ou reserva). */
class Cobranca extends Model
{
    public const STATUS_AGUARDANDO = 'aguardando_aceite';
    public const STATUS_ACEITA = 'aceita';
    public const STATUS_RECUSADA = 'recusada';
    public const STATUS_CANCELADA = 'cancelada';
    public const STATUS_QUITADA = 'quitada';

    public const MODO_ONLINE = 'online';
    public const MODO_PRESENCIAL = 'presencial';

    protected $table = 'cobrancas';

    protected $guarded = ['id'];

    protected $casts = [
        'valor_total' => 'decimal:2',
        'taxa_percentual' => 'decimal:2',
        'aceita_em' => 'datetime',
        'recusada_em' => 'datetime',
        'cancelada_em' => 'datetime',
    ];

    public function estabelecimento(): BelongsTo
    {
        return $this->belongsTo(Estabelecimento::class);
    }

    public function criador(): BelongsTo
    {
        return $this->belongsTo(User::class, 'criado_por_usuario_id');
    }

    public function cliente(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cliente_id');
    }

    public function itens(): HasMany
    {
        return $this->hasMany(CobrancaItem::class)->orderBy('id');
    }

    public function parcelas(): HasMany
    {
        return $this->hasMany(CobrancaParcela::class)->orderBy('numero');
    }
}
