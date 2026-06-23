<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('itens_aluguel', function (Blueprint $table) {
            // Adiciona a coluna de capacidade máxima de pessoas
            $table->integer('capacidade_pessoas')->nullable()->after('quantidade')
                  ->comment('Capacidade máxima de pessoas para o veículo ou imóvel');
        });
    }

    public function down(): void
    {
        Schema::table('itens_aluguel', function (Blueprint $table) {
            $table->dropColumn('capacidade_pessoas');
        });
    }
};