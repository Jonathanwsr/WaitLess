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
      Schema::create('agendamentos', function (Blueprint $table) {
    $table->id();
    $table->foreignId('usuario_id')->constrained('users')->cascadeOnDelete();
    $table->foreignId('estabelecimento_id')->constrained('estabelecimentos')->cascadeOnDelete();
    $table->foreignId('servico_id')->constrained('servicos')->cascadeOnDelete();
    $table->foreignId('funcionario_id')->nullable()->constrained('funcionarios')->nullOnDelete();
    $table->date('data_agendamento');
    $table->time('hora_agendamento');
    $table->enum('status', ['pendente', 'confirmado', 'finalizado', 'cancelado'])->default('pendente');
    $table->boolean('foi_realizado')->default(false);
    $table->time('hora_finalizacao')->nullable();
    $table->unsignedBigInteger('finalizado_por')->nullable(); // Pode ser o ID do user ou funcionario
    $table->decimal('valor_final', 10, 2)->nullable();
    $table->timestamps();
});
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('agendamentos');
    }
};
