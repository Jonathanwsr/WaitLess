<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AvaliacaoProdutoEntrega extends Model
{
    protected $table = 'avaliacoes_produto_entrega';

    protected $fillable = ['pedido_entrega_id', 'cliente_id', 'produto_entrega_id', 'vendedor_id', 'nota_produto', 'nota_vendedor', 'comentario'];
}
