<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('itens_aluguel', function (Blueprint $table) {
            // Armazena se a cobrança padrão configurada é 'diaria', 'semanal' ou 'mensal'
            $table->string('periodo_faturamento_padrao')->default('diaria')->after('categoria');
            
            // Armazena a regra permitida: 'online', 'presencial' ou 'ambos'
            $table->string('permitir_pagamento')->default('online')->after('periodo_faturamento_padrao');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('itens_aluguel', function (Blueprint $table) {
            $table->dropColumn(['periodo_faturamento_padrao', 'permitir_pagamento_presencial']);
        });
    }
};