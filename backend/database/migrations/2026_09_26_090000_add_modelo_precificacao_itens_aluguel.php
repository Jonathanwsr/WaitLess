<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('itens_aluguel', function (Blueprint $table) {
            // pacote: valor_diaria é um preço fixo que já cobre até `pessoas_incluidas` pessoas.
            // por_pessoa: valor_diaria é o preço de UMA pessoa; o total é valor_diaria × pessoas.
            $table->string('modelo_precificacao', 12)->default('pacote')->after('valor_diaria');
        });
    }

    public function down(): void
    {
        Schema::table('itens_aluguel', function (Blueprint $table) {
            $table->dropColumn('modelo_precificacao');
        });
    }
};
