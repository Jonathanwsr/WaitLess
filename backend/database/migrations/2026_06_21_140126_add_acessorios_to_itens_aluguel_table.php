<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('itens_aluguel', function (Blueprint $table) {
            $table->json('acessorios')->nullable()->after('recursos_oferecidos')
                  ->comment('Array JSON com opcionais cobrados à parte. Ex: [{nome: "Cadeirinha", valor: 50}]');
        });
    }

    public function down(): void
    {
        Schema::table('itens_aluguel', function (Blueprint $table) {
            $table->dropColumn('acessorios');
        });
    }
};