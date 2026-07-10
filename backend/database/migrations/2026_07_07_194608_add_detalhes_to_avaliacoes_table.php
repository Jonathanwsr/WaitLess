<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('avaliacoes', function (Blueprint $table) {
            // Suporte para ImageKit (URLs) ou Caminhos locais (até 3 fotos)
            $table->json('fotos')->nullable()->after('comentario');
            
            // Notas Detalhadas (1 a 5)
            $table->decimal('nota_limpeza', 3, 1)->nullable();
            $table->decimal('nota_precisao', 3, 1)->nullable();
            $table->decimal('nota_comunicacao', 3, 1)->nullable();
            $table->decimal('nota_localizacao', 3, 1)->nullable();
            $table->decimal('nota_checkin', 3, 1)->nullable();
            $table->decimal('nota_custo_beneficio', 3, 1)->nullable();

            // Resposta do dono do estabelecimento
            $table->text('resposta_anfitriao')->nullable();
            $table->timestamp('data_resposta')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('avaliacoes', function (Blueprint $table) {
            $table->dropColumn([
                'fotos', 'nota_limpeza', 'nota_precisao', 'nota_comunicacao', 
                'nota_localizacao', 'nota_checkin', 'nota_custo_beneficio', 
                'resposta_anfitriao', 'data_resposta'
            ]);
        });
    }
};