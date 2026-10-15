<?php

namespace App\Console\Commands;

use App\Services\FlashDealService;
use Illuminate\Console\Command;

class FlashDealsEncerrar extends Command
{
    protected $signature = 'flash-deals:encerrar';
    protected $description = 'Encerra os Flash Deals vencidos e devolve o preço/promoção original dos itens.';

    public function handle(FlashDealService $flash): int
    {
        $this->info('Flash Deals encerrados: ' . $flash->encerrarVencidos());
        return self::SUCCESS;
    }
}
