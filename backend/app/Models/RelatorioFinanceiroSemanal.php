<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RelatorioFinanceiroSemanal extends Model
{
    protected $table = 'relatorios_financeiros_semanais';

    protected $guarded = ['id'];

    protected $casts = [
        'semana_inicio' => 'date',
        'semana_fim' => 'date',
        'enviado_em' => 'datetime',
        'receita_agendamentos' => 'decimal:2',
        'receita_alugueis_estabelecimento' => 'decimal:2',
        'receita_locacoes_avulsas' => 'decimal:2',
        'receita_bruta_total' => 'decimal:2',
        'taxa_plataforma_total' => 'decimal:2',
        'receita_liquida_total' => 'decimal:2',
    ];

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }
}
