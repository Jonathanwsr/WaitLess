<?php

namespace App\Events;

use App\Models\ViagemMensagem;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/** Mensagem nova no chat do grupo da viagem (canal privado viagem.{id}, só membros). */
class ViagemMensagemEnviada implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public ViagemMensagem $mensagem) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('viagem.' . $this->mensagem->viagem_id)];
    }

    public function broadcastAs(): string
    {
        return 'mensagem.nova';
    }

    public function broadcastWith(): array
    {
        return $this->mensagem->paraTela();
    }
}
