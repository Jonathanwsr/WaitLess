<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('agendamentos', function (Blueprint $table) {
            $table->tinyInteger('nota')->nullable(); // Guarda a nota de 1 a 5
            $table->text('comentario_avaliacao')->nullable(); // Guarda o elogio
        });
    }

    public function down(): void
    {
        Schema::table('agendamentos', function (Blueprint $table) {
            $table->dropColumn(['nota', 'comentario_avaliacao']);
        });
    }
};