<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('servicos', function (Blueprint $table) {
            // Se você tinha criado como "foto" (singular), vamos remover e criar a "fotos" (plural) em formato JSON
            if (Schema::hasColumn('servicos', 'foto')) {
                $table->dropColumn('foto');
            }
            $table->json('fotos')->nullable()->after('descricao');
        });
    }

    public function down()
    {
        Schema::table('servicos', function (Blueprint $table) {
            $table->dropColumn('fotos');
        });
    }
};