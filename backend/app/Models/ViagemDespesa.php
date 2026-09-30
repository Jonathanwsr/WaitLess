<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ViagemDespesa extends Model
{
    protected $table = 'viagem_despesas';

    protected $guarded = ['id'];

    protected $casts = [
        'valor' => 'float',
        'data_despesa' => 'date:Y-m-d',
    ];

    public function viagem()
    {
        return $this->belongsTo(Viagem::class);
    }

    public function pagador()
    {
        return $this->belongsTo(User::class, 'pagador_id');
    }

    public function partes()
    {
        return $this->hasMany(ViagemDespesaParte::class, 'viagem_despesa_id');
    }

    public function item()
    {
        return $this->belongsTo(ViagemItem::class, 'viagem_item_id');
    }
}
