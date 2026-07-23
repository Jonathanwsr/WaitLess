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

    public function cupons() 
    
    { return $this->hasMany(Cupom::class); 
    }


    public function scopeWithinDistance($query, $latitude, $longitude, $radius = 10)
    {
        // Raio da Terra em km
        $earthRadius = 6371;

        return $query->selectRaw(
            "*, ( $earthRadius * acos( cos( radians(?) ) * cos( radians( latitude ) ) * cos( radians( longitude ) - radians(?) ) + sin( radians(?) ) * sin( radians( latitude ) ) ) ) AS distance",
            [$latitude, $longitude, $latitude]
        )
        ->having('distance', '<', $radius)
        ->orderBy('distance', 'asc');
    }

    public function favoritadoPor() {
    return $this->hasMany(Favorito::class);
}
}