<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use App\Jobs\RealizarRepassePixJob;

class ProcessarRepassesPix extends Command
{
    protected $signature = 'financeiro:repassar-semanal';
    protected $description = 'Varre a tabela providers e envia os repasses para a fila de processamento PIX.';

    public function handle()
    {
        $this->info("Iniciando rotina de repasses PIX para os provedores...");

        $providersComSaldo = DB::table('providers')
            ->where('saldo', '>', 0)
            ->whereNotNull('pix_key') // 👉 CORRIGIDO AQUI
            ->whereNotNull('asaas_api_key') 
            ->get();

        if ($providersComSaldo->isEmpty()) {
            $this->comment("Nenhum provedor com saldo disponível para repasse hoje.");
            return;
        }

        foreach ($providersComSaldo as $provider) {
            $this->info("Enviando para a fila de repasse: Provider ID: {$provider->id} | Saldo: R$ {$provider->saldo}");
            dispatch(new RealizarRepassePixJob($provider->id));
        }

        $this->info("Rotina de repasses enviada para processamento com sucesso.");
    }
}