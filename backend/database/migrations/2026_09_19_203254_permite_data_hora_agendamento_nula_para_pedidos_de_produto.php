<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Mesmo motivo da migration anterior (servico_id nulo): um pedido de
     * produto avulso não tem data/hora de agendamento.
     */
    public function up(): void
    {
        DB::statement('ALTER TABLE agendamentos ALTER COLUMN data_agendamento DROP NOT NULL');
        DB::statement('ALTER TABLE agendamentos ALTER COLUMN hora_agendamento DROP NOT NULL');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE agendamentos ALTER COLUMN data_agendamento SET NOT NULL');
        DB::statement('ALTER TABLE agendamentos ALTER COLUMN hora_agendamento SET NOT NULL');
    }
};
