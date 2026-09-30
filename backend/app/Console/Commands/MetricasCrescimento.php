<?php

namespace App\Console\Commands;

use App\Services\MetricasCrescimentoService;
use Illuminate\Console\Command;

class MetricasCrescimento extends Command
{
    protected $signature = 'lokyva:metricas {--dias=30 : Janela em dias}';

    protected $description = 'Mostra as métricas de crescimento: locais com reserva, clientes que voltam e origem dos cadastros';

    public function handle(MetricasCrescimentoService $service): int
    {
        $m = $service->gerar(max(1, (int) $this->option('dias')));

        $this->info("Métricas dos últimos {$m['periodo_dias']} dias");
        $this->table(['Métrica', 'Valor'], [
            ['Locais ativos', $m['locais_ativos']],
            ['Locais que receberam ao menos 1 reserva', "{$m['locais_com_reserva']} ({$m['percentual_locais_com_reserva']}%)"],
            ['Reservas', $m['reservas']],
            ['Reservas por local por semana', $m['reservas_por_local_por_semana']],
            ['Clientes novos', $m['clientes_novos']],
            ['Clientes novos que reservaram', $m['clientes_novos_que_reservaram']],
            ['Desses, os que já fizeram a 2ª reserva', "{$m['clientes_que_voltaram']} ({$m['percentual_que_voltou']}%)"],
            ['Cadastros por indicação', $m['cadastros_por_indicacao']],
            ['Cadastros orgânicos', $m['cadastros_organicos']],
        ]);

        return self::SUCCESS;
    }
}
