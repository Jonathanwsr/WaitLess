<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
    {
        Schema::table('estabelecimentos', function (Blueprint $table) {
            // Adiciona a coluna para armazenar o caminho da foto de capa/banner da loja
            $table->string('foto_banner')->nullable()->after('foto_perfil');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down()
    {
        Schema::table('estabelecimentos', function (Blueprint $table) {
            $table->dropColumn('foto_banner');
        });
    }
};