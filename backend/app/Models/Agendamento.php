<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Agendamento extends Model
{
    
    protected $guarded = ['id'];

   
    protected $casts = [
        'status_pagamento' => 'string',
    ];

    public function usuario()
    {
        return $this->belongsTo(User::class);
    }

    public function estabelecimento()
    {
        return $this->belongsTo(Estabelecimento::class);
    }

    public function servico()
    {
        return $this->belongsTo(Servico::class);
    }

    public function funcionario()
    {
        return $this->belongsTo(Funcionario::class);
    }

 
    public function pagamento()
    {
        return $this->belongsTo(Pagamento::class, 'pagamento_id');
    }

function itemAluguel()
{
    return $this->belongsTo(ItemAluguel::class);
}

}