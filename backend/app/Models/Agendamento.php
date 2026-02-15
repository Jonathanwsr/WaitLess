<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Agendamento extends Model
{
    protected $guarded = ['id'];

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
        return $this->hasOne(Pagamento::class);
    }
}
