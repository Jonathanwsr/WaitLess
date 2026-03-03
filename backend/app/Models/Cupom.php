<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Cupom extends Model
{
    use HasFactory;

    protected $table = 'cupons';

    protected $fillable = [
        'estabelecimento_id',
        'codigo',
        'titulo',
        'descricao',
        'tipo_desconto',
        'valor_desconto',
        'pontos_custo',
        'apenas_plus',
        'data_validade',
        'ativo',
    ];

    protected $casts = [
        'apenas_plus' => 'boolean',
        'ativo' => 'boolean',
        'data_validade' => 'datetime',
    ];

    public function estabelecimento()
    {
        return $this->belongsTo(Estabelecimento::class);
    }
}