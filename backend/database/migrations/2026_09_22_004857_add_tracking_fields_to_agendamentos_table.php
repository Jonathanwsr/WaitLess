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
        Schema::table('agendamentos', function (Blueprint $table) {
            $table->decimal('ultima_latitude', 10, 7)->nullable();
            $table->decimal('ultima_longitude', 10, 7)->nullable();
            $table->decimal('ultimo_heading', 6, 2)->nullable()->comment('Direção do movimento em graus (0-360), pra girar o marcador no mapa');
            $table->decimal('ultima_velocidade', 6, 2)->nullable()->comment('m/s, vindo do GPS');
            $table->timestamp('ultima_localizacao_em')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('agendamentos', function (Blueprint $table) {
            $table->dropColumn(['ultima_latitude', 'ultima_longitude', 'ultimo_heading', 'ultima_velocidade', 'ultima_localizacao_em']);
        });
    }
};
