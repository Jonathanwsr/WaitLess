<?php

namespace App\Console\Commands;

use App\Services\Entregas\EntregasRecursosService;
use Illuminate\Console\Command;

class EntregasProcessarAssinaturas extends Command
{
    protected $signature = 'entregas:processar-assinaturas';
    protected $description = 'Gera as entregas vencidas das assinaturas de produtos.';

    public function handle(EntregasRecursosService $recursos): int
    {
        $this->info('Entregas geradas: ' . $recursos->processarAssinaturasVencidas());
        return self::SUCCESS;
    }
}
