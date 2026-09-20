<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Estorno;
use App\Models\User;
use App\Models\RoboExecucao;
use App\Services\EstornoService;

class ProcessarEstornosVencidos extends Command
{
    protected $signature = 'estornos:processar-vencidos {--manual : Marca esta execução como disparada manualmente pelo admin}';
    protected $description = 'Aprova estornos automaticamente se o prestador não responder em 48h';

    public function handle(EstornoService $estornoService)
    {
        $execucao = RoboExecucao::iniciar('estornos:processar-vencidos', $this->option('manual') ? 'manual' : 'agendado');

        $sistemaUser = User::where('email', 'admin@waitless.com.br')->first(); // Pegue o user Admin do sistema

        // Busca estornos Pendentes onde o prazo já passou e o prestador NÃO respondeu
        $estornosAtrasados = Estorno::where('status', 'PENDENTE')
                                    ->where('prestador_respondeu', false)
                                    ->where('prazo_resposta', '<', now())
                                    ->get();

        $falhas = 0;

        foreach ($estornosAtrasados as $estorno) {
            try {
                $estornoService->aprovarEstorno($estorno, $sistemaUser);
                $this->info("Estorno {$estorno->codigo_estorno} aprovado automaticamente.");
            } catch (\Exception $e) {
                $falhas++;
                $this->error("Erro ao aprovar estorno {$estorno->codigo_estorno}: " . $e->getMessage());
            }
        }

        $execucao->finalizar(
            $falhas === 0,
            $estornosAtrasados->count(),
            $estornosAtrasados->isEmpty()
                ? 'Nenhum estorno vencido encontrado.'
                : "{$estornosAtrasados->count()} estorno(s) vencido(s) processado(s), {$falhas} falha(s)."
        );
    }
}