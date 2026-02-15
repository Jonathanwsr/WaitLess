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
       Schema::create('descontos', function (Blueprint $table) {
    $table->id();
    $table->foreignId('estabelecimento_id')->constrained('estabelecimentos')->cascadeOnDelete();
    $table->string('titulo');
    $table->text('descricao')->nullable();
    $table->enum('tipo', ['percentual', 'fixo', 'pontos']);
    $table->decimal('valor', 10, 2);
    $table->integer('pontos_necessarios')->nullable();
    $table->boolean('ativo')->default(true);
    $table->date('data_inicio')->nullable();
    $table->date('data_fim')->nullable();
    $table->timestamps();
});
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('descontos');
    }
};
