<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Viagem extends Model
{
    use HasFactory;

    protected $table = 'viagens';

    protected $fillable = [
        'criador_id',
        'titulo',
        'destino',
        'descricao',
        'data_inicio',
        'data_fim',
        'total_dias',
        'quantidade_pessoas',
        'orcamento_limite',
        'gastos_planejados',
        'latitude',
        'longitude',
        'cidade',
        'estado',
        'codigo_convite',
        'preferencias',
        'status',
    ];

    protected $casts = [
        'preferencias' => 'array',
        'gastos_planejados' => 'array', // Converte automaticamente JSON do banco para Array do PHP e vice-versa
        'data_inicio' => 'date',
        'data_fim' => 'date',
        'orcamento_limite' => 'decimal:2',
        'latitude' => 'float',
        'longitude' => 'float',
    ];

    /**
     * Retorna o usuário que criou e organiza a viagem.
     */
    public function criador()
    {
        return $this->belongsTo(User::class, 'criador_id');
    }

    /**
     * Retorna todos os membros/amigos que participam desta viagem.
     */
    public function membros()
    {
        return $this->belongsToMany(User::class, 'viagem_usuario', 'viagem_id', 'usuario_id')
            ->withPivot('funcao', 'presenca')
            ->withTimestamps();
    }

    public function itens()
    {
        return $this->hasMany(ViagemItem::class)->orderBy('dia')->orderBy('ordem');
    }

    public function despesas()
    {
        return $this->hasMany(ViagemDespesa::class)->latest('data_despesa')->latest('id');
    }

    public function pagamentos()
    {
        return $this->hasMany(ViagemPagamento::class);
    }

    public function mensagens()
    {
        return $this->hasMany(ViagemMensagem::class);
    }

    /** O usuário participa desta viagem (criador ou convidado que não recusou)? */
    public function temMembro(int $userId): bool
    {
        return $this->criador_id === $userId
            || $this->membros()->where('usuario_id', $userId)->where('presenca', '!=', 'recusado')->exists();
    }

    /** Pode editar o roteiro: criador ou membro com função "editor". */
    public function podeEditar(int $userId): bool
    {
        return $this->criador_id === $userId
            || $this->membros()->where('usuario_id', $userId)->where('funcao', 'editor')->where('presenca', '!=', 'recusado')->exists();
    }
}
