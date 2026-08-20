<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow; // IMPORTANTÍSSIMO!
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

// ShouldBroadcastNow garante que o evento vá para o Websocket sem passar por fila
class LocationUpdated implements ShouldBroadcastNow 
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $agendamentoId;
    public $latitude;
    public $longitude;

    public function __construct($agendamentoId, $latitude, $longitude)
    {
        $this->agendamentoId = $agendamentoId;
        $this->latitude = $latitude;
        $this->longitude = $longitude;
    }

    /**
     * Define o canal onde o proprietário estará "escutando".
     */
    public function broadcastOn(): array
    {
        // Canal seguro/privado só para esse agendamento específico
        return [
            new PrivateChannel('rastreamento.' . $this->agendamentoId),
        ];
    }

    /**
     * Opcional: Define o nome do evento que chegará no JavaScript
     */
    public function broadcastAs()
    {
        return 'client.moved';
    }
}