<?php

namespace App\Console\Commands;

use App\Services\Carteira\AberturaCarteiraService;
use Illuminate\Console\Command;

class CarteiraAbrirPendentes extends Command
{
    protected $signature = 'carteira:abrir-pendentes';
    protected $description = 'Tenta abrir no Asaas as carteiras de sócios que ficaram aguardando liberação (limite de subcontas do Asaas).';

    public function handle(AberturaCarteiraService $abertura): int
    {
        $this->info('Carteiras abertas: ' . $abertura->tentarPendentes());
        return self::SUCCESS;
    }
}
