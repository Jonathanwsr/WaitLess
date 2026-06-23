<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contratos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('aluguel_id')->constrained('alugueis')->onDelete('cascade');
            $table->string('numero_contrato')->unique();
            $table->string('titulo');
            $table->longText('descricao')->nullable();
            $table->string('arquivo_pdf');
            $table->string('hash_documento')->nullable();
            $table->string('plataforma_assinatura', 50)->default('D4Sign');
            $table->string('codigo_externo')->nullable();
            $table->string('certificado_pdf')->nullable();
            $table->boolean('assinado')->default(false);
            $table->dateTime('data_assinatura')->nullable();
            $table->string('ip_assinatura', 45)->nullable();
            $table->string('dispositivo_assinatura', 255)->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->string('hash_assinatura')->nullable();
            $table->longText('observacoes')->nullable();
            $table->timestamps();
        });

        // Adiciona a constraint de chave estrangeira que faltava na tabela alugueis
        Schema::table('alugueis', function (Blueprint $table) {
            $table->foreign('contrato_id')->references('id')->on('contratos')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('alugueis', function (Blueprint $table) {
            $table->dropForeign(['contrato_id']);
        });
        Schema::dropIfExists('contratos');
    }
};