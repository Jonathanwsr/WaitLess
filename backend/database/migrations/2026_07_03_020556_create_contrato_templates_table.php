<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contrato_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('estabelecimento_id')->constrained('estabelecimentos')->cascadeOnDelete();
            $table->string('titulo'); // Ex: Contrato Padrão de Veículos
            $table->longText('conteudo'); // O texto gigante do contrato com as variáveis {{NOME_CLIENTE}}
            $table->string('tipo_reserva')->default('geral'); // imovel, veiculo, equipamento
            $table->boolean('padrao')->default(false); // Se é o contrato principal
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contrato_templates');
    }
};