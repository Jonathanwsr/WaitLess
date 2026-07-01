<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Contrato extends Model
{
    protected $table = 'contratos';

    protected $guarded = ['id'];

    protected $casts = [
        'assinado' => 'boolean',
        'data_assinatura' => 'datetime',
    ];

    public function aluguel(): BelongsTo
    {
        return $this->belongsTo(Aluguel::class, 'aluguel_id');
    }

    protected $fillable = ['aluguel_id', 'numero_contrato', 'titulo', 'arquivo_pdf', 'hash_documento', 'plataforma_assinatura', 'assinado', 'url_assinatura'];





}