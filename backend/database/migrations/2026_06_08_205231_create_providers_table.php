<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('providers', function (Blueprint $table) {
            $table->id();
            
            // Relacionamento com a tabela de usuários
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            
            $table->string('name');
            $table->string('email')->unique();
            $table->string('document')->unique(); // CPF ou CNPJ do prestador
            
            // Dados para o repasse via Asaas (Pix)
            $table->enum('pix_key_type', ['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM']);
            $table->string('pix_key');
            
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('providers');
    }
};