<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('itens_aluguel', function (Blueprint $table) {
            // Controle de Disponibilidade Dinâmica
            $table->boolean('disponibilidade_por_data')->default(false)->after('sempre_disponivel');
            $table->integer('quantidade_padrao')->nullable()->after('disponibilidade_por_data');
            $table->string('tipo_quantidade')->nullable()->comment('vagas, pessoas, mesas, unidades, etc.')->after('quantidade_padrao');
            
            // Colunas JSON para guardar a matriz de dias e horários
            $table->json('dias_disponiveis')->nullable()->after('tipo_quantidade');
            $table->json('horarios_disponiveis')->nullable()->after('dias_disponiveis');

            // Precificação e Descontos
            $table->decimal('valor', 10, 2)->nullable()->after('horarios_disponiveis');
            $table->decimal('valor_original', 10, 2)->nullable()->after('valor');
            $table->decimal('percentual_desconto', 5, 2)->nullable()->after('valor_original');
          
            $table->decimal('valor_final', 10, 2)->nullable()->after('valor_desconto');
            
            // Status string (caso queira usar em vez do boolean ativo)
            $table->string('status')->default('ativo')->after('valor_final');
        });
    }

    public function down(): void
    {
        Schema::table('itens_aluguel', function (Blueprint $table) {
            $table->dropColumn([
                'disponibilidade_por_data',
                'quantidade_padrao',
                'tipo_quantidade',
                'dias_disponiveis',
                'horarios_disponiveis',
                'valor',
                'valor_original',
                'percentual_desconto',
                'valor_desconto',
                'valor_final',
                'status'
            ]);
        });
    }
};