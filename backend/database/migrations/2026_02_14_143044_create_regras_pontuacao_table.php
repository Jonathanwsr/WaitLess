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
       Schema::create('regras_pontuacao', function (Blueprint $table) {
    $table->id();
    $table->foreignId('estabelecimento_id')->constrained('estabelecimentos')->cascadeOnDelete();
    $table->string('tipo'); // fidelidade, indicacao, etc
    $table->string('descricao')->nullable();
    $table->integer('pontos_por_acao');
    $table->boolean('ativo')->default(true);
    $table->timestamps();
});
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('regras_pontuacao');
    }
};
