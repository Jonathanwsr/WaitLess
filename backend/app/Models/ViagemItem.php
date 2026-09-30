<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ViagemItem extends Model
{
    protected $table = 'viagem_itens';

    protected $guarded = ['id'];

    protected $casts = [
        'dia' => 'date:Y-m-d',
        'data_fim' => 'date:Y-m-d',
        'custo_estimado' => 'float',
        'distancia_km' => 'float',
        'latitude' => 'float',
        'longitude' => 'float',
        'score' => 'float',
        'destaque_premium' => 'boolean',
    ];

    public function viagem()
    {
        return $this->belongsTo(Viagem::class);
    }

    public function presencas()
    {
        return $this->hasMany(ViagemItemPresenca::class, 'viagem_item_id');
    }

    public function reservadoPor()
    {
        return $this->belongsTo(User::class, 'reservado_por_id');
    }

    public function agendamento()
    {
        return $this->belongsTo(Agendamento::class);
    }

    public function aluguel()
    {
        return $this->belongsTo(Aluguel::class);
    }
}
