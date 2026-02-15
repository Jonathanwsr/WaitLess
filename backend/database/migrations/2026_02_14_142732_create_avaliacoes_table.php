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
       Schema::create('avaliacoes', function (Blueprint $table) {
    $table->id();
    $table->foreignId('usuario_id')->constrained('users')->cascadeOnDelete();
    $table->foreignId('estabelecimento_id')->constrained('estabelecimentos')->cascadeOnDelete();
    $table->foreignId('agendamento_id')->nullable()->constrained('agendamentos')->nullOnDelete();
    $table->integer('nota'); // 1 a 5
    $table->text('comentario')->nullable();
    $table->boolean('publica')->default(true);
    $table->integer('curtidas')->default(0);
    $table->timestamps();
});
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('avaliacoes');
    }
};
