<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('favoritos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('usuario_id')->constrained('users')->cascadeOnDelete();
            
            // Chaves estrangeiras nulas para permitir favoritar um OU outro
            $table->foreignId('estabelecimento_id')->nullable()->constrained('estabelecimentos')->cascadeOnDelete();
            $table->foreignId('servico_id')->nullable()->constrained('servicos')->cascadeOnDelete();
            
            $table->timestamps();

            // Evita que o usuário favorite a mesma coisa duas vezes
            $table->unique(['usuario_id', 'estabelecimento_id']);
            $table->unique(['usuario_id', 'servico_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('favoritos');
    }
};