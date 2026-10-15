<?php

namespace App\Console\Commands;

use App\Models\Assinatura;
use App\Models\User;
use Illuminate\Console\Command;

/**
 * Quem cancelou a assinatura mantém os benefícios até o fim do ciclo pago; quando o ciclo acaba,
 * a conta volta para o plano Grátis (sem plano). Não mexe em quem ainda tem assinatura em
 * andamento (ativa, pendente ou atrasada), que segue o fluxo normal de cobrança do Asaas.
 */
class AssinaturasVoltarGratuito extends Command
{
    protected $signature = 'assinaturas:voltar-gratuito';
    protected $description = 'Devolve ao plano Grátis quem cancelou a assinatura e já passou do fim do ciclo pago.';

    public function handle(): int
    {
        $total = 0;

        User::query()
            ->whereNotNull('plano_assinatura')
            ->where('plano_assinatura', '!=', 'gratuito')
            ->where(fn ($q) => $q->whereNull('plano_expira_em')->orWhere('plano_expira_em', '<', now()))
            ->whereNotIn('id', Assinatura::whereIn('status', ['ativa', 'pendente', 'atrasada'])->select('user_id'))
            ->chunkById(200, function ($usuarios) use (&$total) {
                foreach ($usuarios as $u) {
                    $u->update(['plano_assinatura' => 'gratuito', 'plano_expira_em' => null]);
                    $total++;
                }
            });

        $this->info("Contas devolvidas ao plano Grátis: {$total}");

        return self::SUCCESS;
    }
}
