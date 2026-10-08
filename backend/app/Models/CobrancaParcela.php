<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Uma parcela de uma cobrança. Online tem uma cobrança correspondente no Asaas (asaas_payment_id). */
class CobrancaParcela extends Model
{
    public const PENDENTE = 'pendente';
    public const PAGO = 'pago';
    public const ATRASADO = 'atrasado';
    public const CANCELADO = 'cancelado';
    public const ESTORNADO = 'estornado';

    protected $table = 'cobranca_parcelas';

    protected $guarded = ['id'];

    protected $casts = [
        'valor' => 'decimal:2',
        'vencimento' => 'date',
        'pago_em' => 'datetime',
        'baixa_manual' => 'boolean',
    ];

    /** Não mostrar o link do Asaas para quem não é o cliente — o controller decide quando expor. */
    protected $hidden = ['asaas_payment_id'];

    public function cobranca(): BelongsTo
    {
        return $this->belongsTo(Cobranca::class);
    }

    public function emAberto(): bool
    {
        return in_array($this->status, [self::PENDENTE, self::ATRASADO], true);
    }
}
