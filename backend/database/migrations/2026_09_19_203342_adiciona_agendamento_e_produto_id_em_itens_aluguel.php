<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * AgendamentoController::storeCarrinho/storeProdutoCarrinho/removerProdutoDoCarrinho
     * e o webhook do Asaas (PagamentoController) já usam `itens_aluguel` como
     * pivô "produto vinculado a um agendamento" (categoria produto_extra/
     * produto_avulso), mas essas duas colunas nunca tinham sido criadas —
     * então todo esse fluxo de compra de produto sempre quebrava.
     */
    public function up(): void
    {
        Schema::table('itens_aluguel', function (Blueprint $table) {
            $table->foreignId('agendamento_id')->nullable()->after('servico_id')->constrained('agendamentos')->nullOnDelete();
            $table->foreignId('produto_id')->nullable()->after('agendamento_id')->constrained('produtos')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('itens_aluguel', function (Blueprint $table) {
            $table->dropConstrainedForeignId('agendamento_id');
            $table->dropConstrainedForeignId('produto_id');
        });
    }
};
