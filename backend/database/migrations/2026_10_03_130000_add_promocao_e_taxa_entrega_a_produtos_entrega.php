<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Preço promocional (mesmo padrão de Servico/ItemAluguel: valor "de" e
     * valor "por") e taxa de entrega, definida pelo sócio por produto — só
     * cobrada quando o pedido é modo "entrega" (retirada não paga frete).
     */
    public function up(): void
    {
        Schema::table('produtos_entrega', function (Blueprint $table) {
            $table->boolean('tem_promocao')->default(false)->after('valor');
            $table->decimal('valor_promocional', 10, 2)->nullable()->after('tem_promocao');
            $table->decimal('taxa_entrega', 10, 2)->default(0)->after('valor_promocional');
        });
    }

    public function down(): void
    {
        Schema::table('produtos_entrega', function (Blueprint $table) {
            $table->dropColumn(['tem_promocao', 'valor_promocional', 'taxa_entrega']);
        });
    }
};
