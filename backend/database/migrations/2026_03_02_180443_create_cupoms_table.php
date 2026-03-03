<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cupons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('estabelecimento_id')->constrained()->onDelete('cascade'); // Dono do cupom
            
            $table->string('codigo')->index(); // Ex: CORTEDEKING, VIP10
            $table->string('titulo'); // Ex: "10% OFF no Corte de Cabelo"
            $table->text('descricao')->nullable();
            
            $table->enum('tipo_desconto', ['fixo', 'percentual'])->default('percentual');
            $table->decimal('valor_desconto', 8, 2); // Ex: 10.00 (R$ ou %)
            
            // Regras de Gamificação
            $table->integer('pontos_custo')->default(0); 
            $table->boolean('apenas_plus')->default(false); 
            
            // Prazos e Limites
            $table->dateTime('data_validade')->nullable(); 
            $table->boolean('ativo')->default(true);
            
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cupons');
        Schema::dropIfExists('cupoms'); // Apaga a tabela antiga errada por precaução
    }
};