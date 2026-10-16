<?php

namespace App\Console\Commands;

use App\Services\LembretesService;
use Illuminate\Console\Command;

class EnviarLembretes extends Command
{
    protected $signature = 'lembretes:enviar';

    protected $description = 'Envia lembretes (push + e-mail) de agendamentos e reservas das próximas 24 horas';

    public function handle(LembretesService $lembretes): int
    {
        $total = $lembretes->enviarPendentes();
        $this->info("Lembretes enviados: {$total['agendamentos']} agendamento(s), {$total['reservas']} reserva(s).");

        return self::SUCCESS;
    }
}
