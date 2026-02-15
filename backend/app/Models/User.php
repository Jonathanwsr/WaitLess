<?php

namespace App\Models;

use Laravel\Sanctum\HasApiTokens;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use HasApiTokens, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'papel', 
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    public function estabelecimentosGerenciados()
{
    // Estabelecimentos onde ele é dono/admin (Tabela Pivô)
    return $this->belongsToMany(Estabelecimento::class, 'estabelecimento_usuario')
                ->withPivot('tipo')
                ->withTimestamps();
}

public function estabelecimentosComoCliente()
{
    // Estabelecimentos que ele frequenta
    return $this->belongsToMany(Estabelecimento::class, 'cliente_estabelecimento')
                ->withTimestamps();
}

public function agendamentos()
{
    return $this->hasMany(Agendamento::class);
}

public function pontos()
{
    return $this->hasMany(PontoUsuarioEstabelecimento::class);
}

}
