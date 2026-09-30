<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Marca cada bônus mensal automático de pontos já concedido a um assinante
 * premium (usuario_id + ano_mes é único) — garante que o comando agendado
 * `gamificacao:bonus-mensal` nunca credite o mesmo mês duas vezes, mesmo se
 * for executado mais de uma vez (reprocessamento manual, falha e retry, etc.).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bonus_mensal_gamificacao', function (Blueprint $table) {
            $table->id();
            $table->foreignId('usuario_id')->constrained('users')->cascadeOnDelete();
            $table->string('ano_mes', 7); // formato "2026-09"
            $table->string('plano');
            $table->integer('pontos');
            $table->timestamp('created_at')->useCurrent();

            $table->unique(['usuario_id', 'ano_mes']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bonus_mensal_gamificacao');
    }
};
