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
        Schema::table('estabelecimentos', function (Blueprint $table) {
            // Adiciona a coluna para contabilizar o quanto o lojista deve para a plataforma (os 12% das vendas presenciais)
            $table->decimal('saldo_devedor', 10, 2)->default(0)->after('arrecadacao_total');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('estabelecimentos', function (Blueprint $table) {
            $table->dropColumn('saldo_devedor');
        });
    }
};