<?php

namespace App\Console\Commands;

use App\Services\Entregas\EntregasRecursosService;
use Illuminate\Console\Command;

class EntregasLembretesRecompra extends Command
{
    protected $signature = 'entregas:lembretes-recompra';
    protected $description = 'Avisa clientes que está na hora de repor um produto de entrega.';

    public function handle(EntregasRecursosService $recursos): int
    {
        $this->info('Lembretes enviados: ' . $recursos->enviarLembretesDeRecompra());
        return self::SUCCESS;
    }
}
