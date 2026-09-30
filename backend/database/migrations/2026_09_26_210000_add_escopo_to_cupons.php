<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Onde o cupom vale: o local inteiro (os dois nulos), um serviço específico ou uma
 * reserva (locação) específica.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cupons', function (Blueprint $table) {
            $table->foreignId('servico_id')->nullable()->after('estabelecimento_id')->constrained('servicos')->nullOnDelete();
            $table->foreignId('item_aluguel_id')->nullable()->after('servico_id')->constrained('itens_aluguel')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('cupons', function (Blueprint $table) {
            $table->dropConstrainedForeignId('item_aluguel_id');
            $table->dropConstrainedForeignId('servico_id');
        });
    }
};
