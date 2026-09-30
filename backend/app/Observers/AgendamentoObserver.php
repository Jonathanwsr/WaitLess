<?php

namespace App\Observers;

use App\Models\Agendamento;
use App\Services\IndicacaoService;
use App\Services\ListaEsperaService;

class AgendamentoObserver
{
    /**
     * - Atendimento finalizado: recompensa do programa de indicação (se aplicável).
     * - Reserva cancelada: avisa quem estava na lista de espera daquele dia/horário.
     */
    public function updated(Agendamento $agendamento): void
    {
        if (!$agendamento->wasChanged('status')) {
            return;
        }

        if ($agendamento->status === 'finalizado') {
            app(IndicacaoService::class)->aoFinalizar($agendamento);
        }

        if ($agendamento->status === 'cancelado') {
            app(ListaEsperaService::class)->avisarVaga($agendamento);
        }
    }
}
