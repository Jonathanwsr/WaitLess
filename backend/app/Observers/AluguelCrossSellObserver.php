<?php

namespace App\Observers;

use App\Models\Aluguel;
use App\Services\Viagem\CrossSellViagemService;
use Illuminate\Support\Facades\Log;

/**
 * Liga as reservas à venda cruzada de viagem: hospedagem nova agenda as ofertas, reserva cancelada
 * as cancela e qualquer reserva nova pode converter uma oferta recebida. Nunca derruba a reserva.
 */
class AluguelCrossSellObserver
{
    public function created(Aluguel $aluguel): void
    {
        $this->seguro(function (CrossSellViagemService $crossSell) use ($aluguel) {
            $crossSell->registrarConversao((int) $aluguel->locatario_id, 'item_aluguel', (int) $aluguel->item_aluguel_id);
            $crossSell->agendarParaReserva($aluguel);
        });

        // Flash Deal ativo no item: a reserva consome uma vaga.
        try {
            app(\App\Services\FlashDealService::class)->registrarUso('item_aluguel', (int) $aluguel->item_aluguel_id, (int) $aluguel->locatario_id);
        } catch (\Throwable $e) {
            Log::warning('Flash Deal: falha ao registrar uso: ' . $e->getMessage());
        }
    }

    public function updated(Aluguel $aluguel): void
    {
        if ($aluguel->wasChanged('status') && $aluguel->status === 'cancelado') {
            $this->seguro(fn (CrossSellViagemService $crossSell) => $crossSell->cancelarParaReserva($aluguel));
        }
    }

    private function seguro(callable $acao): void
    {
        try {
            $acao(app(CrossSellViagemService::class));
        } catch (\Throwable $e) {
            Log::warning('Venda cruzada de viagem falhou: ' . $e->getMessage());
        }
    }
}
