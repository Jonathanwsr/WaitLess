<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AtividadeEquipe extends Model
{
    protected $table = 'atividades_equipe';

    public $timestamps = false;

    protected $fillable = [
        'estabelecimento_id',
        'usuario_id',
        'papel',
        'agendamento_id',
        'acao',
        'descricao',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    public function usuario()
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }

    public function estabelecimento()
    {
        return $this->belongsTo(Estabelecimento::class);
    }
}
