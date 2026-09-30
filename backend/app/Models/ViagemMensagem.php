<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ViagemMensagem extends Model
{
    protected $table = 'viagem_mensagens';

    protected $guarded = ['id'];

    public function autor()
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }

    public function paraTela(): array
    {
        return [
            'id' => $this->id,
            'tipo' => $this->tipo,
            'conteudo' => $this->conteudo,
            'usuario_id' => $this->usuario_id,
            'autor' => $this->autor?->name,
            'criado_em' => optional($this->created_at)->toIso8601String(),
        ];
    }
}
