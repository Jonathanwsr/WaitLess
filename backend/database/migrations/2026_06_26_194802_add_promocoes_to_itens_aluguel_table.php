<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('itens_aluguel', function (Blueprint $table) {
            // Promoções
            $table->boolean('tem_promocao')->default(false);
            $table->enum('tipo_desconto', ['percentual', 'fixo'])->default('percentual');
            $table->decimal('valor_desconto', 10, 2)->nullable();
            
            
            $table->boolean('aceita_pontos')->default(false);
            $table->integer('maximo_pontos_permitidos')->nullable();
          
            $table->boolean('exige_contrato')->default(false);
        });
    }

    public function down(): void
    {
        Schema::table('itens_aluguel', function (Blueprint $table) {
            $table->dropColumn(['tem_promocao', 'tipo_desconto', 'valor_desconto', 'aceita_pontos', 'maximo_pontos_permitidos', 'exige_contrato']);
        });
    }
};