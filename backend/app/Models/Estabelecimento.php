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


    public function scopeWithinDistance($query, $lat, $lng, $radius)
    {
        // A fórmula matemática pura
        $haversine = "(6371 * acos(cos(radians(?)) 
                        * cos(radians(latitude)) 
                        * cos(radians(longitude) - radians(?)) 
                        + sin(radians(?)) 
                        * sin(radians(latitude))))";

        return $query->select('*')
            // O selectRaw precisa de 3 parâmetros ($lat, $lng, $lat) para calcular e exibir a distância
            ->selectRaw("{$haversine} AS distancia", [$lat, $lng, $lat])
            ->where('ativo', true)
            // O whereRaw substitui o having. Precisamos passar os 3 parâmetros do cálculo + 1 do raio
            ->whereRaw("{$haversine} <= ?", [$lat, $lng, $lat, $radius])
            ->orderBy('distancia', 'asc');
    }
}