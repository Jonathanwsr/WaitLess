<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * `conversas` só suportava um único thread fixo por (cliente, estabelecimento).
     * Passa a suportar: conversa dirigida a um funcionário específico, e/ou
     * amarrada a um agendamento/aluguel específico — permitindo várias
     * conversas em paralelo para o mesmo par cliente/estabelecimento.
     */
    public function up(): void
    {
        Schema::table('conversas', function (Blueprint $table) {
            $table->foreignId('funcionario_id')->nullable()->after('estabelecimento_id')->constrained('funcionarios')->nullOnDelete();
            $table->foreignId('agendamento_id')->nullable()->after('funcionario_id')->constrained('agendamentos')->nullOnDelete();
            $table->foreignId('aluguel_id')->nullable()->after('agendamento_id')->constrained('alugueis')->nullOnDelete();
        });

        DB::statement('ALTER TABLE conversas DROP CONSTRAINT IF EXISTS conversas_usuario_id_estabelecimento_id_unique');

        // Mantém no máximo UMA conversa "geral" (sem funcionário/reserva específicos)
        // por par cliente+estabelecimento; conversas amarradas a um funcionário ou
        // a uma reserva específica ficam livres para coexistir em paralelo.
        DB::statement('
            CREATE UNIQUE INDEX conversas_geral_unique
            ON conversas (usuario_id, estabelecimento_id)
            WHERE funcionario_id IS NULL AND agendamento_id IS NULL AND aluguel_id IS NULL
        ');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS conversas_geral_unique');

        Schema::table('conversas', function (Blueprint $table) {
            $table->dropConstrainedForeignId('funcionario_id');
            $table->dropConstrainedForeignId('agendamento_id');
            $table->dropConstrainedForeignId('aluguel_id');
        });

        Schema::table('conversas', function (Blueprint $table) {
            $table->unique(['usuario_id', 'estabelecimento_id']);
        });
    }
};
