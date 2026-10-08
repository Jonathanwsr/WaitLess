<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Snapshot da taxa de entrega cobrada no pedido (0 quando é retirada) e o
     * funcionário escolhido pelo sócio/gerente para atender — mesmo padrão de
     * rastreio de atribuição já usado em agendamentos/aluguéis.
     */
    public function up(): void
    {
        Schema::table('pedidos_entrega', function (Blueprint $table) {
            $table->decimal('taxa_entrega', 10, 2)->default(0)->after('taxa_plataforma');
            $table->foreignId('funcionario_id')->nullable()->after('vendedor_id')->constrained('funcionarios')->nullOnDelete();
            $table->foreignId('atribuido_por')->nullable()->after('funcionario_id')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('pedidos_entrega', function (Blueprint $table) {
            $table->dropConstrainedForeignId('atribuido_por');
            $table->dropConstrainedForeignId('funcionario_id');
            $table->dropColumn('taxa_entrega');
        });
    }
};
