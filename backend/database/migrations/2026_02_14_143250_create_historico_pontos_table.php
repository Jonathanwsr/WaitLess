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
      Schema::create('historico_pontos', function (Blueprint $table) {
    $table->id();
    $table->foreignId('usuario_id')->constrained('users')->cascadeOnDelete();
    $table->foreignId('estabelecimento_id')->constrained('estabelecimentos')->cascadeOnDelete();
    $table->foreignId('agendamento_id')->nullable()->constrained('agendamentos')->nullOnDelete();
    $table->enum('tipo', ['ganho', 'uso']);
    $table->string('descricao');
    $table->integer('quantidade');
    $table->timestamp('created_at')->useCurrent();
});
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('historico_pontos');
    }
};
