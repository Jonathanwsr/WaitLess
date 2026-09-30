<?php

namespace App\Services;

use App\Events\AtividadeEquipeRegistrada;
use App\Models\AtividadeEquipe;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Registra uma ação de um funcionário/gerente/sócio sobre um agendamento
 * (chamou, finalizou, cancelou...) no ledger de atividade da equipe e avisa
 * em tempo real quem está de olho no painel (sócio/gerente do local).
 */
class AtividadeEquipeService
{
    public static function registrar(int $estabelecimentoId, User $ator, string $acao, string $descricao, ?int $agendamentoId = null): void
    {
        try {
            // DB::transaction aqui cria um SAVEPOINT quando chamado de dentro de
            // uma transação maior (ex.: finalizarComCodigo) — se o INSERT falhar,
            // só esse savepoint é desfeito, sem abortar a transação de quem chamou.
            DB::transaction(function () use ($estabelecimentoId, $ator, $acao, $descricao, $agendamentoId) {
                AtividadeEquipe::create([
                    'estabelecimento_id' => $estabelecimentoId,
                    'usuario_id' => $ator->id,
                    'papel' => $ator->papel,
                    'agendamento_id' => $agendamentoId,
                    'acao' => $acao,
                    'descricao' => $descricao,
                ]);
            });

            // Fora da transação de banco: o broadcast fala com o Reverb, não com o Postgres.
            event(new AtividadeEquipeRegistrada(
                $estabelecimentoId,
                $ator->name,
                $ator->papel,
                $acao,
                $descricao,
                now()->toIso8601String(),
            ));
        } catch (\Throwable $e) {
            // Um problema aqui (ex.: broadcast fora do ar) nunca pode derrubar
            // a ação real que o funcionário já concluiu no agendamento.
            Log::warning("Falha ao registrar atividade da equipe (estabelecimento #{$estabelecimentoId}): " . $e->getMessage());
        }
    }
}
