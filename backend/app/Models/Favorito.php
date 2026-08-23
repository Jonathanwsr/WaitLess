<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Favorito extends Model
{
    // Adicionamos o item_aluguel_id aqui
    protected $fillable = ['usuario_id', 'estabelecimento_id', 'servico_id', 'item_aluguel_id'];

    public function usuario() {
        return $this->belongsTo(User::class);
    }

    public function estabelecimento() {
        return $this->belongsTo(Estabelecimento::class);
    }

    public function servico() {
        return $this->belongsTo(Servico::class);
    }

    // Nova relação para o Aluguel
    public function itemAluguel() {
        return $this->belongsTo(ItemAluguel::class, 'item_aluguel_id'); // Ajuste o nome da classe se for diferente
    }
}