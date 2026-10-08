<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Chave de idempotência pra nota fiscal de ASSINATURA: o id do pagamento
     * Asaas (assinaturas.fatura_id) que originou aquela nota — evita emitir
     * duas notas pra mesma cobrança se o webhook vier duplicado. Pra nota de
     * "venda" a idempotência já é garantida pelo pagamento_id (único).
     */
    public function up(): void
    {
        Schema::table('notas_fiscais', function (Blueprint $table) {
            $table->string('referencia_cobranca')->nullable()->after('asaas_invoice_id');
        });
    }

    public function down(): void
    {
        Schema::table('notas_fiscais', function (Blueprint $table) {
            $table->dropColumn('referencia_cobranca');
        });
    }
};
