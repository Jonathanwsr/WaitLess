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
        'servico_id',
        'item_aluguel_id',
        'codigo',
        'titulo',
        'descricao',
        'tipo_desconto',
        'valor_desconto',
        'pontos_custo',
        'apenas_plus',
        'somente_novos_clientes',
        'data_validade',
        'ativo',
    ];

    protected $casts = [
        'apenas_plus' => 'boolean',
        'somente_novos_clientes' => 'boolean',
        'ativo' => 'boolean',
        'data_validade' => 'datetime',
    ];

    public function servico()
    {
        return $this->belongsTo(Servico::class);
    }

    public function itemAluguel()
    {
        return $this->belongsTo(ItemAluguel::class, 'item_aluguel_id');
    }

    /** 'local' (todo o estabelecimento), 'servico' ou 'reserva'. */
    public function getEscopoAttribute(): string
    {
        return $this->servico_id ? 'servico' : ($this->item_aluguel_id ? 'reserva' : 'local');
    }

    public function estabelecimento()
    {
        return $this->belongsTo(Estabelecimento::class);
    }
}