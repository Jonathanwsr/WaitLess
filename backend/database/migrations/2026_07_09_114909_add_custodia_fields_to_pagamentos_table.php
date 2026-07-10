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
        Schema::table('pagamentos', function (Blueprint $table) {
            // Adiciona os campos novos para a regra de Custódia (Modelo Airbnb)
            // O 'after' serve para organizar as colunas visualmente no banco de dados
            $table->decimal('valor_total', 10, 2)->after('status')->nullable();
            $table->decimal('taxa_plataforma', 10, 2)->after('valor_total')->default(0.00); // Seus 12%
            $table->decimal('valor_prestador', 10, 2)->after('taxa_plataforma')->default(0.00); // Os 88% do dono
            $table->string('status_repasse')->after('valor_prestador')->default('aguardando'); // aguardando, liberado, repassado, estornado
            $table->date('data_liberacao_repasse')->after('status_repasse')->nullable(); // Data do PIN + 7 dias
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('pagamentos', function (Blueprint $table) {
            // Caso precise dar um rollback, ele remove as colunas com segurança
            $table->dropColumn([
                'valor_total',
                'taxa_plataforma',
                'valor_prestador',
                'status_repasse',
                'data_liberacao_repasse'
            ]);
        });
    }
};