<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Tabela Principal da Viagem
        Schema::create('viagens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('criador_id')->constrained('users')->cascadeOnDelete();
            $table->string('titulo'); // Ex: "Férias em Maceió"
            $table->string('destino'); // Cidade, Estado ou País
            $table->date('data_inicio');
            $table->date('data_fim');
            $table->integer('total_dias')->default(1);
            $table->integer('quantidade_pessoas')->default(1);
            $table->decimal('orcamento_limite', 10, 2)->nullable();
            
            // JSON para armazenar os gastos planejados rápidos (Ex: [{'item': 'Hotel', 'valor': 1200}])
            $table->json('gastos_planejados')->nullable(); 
            
            $table->decimal('latitude', 10, 8)->nullable();
            $table->decimal('longitude', 11, 8)->nullable();
            $table->timestamps();
        });

        // Tabela de Vínculo de Amigos/Colaboradores na Viagem (Membros)
        Schema::create('viagem_usuario', function (Blueprint $table) {
            $table->id();
            $table->foreignId('viagem_id')->constrained('viagens')->cascadeOnDelete();
            $table->foreignId('usuario_id')->constrained('users')->cascadeOnDelete();
            $table->string('funcao')->default('membro'); // 'editor', 'visualizador'
            $table->timestamps();
            
            // Evita duplicar o mesmo usuário na mesma viagem
            $table->unique(['viagem_id', 'usuario_id']); 
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('viagem_usuario');
        Schema::dropIfExists('viagens');
    }
};