<?php

namespace App\Console\Commands;

use App\Services\Entregas\EntregasRecursosService;
use Illuminate\Console\Command;

class FilaAvisarVez extends Command
{
    protected $signature = 'fila:avisar-vez';
    protected $description = 'Avisa o cliente quando faltam até 2 atendimentos para a vez dele.';

    public function handle(EntregasRecursosService $recursos): int
    {
        $this->info('Avisos enviados: ' . $recursos->avisarVezNaFila());
        return self::SUCCESS;
    }
}
