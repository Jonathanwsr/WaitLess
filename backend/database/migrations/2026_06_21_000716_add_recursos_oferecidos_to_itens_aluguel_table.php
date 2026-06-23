<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('itens_aluguel', function (Blueprint $table) {
            // Coluna dinâmica para salvar o que o carro/casa/local oferece (comodidades, opcionais, diferenciais)
            $table->json('recursos_oferecidos')->nullable()->after('especificacoes')
                  ->comment('Array JSON com opcionais. Ex: Ar condicionado, piscina, direção hidráulica, etc.');
        });
    }

    public function down(): void
    {
        Schema::table('itens_aluguel', function (Blueprint $table) {
            $table->dropColumn('recursos_oferecidos');
        });
    }
};