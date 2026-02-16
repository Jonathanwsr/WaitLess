<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Estabelecimento extends Model
{
    protected $guarded = ['id'];

    public function proprietarios()
{
    return $this->belongsToMany(
        User::class, 
        'estabelecimento_usuario', 
        'estabelecimento_id',       
        'usuario_id'               
    )->withPivot('tipo')->withTimestamps();
}

    public function clientes()
    {
        return $this->belongsToMany(User::class, 'cliente_estabelecimento')
                    ->withTimestamps();
    }

    public function funcionarios()
    {
        return $this->hasMany(Funcionario::class);
    }

    public function servicos()
    {
        return $this->hasMany(Servico::class);
    }

    public function agendamentos()
    {
        return $this->hasMany(Agendamento::class);
    }

    public function descontos()
    {
        return $this->hasMany(Desconto::class);
    }

    public function avaliacoes()
    {
        return $this->hasMany(Avaliacao::class);
    }
}
