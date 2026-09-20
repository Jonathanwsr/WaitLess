<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('robo_execucoes', function (Blueprint $table) {
            $table->id();
            $table->string('comando');
            $table->enum('disparado_por', ['agendado', 'manual'])->default('agendado');
            $table->timestamp('iniciado_em');
            $table->timestamp('finalizado_em')->nullable();
            $table->boolean('sucesso')->nullable();
            $table->integer('itens_processados')->default(0);
            $table->text('mensagem')->nullable();
            $table->timestamps();

            $table->index(['comando', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('robo_execucoes');
    }
};
