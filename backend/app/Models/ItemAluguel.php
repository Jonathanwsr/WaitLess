<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ItemAluguel extends Model
{
    use SoftDeletes;

    protected $table = 'itens_aluguel';

    protected $guarded = ['id'];

    protected $casts = [
        'disponivel' => 'boolean',
        'ativo' => 'boolean',
        'valor_diaria' => 'decimal:2',
        'valor_semanal' => 'decimal:2',
        'valor_mensal' => 'decimal:2',
        'valor_caucao' => 'decimal:2',
        'mobiliado' => 'boolean',
        'aceita_pet' => 'boolean',
        'possui_wifi' => 'boolean',
        'possui_ar_condicionado' => 'boolean',
        'piscina' => 'boolean',
        'churrasqueira' => 'boolean',
        'possui_seguro' => 'boolean',
        'recursos_oferecidos' => 'array', 
        'acessorios' => 'array',
        'dias_semana_disponiveis' => 'array',
         'dias_mes_disponiveis' => 'array',
         'datas_permitidas' => 'array',
         'datas_bloqueadas' => 'array',
         'horarios_bloqueados' => 'array',
         'sempre_disponivel' => 'boolean',
         'disponibilidade_por_data' => 'boolean',
        'quantidade_padrao'        => 'integer',
        'dias_disponiveis'         => 'array', // Converte o JSON do banco para Array no PHP
        'horarios_disponiveis'     => 'array', // Converte o JSON do banco para Array no PHP
        'valor'                    => 'decimal:2',
        'valor_original'           => 'decimal:2',
        'percentual_desconto'      => 'decimal:2',
    
        'valor_final'              => 'decimal:2',

    ];

    public function estabelecimento(): BelongsTo
    {
        return $this->belongsTo(User::class, 'estabelecimento_id');
    }

    public function alugueis(): HasMany
    {
        return $this->hasMany(Aluguel::class, 'item_aluguel_id');
    }
}