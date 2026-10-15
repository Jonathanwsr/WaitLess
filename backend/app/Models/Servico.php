<?php

namespace App\Models;
use Illuminate\Database\Eloquent\SoftDeletes;

use Illuminate\Database\Eloquent\Model;

class Servico extends Model
{

      use SoftDeletes;

    protected $guarded = ['id'];


    protected $casts = [
        'configuracoes' => 'array',
        'ativo' => 'boolean',
        'horarios_disponiveis' => 'array',
        'somente_premium' => 'boolean',
        'tem_promocao' => 'boolean',
        'valor_desconto' => 'decimal:2',
        'aceita_pontos' => 'boolean',
        'maximo_pontos_permitidos' => 'integer',
    ];

    public function estabelecimento()
    {
        return $this->belongsTo(Estabelecimento::class);
    }

    /** Sem horários fixos: o cliente combina o horário direto com o dono (chat ou telefone). */
    public function horarioACombinar(): bool
    {
        $cfg = $this->configuracoes;
        if (is_string($cfg)) {
            $cfg = json_decode($cfg, true);
        }

        return is_array($cfg) && !empty($cfg['horario_a_combinar']);
    }

    public function agendamentos()
    {
        return $this->hasMany(Agendamento::class);
    }

    public function favoritadoPor() {
    return $this->hasMany(Favorito::class);
}

    public function produtosVinculados()
    {
        return $this->hasMany(Produto::class, 'servico_id');
    }
}