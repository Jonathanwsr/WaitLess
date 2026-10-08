<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CarrinhoProdutoEntrega extends Model
{
    protected $table = 'carrinho_produtos_entrega';

    protected $fillable = ['user_id', 'produto_entrega_id', 'quantidade'];

    public function usuario()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function produto()
    {
        return $this->belongsTo(ProdutoEntrega::class, 'produto_entrega_id');
    }
}
