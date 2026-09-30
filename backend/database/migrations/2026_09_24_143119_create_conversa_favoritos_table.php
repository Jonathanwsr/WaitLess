<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // "Favoritar" é por pessoa, não pela conversa em si — os dois lados de
        // uma mesma conversa (cliente e estabelecimento) podem favoritar
        // independentemente, por isso é uma tabela pivô e não uma coluna
        // boolean direta em `conversas`.
        Schema::create('conversa_favoritos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversa_id')->constrained('conversas')->cascadeOnDelete();
            $table->foreignId('usuario_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['conversa_id', 'usuario_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('conversa_favoritos');
    }
};
