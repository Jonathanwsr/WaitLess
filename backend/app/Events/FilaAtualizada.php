<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

// O 'ShouldBroadcastNow' faz a mágica acontecer na mesma hora
class FilaAtualizada implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $estabelecimentoId;

    public function __construct($estabelecimentoId)
    {
        $this->estabelecimentoId = $estabelecimentoId;
    }

    // Define em qual "canal" do rádio o app vai escutar
    public function broadcastOn()
    {
        // Cria um canal específico para o estabelecimento, ex: "fila.5"
        return new Channel('fila.' . $this->estabelecimentoId);
    }
    
    // O nome do evento que o React Native vai escutar
    public function broadcastAs()
    {
        return 'FilaAtualizada';
    }
}