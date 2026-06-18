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
            // Adicionando os campos de endereço padrão
           
           
           
            

            // Campos CRÍTICOS para geolocalização e proximidade
            // Usamos 'decimal' para precisão em coordenadas
            // Latitude: -90 a +90 (precisamos de precisão de 7-8 casas decimais)
            $table->decimal('latitude', 10, 8)->nullable()->after('estado');
            // Longitude: -180 a +180
            $table->decimal('longitude', 11, 8)->nullable()->after('latitude');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('estabelecimentos', function (Blueprint $table) {
            //
        });
    }
};
