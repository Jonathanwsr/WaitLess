<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/** Avisa o painel do sócio/gerente em tempo real quando alguém da equipe faz alguma ação. */
class AtividadeEquipeRegistrada implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int $estabelecimentoId,
        public string $nomeUsuario,
        public string $papel,
        public string $acao,
        public string $descricao,
        public string $criadoEm,
    ) {
    }

    public function broadcastOn(): array
    {
        return [new PrivateChannel('atividade-equipe.' . $this->estabelecimentoId)];
    }

    public function broadcastAs()
    {
        return 'atividade.registrada';
    }

    public function broadcastWith(): array
    {
        return [
            'nome_usuario' => $this->nomeUsuario,
            'papel' => $this->papel,
            'acao' => $this->acao,
            'descricao' => $this->descricao,
            'created_at' => $this->criadoEm,
        ];
    }
}
