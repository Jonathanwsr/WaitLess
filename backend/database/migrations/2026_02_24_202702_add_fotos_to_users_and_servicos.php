<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        // Adiciona foto no Usuário
        Schema::table('users', function (Blueprint $table) {
            $table->string('foto_perfil')->nullable()->after('email');
        });

        // Adiciona foto no Serviço
        Schema::table('servicos', function (Blueprint $table) {
            $table->string('foto')->nullable()->after('descricao');
        });
    }

    public function down()
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('foto_perfil');
        });
        Schema::table('servicos', function (Blueprint $table) {
            $table->dropColumn('foto');
        });
    }
};