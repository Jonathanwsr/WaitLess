<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RoteiroItem extends Model
{
    public const PERIODOS = ['manha', 'tarde', 'noite'];
    public const TIPOS = ['ponto_turistico', 'locacao', 'anotacao'];

    protected $table = 'roteiro_itens';

    protected $fillable = [
        'roteiro_id', 'roteiro_dia_id', 'periodo', 'ordem', 'tipo', 'titulo', 'descricao', 'categoria', 'hora',
        'latitude', 'longitude', 'link', 'imagem', 'servico_id', 'item_aluguel_id', 'custo_estimado', 'anotacao',
    ];

    protected $casts = [
        'latitude' => 'float',
        'longitude' => 'float',
        'custo_estimado' => 'float',
    ];

    public function dia(): BelongsTo
    {
        return $this->belongsTo(RoteiroDia::class, 'roteiro_dia_id');
    }

    public function servico(): BelongsTo
    {
        return $this->belongsTo(Servico::class);
    }

    public function itemAluguel(): BelongsTo
    {
        return $this->belongsTo(ItemAluguel::class);
    }
}
