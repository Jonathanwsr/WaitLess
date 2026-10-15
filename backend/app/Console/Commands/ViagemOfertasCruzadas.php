<?php

namespace App\Console\Commands;

use App\Services\Viagem\CrossSellViagemService;
use Illuminate\Console\Command;

class ViagemOfertasCruzadas extends Command
{
    protected $signature = 'viagem:ofertas-cruzadas';
    protected $description = 'Envia as ofertas de viagem agendadas (veículo 2 dias antes do check-in) e expira as antigas.';

    public function handle(CrossSellViagemService $crossSell): int
    {
        $this->info('Ofertas de viagem enviadas: ' . $crossSell->dispararVencidas());
        return self::SUCCESS;
    }
}
