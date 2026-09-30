<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * O código do cupom é buscado globalmente (CupomService::buscarValidoParaUsuario
 * faz Cupom::where('codigo', ...)->first(), sem escopo por estabelecimento),
 * então dois lojistas cadastrando o mesmo código faziam um "roubar" o cupom
 * do outro silenciosamente. Sem constraint no banco, só a validação do
 * formulário não bastava para garantir isso.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cupons', function (Blueprint $table) {
            $table->dropIndex(['codigo']);
            $table->unique('codigo');
        });
    }

    public function down(): void
    {
        Schema::table('cupons', function (Blueprint $table) {
            $table->dropUnique(['codigo']);
            $table->index('codigo');
        });
    }
};
