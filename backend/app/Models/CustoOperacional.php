<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CustoOperacional extends Model
{
    protected $table = 'custos_operacionais';

    protected $guarded = ['id'];

    protected $casts = [
        'valor' => 'decimal:2',
        'competencia' => 'date',
        'recorrente' => 'boolean',
    ];

    const CATEGORIAS = [
        'api_externa' => 'API externa',
        'email' => 'E-mail transacional',
        'ia' => 'Inteligência artificial',
        'hospedagem' => 'Hospedagem / infraestrutura',
        'outro' => 'Outro',
    ];

    public function criador()
    {
        return $this->belongsTo(User::class, 'criado_por');
    }
}
