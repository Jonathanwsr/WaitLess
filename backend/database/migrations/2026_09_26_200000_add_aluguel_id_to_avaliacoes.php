<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * O código de avaliações (store, relação `aluguel`, filtros por reserva) já usa
 * `avaliacoes.aluguel_id`, mas a coluna nunca foi criada — avaliar uma locação
 * falhava e as avaliações por reserva não podiam ser consultadas.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('avaliacoes', 'aluguel_id')) {
            return;
        }

        Schema::table('avaliacoes', function (Blueprint $table) {
            $table->foreignId('aluguel_id')->nullable()->after('agendamento_id')->constrained('alugueis')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('avaliacoes', function (Blueprint $table) {
            $table->dropConstrainedForeignId('aluguel_id');
        });
    }
};
