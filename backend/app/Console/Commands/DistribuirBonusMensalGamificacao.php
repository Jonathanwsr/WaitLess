<?php

namespace App\Console\Commands;

use App\Services\GamificacaoService;
use Illuminate\Console\Command;

/**
 * Crédito mensal automático de pontos para cada assinante premium ativo, de
 * acordo com o plano dele (config/gamificacao.php). Agendado para todo dia 1
 * às 03h em routes/console.php — idempotente, então rodar de novo no mesmo
 * mês (manual ou por retry) não credita ninguém duas vezes.
 */
class DistribuirBonusMensalGamificacao extends Command
{
    protected $signature = 'gamificacao:bonus-mensal';
    protected $description = 'Credita o bônus mensal automático de pontos para cada assinante premium, de acordo com o plano.';

    public function handle(GamificacaoService $gamificacao)
    {
        $r = $gamificacao->distribuirBonusMensal();

        $this->info("Bônus mensal {$r['ano_mes']}: {$r['creditados']} usuário(s) creditados, {$r['ja_creditados']} já haviam recebido neste mês.");
    }
}
