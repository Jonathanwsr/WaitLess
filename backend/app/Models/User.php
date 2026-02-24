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
    return $this->belongsToMany(
        Estabelecimento::class, 
        'estabelecimento_usuario',
        'usuario_id',             
        'estabelecimento_id'      
    )
    ->withPivot('tipo')
    ->withTimestamps();
}

public function estabelecimentosComoCliente()
{
    
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

public function estabelecimentos()
    {
        return $this->belongsToMany(
            Estabelecimento::class, 
            'estabelecimento_usuario', 
            'usuario_id', 
            'estabelecimento_id'
        )->withPivot('tipo')->withTimestamps();
    }

}
