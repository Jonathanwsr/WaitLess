<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class ExtratoProvider extends Model
{
    // Define explicitamente o nome da tabela caso saia do padrão do Laravel
    protected $table = 'extrato_providers';

    /**
     * Atributos que podem ser atribuídos em massa (Mass Assignment).
     */
    protected $fillable = [
        'provider_id',
        'usuario_id',
        'origem_type',
        'origem_id',
        'tipo',
        'valor_bruto',
        'taxa_plataforma',
        'valor_liquido',
        'descricao',

        // Novos campos
        'status',
        'data_liberacao',
        'codigo_transacao',
        'metodo_pagamento',
        'metadata',
    ];

    /**
     * Casts para garantir a tipagem correta dos valores ao retornar do banco.
     */
    protected $casts = [
        'valor_bruto' => 'float',
        'taxa_plataforma' => 'float',
        'valor_liquido' => 'float',

        'metadata' => 'array',
        'created_at' => 'datetime',
        'data_liberacao' => 'datetime',
    ];

    /**
     * Relacionamento com o Provedor/Dono da carteira.
     * Cada linha do extrato pertence a um registro na tabela providers.
     */
    public function provider(): BelongsTo
    {
        return $this->belongsTo(Provider::class, 'provider_id');
    }

    /**
     * Relacionamento com o Cliente que realizou o pagamento.
     * Mapeia quem gerou aquela receita para o estabelecimento.
     */
    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }

    /**
     * Relacionamento Polimórfico Dinâmico.
     *
     * Este método lê automaticamente as colunas
     * 'origem_type' e 'origem_id'.
     *
     * Exemplos:
     * - App\Models\Agendamento
     * - App\Models\Aluguel
     * - App\Models\Reserva
     * - App\Models\ItemAluguel
     *
     * Uso:
     * $extrato->origem
     */


    public function extratos()
{
    return $this->hasMany(ExtratoProvider::class, 'provider_id')->latest();
}


    public function origem(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * Verifica se a movimentação é um crédito.
     */
    public function isCredito(): bool
    {
        return $this->tipo === 'credito';
    }

    /**
     * Verifica se a movimentação é um débito.
     */
    public function isDebito(): bool
    {
        return $this->tipo === 'debito';
    }

    /**
     * Verifica se o valor já está liberado para saque.
     */
    public function isLiberado(): bool
    {
        return $this->status === 'liberado';
    }

    /**
     * Verifica se a movimentação foi estornada.
     */
    public function isEstornado(): bool
    {
        return $this->status === 'estornado';
    }

    /**
     * Verifica se a movimentação está pendente.
     */
    public function isPendente(): bool
    {
        return $this->status === 'pendente';
    }
}