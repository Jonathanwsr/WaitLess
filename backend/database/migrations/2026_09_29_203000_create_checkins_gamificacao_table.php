<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Registra o "check-in" diário ("Estou usando o app"): 1 crédito de pontos
 * por usuário por dia, controlado por uma constraint única (usuario_id, data)
 * — evita qualquer race condition de cliques duplicados no mesmo dia.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('checkins_gamificacao', function (Blueprint $table) {
            $table->id();
            $table->foreignId('usuario_id')->constrained('users')->cascadeOnDelete();
            $table->date('data');
            $table->integer('pontos');
            $table->timestamp('created_at')->useCurrent();

            $table->unique(['usuario_id', 'data']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('checkins_gamificacao');
    }
};
