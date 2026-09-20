<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * O código do app (MobileAgendamentoController::chamar/updateStatus, e vários
 * pontos da web que já leem/filtram por "em_atendimento") sempre tratou
 * "em_atendimento" como um status válido de agendamento, mas a constraint de
 * CHECK do banco nunca foi atualizada para permiti-lo — ou seja, todo clique
 * em "Chamar próximo cliente" (a ação mais usada por um sócio/funcionário no
 * dia a dia) sempre falhava com erro de banco de dados.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE agendamentos DROP CONSTRAINT IF EXISTS agendamentos_status_check');

        DB::statement("ALTER TABLE agendamentos ADD CONSTRAINT agendamentos_status_check CHECK (status::text = ANY (ARRAY['pendente'::character varying, 'confirmado'::character varying, 'em_atendimento'::character varying, 'finalizado'::character varying, 'cancelado'::character varying, 'aguardando_pagamento'::character varying]::text[]))");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE agendamentos DROP CONSTRAINT IF EXISTS agendamentos_status_check');

        DB::statement("ALTER TABLE agendamentos ADD CONSTRAINT agendamentos_status_check CHECK (status::text = ANY (ARRAY['pendente'::character varying, 'confirmado'::character varying, 'finalizado'::character varying, 'cancelado'::character varying, 'aguardando_pagamento'::character varying]::text[]))");
    }
};
