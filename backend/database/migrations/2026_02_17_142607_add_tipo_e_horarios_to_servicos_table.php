<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('servicos', function (Blueprint $table) {
            $table->string('tipo_servico')->nullable()->after('nome');
           
            $table->json('horarios_disponiveis')->nullable()->after('configuracoes'); 
        });
    }

    public function down()
    {
        Schema::table('servicos', function (Blueprint $table) {
            $table->dropColumn(['tipo_servico', 'horarios_disponiveis']);
        });
    }
};