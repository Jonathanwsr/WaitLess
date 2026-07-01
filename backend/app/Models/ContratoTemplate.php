<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ContratoTemplate extends Model
{
    use HasFactory;

    protected $fillable = [
        'estabelecimento_id',
        'titulo',
        'conteudo',
        'tipo_reserva',
        'padrao'
    ];

    public function estabelecimento()
    {
        return $this->belongsTo(Estabelecimento::class);
    }
}