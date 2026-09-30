<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Promocao extends Model
{
    use HasFactory;

    protected $table = 'promocoes';

    protected $fillable = [
        'nome',
        'descricao',
        'tipo',
        'quantidade_pontos',
        'cupom_id',
        'desconto_percentual',
        'desconto_valor',
        'publico_alvo',
        'plano_necessario',
        'data_inicio',
        'data_fim',
        'limite_utilizacao',
        'utilizacoes_atuais',
        'ativo',
        'condicoes',
        'imagem',
        'executada_em',
        'criado_por',
    ];

    protected $casts = [
        'ativo' => 'boolean',
        'data_inicio' => 'date',
        'data_fim' => 'date',
        'executada_em' => 'datetime',
        'desconto_percentual' => 'decimal:2',
        'desconto_valor' => 'decimal:2',
    ];

    public function cupom()
    {
        return $this->belongsTo(Cupom::class);
    }

    public function criador()
    {
        return $this->belongsTo(User::class, 'criado_por');
    }

    /**
     * Status calculado a partir das datas e do limite — nunca exibir como
     * disponível uma promoção expirada ou esgotada.
     */
    public function getStatusCalculadoAttribute(): string
    {
        if (!$this->ativo) {
            return 'inativa';
        }
        if ($this->data_fim && now()->toDateString() > $this->data_fim->toDateString()) {
            return 'expirada';
        }
        if (now()->toDateString() < $this->data_inicio->toDateString()) {
            return 'agendada';
        }
        if ($this->limite_utilizacao && $this->utilizacoes_atuais >= $this->limite_utilizacao) {
            return 'esgotada';
        }
        return 'ativa';
    }

    public function scopeVigentes($query)
    {
        return $query->where('ativo', true)
            ->where('data_inicio', '<=', now()->toDateString())
            ->where(function ($q) {
                $q->whereNull('data_fim')->orWhere('data_fim', '>=', now()->toDateString());
            })
            ->where(function ($q) {
                $q->whereNull('limite_utilizacao')->orWhereColumn('utilizacoes_atuais', '<', 'limite_utilizacao');
            });
    }
}
