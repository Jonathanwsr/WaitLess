<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * `conversas.estabelecimento_id` passa a ser um campo de uso duplo: nas
     * conversas gerais/de agendamento continua sendo um `estabelecimentos.id`
     * de verdade, mas nas conversas de locação/aluguel (`aluguel_id` não
     * nulo) ele guarda direto o `users.id` do dono — mesma convenção que
     * `itens_aluguel.estabelecimento_id` e `alugueis.estabelecimento_id` já
     * usam (ambos têm FK pra `users`, não pra `estabelecimentos`). Sem essa
     * mudança, criar uma conversa sobre uma locação quebra a constraint.
     */
    public function up(): void
    {
        DB::statement('ALTER TABLE conversas DROP CONSTRAINT IF EXISTS conversas_estabelecimento_id_foreign');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('conversas', function (Blueprint $table) {
            $table->foreign('estabelecimento_id')->references('id')->on('estabelecimentos');
        });
    }
};
