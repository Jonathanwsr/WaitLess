<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Quem assinou e ficou no período de teste tinha o plano gravado mas sem `plano_expira_em`,
     * então User::isPremium() dava falso e as telas (web e app) seguiam mostrando "Seja Premium".
     * Preenche com o vencimento da assinatura em andamento.
     */
    public function up(): void
    {
        $assinaturas = DB::table('assinaturas')
            ->whereIn('status', ['ativa', 'pendente'])
            ->whereNotNull('data_vencimento')
            ->orderByDesc('id')
            ->get(['user_id', 'nome_plano', 'data_vencimento'])
            ->unique('user_id');

        foreach ($assinaturas as $a) {
            DB::table('users')
                ->where('id', $a->user_id)
                ->where(fn ($q) => $q->whereNull('plano_expira_em')->orWhere('plano_expira_em', '<', $a->data_vencimento))
                ->update(['plano_assinatura' => $a->nome_plano, 'plano_expira_em' => $a->data_vencimento]);
        }
    }

    public function down(): void
    {
        // Correção de dados; nada a desfazer.
    }
};
