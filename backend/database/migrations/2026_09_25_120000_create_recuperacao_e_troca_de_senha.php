<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Código de 6 dígitos enviado por e-mail (guardado só como hash) para redefinir a senha pelo app.
        Schema::create('codigos_recuperacao_senha', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('codigo_hash');
            $table->unsignedTinyInteger('tentativas')->default(0);
            $table->timestamp('expira_em');
            $table->timestamp('usado_em')->nullable();
            $table->string('ip', 45)->nullable();
            $table->timestamps();

            $table->index(['user_id', 'usado_em']);
        });

        // Histórico de trocas de senha: base do limite de 3 trocas por mês.
        Schema::create('trocas_senha', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('canal', 30); // app_recuperacao | web_recuperacao | web_perfil
            $table->string('ip', 45)->nullable();
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('trocas_senha');
        Schema::dropIfExists('codigos_recuperacao_senha');
    }
};
