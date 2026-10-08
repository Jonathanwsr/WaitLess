<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ProdutoEntrega extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'produtos_entrega';

    protected $appends = ['valor_final'];

    protected $fillable = [
        'usuario_id',
        'estabelecimento_id',
        'nome',
        'descricao',
        'categoria',
        'marca',
        'unidade_medida',
        'peso_volume',
        'sku',
        'tags',
        'quantidade_minima',
        'aceita_entrega',
        'aceita_retirada',
        'motivo_remocao',
        'valor',
        'tem_promocao',
        'valor_promocional',
        'taxa_entrega',
        'estoque_disponivel',
        'ativo',
        'fotos',
        'endereco_cep',
        'endereco_rua',
        'endereco_numero',
        'endereco_complemento',
        'endereco_bairro',
        'endereco_cidade',
        'endereco_estado',
        'endereco_latitude',
        'endereco_longitude',
    ];

    protected $casts = [
        'fotos' => 'array',
        'tags' => 'array',
        'aceita_entrega' => 'boolean',
        'aceita_retirada' => 'boolean',
        'ativo' => 'boolean',
        'tem_promocao' => 'boolean',
        'valor' => 'decimal:2',
        'valor_promocional' => 'decimal:2',
        'taxa_entrega' => 'decimal:2',
        'endereco_latitude' => 'decimal:8',
        'endereco_longitude' => 'decimal:8',
    ];

    /** Preço final — o promocional quando ativo e menor que o normal, senão o valor cheio. */
    public function getValorFinalAttribute(): float
    {
        if ($this->tem_promocao && $this->valor_promocional !== null && (float) $this->valor_promocional < (float) $this->valor) {
            return (float) $this->valor_promocional;
        }
        return (float) $this->valor;
    }

    public function vendedor()
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }

    public function estabelecimento()
    {
        return $this->belongsTo(Estabelecimento::class);
    }

    public function pedidos()
    {
        return $this->hasMany(PedidoEntrega::class, 'produto_entrega_id');
    }

    /** Só existe quando o vendedor cadastrou a carteira Asaas — sem ela não há compra online. */
    public function vendedorComCarteira()
    {
        return $this->hasOne(Provider::class, 'user_id', 'usuario_id')->whereNotNull('asaas_wallet_id');
    }
}
