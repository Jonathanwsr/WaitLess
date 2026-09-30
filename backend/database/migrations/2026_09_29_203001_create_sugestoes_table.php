<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Sugestões/feedback enviados pelos usuários no app, visíveis para o admin. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sugestoes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('usuario_id')->constrained('users')->cascadeOnDelete();
            $table->string('categoria')->nullable();
            $table->text('texto');
            $table->string('status')->default('pendente'); // pendente | em_analise | respondida | arquivada
            $table->text('resposta_admin')->nullable();
            $table->integer('pontos_concedidos')->default(0);
            $table->timestamps();

            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sugestoes');
    }
};
