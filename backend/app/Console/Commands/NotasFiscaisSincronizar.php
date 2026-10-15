<?php

namespace App\Console\Commands;

use App\Services\NotaFiscalService;
use Illuminate\Console\Command;

class NotasFiscaisSincronizar extends Command
{
    protected $signature = 'notas:sincronizar {--limite=100}';
    protected $description = 'Atualiza no Asaas as notas fiscais em andamento (status, número, PDF e XML) e avisa por e-mail as autorizadas.';

    public function handle(NotaFiscalService $notas): int
    {
        $this->info('Notas atualizadas: ' . $notas->sincronizarPendentes((int) $this->option('limite')));
        return self::SUCCESS;
    }
}
