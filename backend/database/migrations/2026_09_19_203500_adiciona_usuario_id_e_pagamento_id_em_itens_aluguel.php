<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Mesmo caso das migrations anteriores: AgendamentoController::storeCarrinho/
     * storeProdutoCarrinho gravam `usuario_id` e `pagamento_id` nessa tabela,
     * mas as colunas nunca existiram.
     */
    public function up(): void
    {
        Schema::table('itens_aluguel', function (Blueprint $table) {
            $table->foreignId('usuario_id')->nullable()->after('produto_id')->constrained('users')->nullOnDelete();
            $table->foreignId('pagamento_id')->nullable()->after('usuario_id')->constrained('pagamentos')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('itens_aluguel', function (Blueprint $table) {
            $table->dropConstrainedForeignId('usuario_id');
            $table->dropConstrainedForeignId('pagamento_id');
        });
    }
};
