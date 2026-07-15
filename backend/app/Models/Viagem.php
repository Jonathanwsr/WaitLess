<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Viagem extends Model
{
    use HasFactory;

    protected $table = 'viagens';

    protected $fillable = [
        'criador_id',
        'titulo',
        'destino',
        'data_inicio',
        'data_fim',
        'total_dias',
        'quantidade_pessoas',
        'orcamento_limite',
        'gastos_planejados',
        'latitude',
        'longitude',
    ];

    protected $casts = [
        'gastos_planejados' => 'array', // Converte automaticamente JSON do banco para Array do PHP e vice-versa
        'data_inicio' => 'date',
        'data_fim' => 'date',
        'orcamento_limite' => 'decimal:2',
        'latitude' => 'float',
        'longitude' => 'float',
    ];

    /**
     * Retorna o usuário que criou e organiza a viagem.
     */
    public function criador()
    {
        return $this->belongsTo(User::class, 'criador_id');
    }

    /**
     * Retorna todos os membros/amigos que participam desta viagem.
     */
    public function membros()
    {
        return $this->belongsToMany(User::class, 'viagem_usuario', 'viagem_id', 'usuario_id')
            ->withPivot('funcao')
            ->withTimestamps();
    }
}