<?php

namespace App\Events;

use App\Models\Mensagem;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MensagemEnviada implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $mensagem;

    /**
     * Cria uma nova instância do evento.
     */
    public function __construct(Mensagem $mensagem)
    {
        
        $this->mensagem = $mensagem;
    }

    /**
     * Define em quais canais o evento será transmitido.
     * Usaremos um canal privado restrito à conversa atual.
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('conversa.' . $this->mensagem->conversa_id),
        ];
    }

    /**
     * Nome do evento que o React vai ouvir no Frontend.
     */
    public function broadcastAs(): string
    {
        return 'mensagem.recebida';
    }
}