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
       Schema::create('estabelecimentos', function (Blueprint $table) {
    $table->id();
    $table->string('nome');
    $table->string('ramo_atuacao')->nullable();
    $table->string('telefone')->nullable();
    $table->string('cep')->nullable();
    $table->string('rua')->nullable();
    $table->string('numero')->nullable();
    $table->string('complemento')->nullable();
    $table->string('bairro')->nullable();
    $table->string('cidade')->nullable();
    $table->string('estado')->nullable();
    $table->string('foto_perfil')->nullable();
    $table->decimal('avaliacao_media', 3, 2)->default(0);
    $table->integer('total_avaliacoes')->default(0);
    $table->decimal('arrecadacao_total', 10, 2)->default(0);
    $table->integer('clientes_aguardando')->default(0);
    $table->boolean('ativo')->default(true);
    $table->timestamps();
});
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('estabelecimentos');
    }
};
