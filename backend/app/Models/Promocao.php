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
        'servico_id',
        'item_aluguel_id',
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

    /** Serviço que esta promoção destaca (opcional, mutuamente exclusivo com itemAluguel). */
    public function servico()
    {
        return $this->belongsTo(Servico::class);
    }

    /** Item de aluguel que esta promoção destaca (opcional, mutuamente exclusivo com servico). */
    public function itemAluguel()
    {
        return $this->belongsTo(ItemAluguel::class, 'item_aluguel_id');
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

    /**
     * Dados do card de navegação quando a promoção está vinculada a um
     * serviço ou item de aluguel ativo — null se não houver vínculo ou o
     * item vinculado não estiver mais ativo, pra nunca gerar um card morto
     * no Explorar/Promoções (web e mobile).
     */
    public function vinculoCard(): ?array
    {
        if ($this->servico_id && $this->servico && $this->servico->ativo) {
            return [
                'tipo' => 'servico',
                'id' => $this->servico->id,
                'nome' => $this->servico->nome,
                'estabelecimento_id' => $this->servico->estabelecimento_id,
                'foto' => json_decode($this->servico->fotos ?? '[]', true)[0] ?? null,
            ];
        }

        if ($this->item_aluguel_id && $this->itemAluguel && $this->itemAluguel->ativo) {
            return [
                'tipo' => 'item_aluguel',
                'id' => $this->itemAluguel->id,
                'nome' => $this->itemAluguel->nome,
                'foto' => json_decode($this->itemAluguel->fotos ?? '[]', true)[0] ?? null,
            ];
        }

        return null;
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
