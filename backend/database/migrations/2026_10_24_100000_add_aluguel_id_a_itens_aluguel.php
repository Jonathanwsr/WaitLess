<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Produtos adicionais comprados junto com uma RESERVA (locação). O agendamento de serviço já guardava os
 * adicionais em itens_aluguel (agendamento_id + produto_id, categoria "produto_extra"); a reserva passa a
 * usar o mesmo formato, ligada pelo aluguel_id.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('itens_aluguel', 'aluguel_id')) {
            Schema::table('itens_aluguel', function (Blueprint $table) {
                $table->foreignId('aluguel_id')->nullable()->after('agendamento_id')->constrained('alugueis')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('itens_aluguel', 'aluguel_id')) {
            Schema::table('itens_aluguel', function (Blueprint $table) {
                $table->dropForeign(['aluguel_id']);
                $table->dropColumn('aluguel_id');
            });
        }
    }
};
