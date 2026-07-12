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
            // Adiciona as novas colunas (definidas como nullable para não quebrar registros antigos)
            $table->string('cnpj', 18)->nullable()->after('nome');
            $table->string('razao_social', 255)->nullable()->after('cnpj');
            $table->string('site', 255)->nullable()->after('razao_social');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('estabelecimentos', function (Blueprint $table) {
            // Remove as colunas caso você precise dar um rollback
            $table->dropColumn(['cnpj', 'razao_social', 'site']);
        });
    }
};