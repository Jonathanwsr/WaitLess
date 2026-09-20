<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use App\Jobs\RealizarRepassePixJob;
use App\Models\RoboExecucao;

class ProcessarRepassesPix extends Command
{
    protected $signature = 'financeiro:repassar-semanal {--manual : Marca esta execução como disparada manualmente pelo admin}';
    protected $description = 'Varre a tabela providers e envia os repasses para a fila de processamento PIX.';

    public function handle()
    {
        $execucao = RoboExecucao::iniciar('financeiro:repassar-semanal', $this->option('manual') ? 'manual' : 'agendado');

        $this->info("Iniciando rotina de repasses PIX para os provedores...");

        try {
            $providersComSaldo = DB::table('providers')
                ->where('saldo', '>', 0)
                ->whereNotNull('pix_key') // 👉 CORRIGIDO AQUI
                ->whereNotNull('asaas_api_key')
                ->get();

            if ($providersComSaldo->isEmpty()) {
                $this->comment("Nenhum provedor com saldo disponível para repasse hoje.");
                $execucao->finalizar(true, 0, 'Nenhum provedor com saldo disponível.');
                return;
            }

            foreach ($providersComSaldo as $provider) {
                $this->info("Enviando para a fila de repasse: Provider ID: {$provider->id} | Saldo: R$ {$provider->saldo}");
                dispatch(new RealizarRepassePixJob($provider->id));
            }

            $this->info("Rotina de repasses enviada para processamento com sucesso.");
            $execucao->finalizar(true, $providersComSaldo->count(), 'Repasses enfileirados com sucesso.');
        } catch (\Exception $e) {
            $execucao->finalizar(false, 0, $e->getMessage());
            throw $e;
        }
    }
}