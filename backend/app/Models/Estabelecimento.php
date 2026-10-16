<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class Estabelecimento extends Model
{
    
    protected $guarded = ['id'];

    /** Sem coordenadas, o local fica fora das buscas por distância: completa a partir do endereço, depois da resposta. */
    protected static function booted(): void
    {
        static::saved(function (Estabelecimento $e) {
            if ((!$e->latitude || !$e->longitude) && $e->cidade && app(\App\Services\GeocodificacaoService::class)->ativo()) {
                dispatch(fn () => app(\App\Services\GeocodificacaoService::class)->preencherEstabelecimento($e->fresh() ?? $e))->afterResponse();
            }
        });
    }

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

    /** Soma dos produtos vendidos por todos os sócios/equipe vinculados ao local. */
    public function produtosVendidos(): int
    {
        return (int) User::whereIn('id', DB::table('estabelecimento_usuario')
            ->where('estabelecimento_id', $this->id)
            ->select('usuario_id'))
            ->sum('produtos_vendidos');
    }

    public function horariosFuncionamento()
    {
        return $this->hasMany(HorarioFuncionamento::class)->orderBy('dia_semana');
    }

    public function servicos()
    {
        return $this->hasMany(Servico::class);
    }

    public function agendamentos()
    {
        return $this->hasMany(Agendamento::class);
    }

    /** Reservas do catálogo deste local (o item guarda o local em local_id e o dono em estabelecimento_id). */
    public function itensAluguel()
    {
        return $this->hasMany(ItemAluguel::class, 'local_id');
    }

    public function produtos()
{
    // Se estiver 'promocao', mude para 'is_promocao'
    return $this->hasMany(Produto::class)
                ->orderBy('is_promocao', 'desc') 
                ->orderBy('nome', 'asc');
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


    public function getEnderecoCompletoAttribute(): ?string
    {
        $linhaRua = collect([$this->rua, $this->numero])->filter()->implode(', ');
        $cidadeEstado = collect([$this->cidade, $this->estado])->filter()->implode('/');

        return collect([$linhaRua, $this->bairro, $cidadeEstado])->filter()->implode(' - ') ?: null;
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