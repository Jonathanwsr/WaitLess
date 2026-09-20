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
     * Define em quais canais o evento será transmitido: o canal da conversa
     * (pra quem já está com a tela aberta) e o canal privado de cada
     * destinatário (pra atualizar o sino de notificações em qualquer tela).
     */
    public function broadcastOn(): array
    {
        $canais = [new PrivateChannel('conversa.' . $this->mensagem->conversa_id)];

        $conversa = $this->mensagem->conversa;
        if ($conversa) {
            foreach ($conversa->usuariosParaNotificar((int) $this->mensagem->remetente_id) as $userId) {
                $canais[] = new PrivateChannel('App.Models.User.' . $userId);
            }
        }

        return $canais;
    }

    /**
     * Nome do evento que o React/RN vai ouvir no Frontend.
     */
    public function broadcastAs(): string
    {
        return 'mensagem.recebida';
    }

    public function broadcastWith(): array
    {
        return [
            'id'            => $this->mensagem->id,
            'conversa_id'   => $this->mensagem->conversa_id,
            'conteudo'      => $this->mensagem->conteudo,
            'remetente_id'  => $this->mensagem->remetente_id,
            'created_at'    => $this->mensagem->created_at?->toIso8601String(),
        ];
    }
}