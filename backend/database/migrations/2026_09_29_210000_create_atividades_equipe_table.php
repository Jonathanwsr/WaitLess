<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Registro de atividade da equipe: cada ação de um funcionário/gerente sobre
 * um agendamento (chamou, finalizou, cancelou, mudou status...), pra o sócio
 * acompanhar em tempo real quem está fazendo o quê.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('atividades_equipe', function (Blueprint $table) {
            $table->id();
            $table->foreignId('estabelecimento_id')->constrained('estabelecimentos')->cascadeOnDelete();
            $table->foreignId('usuario_id')->constrained('users')->cascadeOnDelete(); // quem fez a ação
            $table->string('papel'); // papel do usuário no momento da ação (funcionario, gerente, socio...)
            $table->foreignId('agendamento_id')->nullable()->constrained('agendamentos')->nullOnDelete();
            $table->string('acao'); // chamou, finalizou, cancelou, status_atualizado, adiou, pulou
            $table->string('descricao');
            $table->timestamp('created_at')->useCurrent();

            $table->index(['estabelecimento_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('atividades_equipe');
    }
};
