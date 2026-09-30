<?php

namespace App\Console\Commands;

use App\Models\RoboExecucao;
use App\Services\Carteira\CarteiraService;
use Illuminate\Console\Command;

class SincronizarCarteira extends Command
{
    protected $signature = 'carteira:sincronizar {--manual : Marca esta execução como disparada manualmente pelo admin}';
    protected $description = 'Acompanha no Asaas as transferências em andamento, refaz validações de conta (Pix de R$ 0,01) e taxas pendentes.';

    public function handle(CarteiraService $carteira)
    {
        $execucao = RoboExecucao::iniciar('carteira:sincronizar', $this->option('manual') ? 'manual' : 'agendado');

        try {
            $r = $carteira->sincronizar();
            $resumo = "{$r['atualizadas']} transferência(s) atualizada(s), {$r['validacoes_refeitas']} validação(ões) refeita(s), {$r['taxas_refeitas']} taxa(s) reprocessada(s).";
            $this->info($resumo);
            $execucao->finalizar(true, $r['atualizadas'] + $r['validacoes_refeitas'] + $r['taxas_refeitas'], $resumo);
        } catch (\Throwable $e) {
            $execucao->finalizar(false, 0, $e->getMessage());
            throw $e;
        }
    }
}
