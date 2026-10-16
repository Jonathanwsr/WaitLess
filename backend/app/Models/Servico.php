<?php

namespace App\Models;
use Illuminate\Database\Eloquent\SoftDeletes;

use Illuminate\Database\Eloquent\Model;

class Servico extends Model
{

      use SoftDeletes, \App\Models\Concerns\NomeEmMaiusculas;

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
        'atende_24h' => 'boolean',
        'taxa_deslocamento' => 'decimal:2',
        'raio_atendimento_km' => 'integer',
        'tempo_chegada_minutos' => 'integer',
        'garantia_dias' => 'integer',
    ];

    /** Onde atende, 24h, taxa, tipo de preço, selos... — vai junto em toda tela que mostra o serviço. */
    protected $appends = ['atendimento'];

    public function getAtendimentoAttribute(): array
    {
        return \App\Support\CamposServico::paraTela($this);
    }

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