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
        Schema::table('alugueis', function (Blueprint $table) {
            // AgendamentoController::storeAluguel() já tentava gravar essas
            // colunas há tempos — elas nunca existiram na tabela, então TODA
            // reserva de aluguel/locação avulsa vinha derrubando com erro de
            // SQL (coluna inexistente) antes de chegar a criar o registro.
            $table->decimal('valor_bruto', 10, 2)->default(0)->after('valor_unitario');
            $table->decimal('valor_desconto_promocional', 10, 2)->default(0)->after('valor_bruto');
            $table->decimal('valor_desconto_pontos', 10, 2)->default(0)->after('valor_desconto_promocional');
            $table->unsignedInteger('pontos_utilizados')->default(0)->after('valor_desconto_pontos');
            $table->decimal('taxa_plataforma', 10, 2)->default(0)->after('valor_total');
            $table->json('acessorios_selecionados')->nullable()->after('taxa_plataforma');
            $table->json('comodidades_selecionadas')->nullable()->after('acessorios_selecionados');
            $table->boolean('exige_contrato')->default(false)->after('comodidades_selecionadas');
            $table->string('tipo_servico')->nullable()->after('exige_contrato');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('alugueis', function (Blueprint $table) {
            $table->dropColumn([
                'valor_bruto', 'valor_desconto_promocional', 'valor_desconto_pontos',
                'pontos_utilizados', 'taxa_plataforma', 'acessorios_selecionados',
                'comodidades_selecionadas', 'exige_contrato', 'tipo_servico',
            ]);
        });
    }
};
