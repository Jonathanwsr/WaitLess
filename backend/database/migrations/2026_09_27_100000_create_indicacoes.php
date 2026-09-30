<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Programa de indicação: cada usuário tem um código; quem se cadastra com o código de um amigo
     * fica ligado a ele e, quando concluir a primeira reserva, os dois ganham pontos.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('codigo_indicacao', 12)->nullable()->unique();
            $table->foreignId('indicado_por_id')->nullable()->constrained('users')->nullOnDelete();
        });

        Schema::create('indicacoes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('indicador_id')->constrained('users')->cascadeOnDelete();
            // Cada pessoa só pode ser indicada uma vez.
            $table->foreignId('indicado_id')->unique()->constrained('users')->cascadeOnDelete();
            $table->string('status', 20)->default('pendente'); // pendente | recompensada
            $table->unsignedInteger('pontos_indicador')->default(0);
            $table->unsignedInteger('pontos_indicado')->default(0);
            $table->foreignId('agendamento_id')->nullable()->constrained('agendamentos')->nullOnDelete();
            $table->timestamp('recompensada_em')->nullable();
            $table->timestamps();

            $table->index(['indicador_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('indicacoes');
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('indicado_por_id');
            $table->dropColumn('codigo_indicacao');
        });
    }
};
