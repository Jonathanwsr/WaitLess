<?php

namespace App\Observers;

use App\Models\Agendamento;
use App\Services\IndicacaoService;
use App\Services\ListaEsperaService;
use App\Services\Viagem\CrossSellViagemService;

class AgendamentoObserver
{
    /** Agendamento novo pode converter uma oferta de viagem (restaurante/spa) que o cliente recebeu. */
    public function created(Agendamento $agendamento): void
    {
        try {
            app(CrossSellViagemService::class)->conversaoDeAgendamento($agendamento);
            app(\App\Services\FlashDealService::class)->registrarUso('servico', (int) $agendamento->servico_id, (int) $agendamento->usuario_id);
        } catch (\Throwable $e) {
            report($e);
        }
    }

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
