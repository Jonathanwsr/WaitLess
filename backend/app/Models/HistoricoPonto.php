<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Extrato de pontos de fidelidade (ganho/uso) por usuário e estabelecimento.
 * A coluna `created_at` tem DEFAULT CURRENT_TIMESTAMP no banco e não existe
 * `updated_at` — o histórico é sempre "cria e esquece", nunca editado.
 *
 * Esse model faltava: HistoricoPontoController já o importava e usava
 * (`HistoricoPonto::create()`, `::query()`, `::findOrFail()`) sem que a
 * classe existisse, então toda chamada a esse controller (index/store/show)
 * derrubava com "Class not found" — só não foi percebido antes porque, sem a
 * checagem de dono que foi adicionada nesta auditoria, o bug nunca chegava a
 * rodar em teste nenhum.
 */
class HistoricoPonto extends Model
{
    protected $table = 'historico_pontos';

    public $timestamps = false;

    protected $fillable = [
        'usuario_id',
        'estabelecimento_id',
        'agendamento_id',
        'tipo',
        'descricao',
        'quantidade',
        'promocao_id',
    ];

    public function usuario()
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }

    public function estabelecimento()
    {
        return $this->belongsTo(Estabelecimento::class, 'estabelecimento_id');
    }
}
