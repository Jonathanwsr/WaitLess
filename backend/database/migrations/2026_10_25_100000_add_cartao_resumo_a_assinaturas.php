<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Resumo do cartão da assinatura para a tela "Pagamento" (bandeira, 4 últimos dígitos e validade).
 * Número completo e CVV nunca são gravados: vão direto para o Asaas.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assinaturas', function (Blueprint $table) {
            if (!Schema::hasColumn('assinaturas', 'cartao_bandeira')) {
                $table->string('cartao_bandeira', 30)->nullable();
                $table->string('cartao_final', 4)->nullable();
                $table->string('cartao_validade', 7)->nullable(); // MM/AAAA
            }
        });
    }

    public function down(): void
    {
        Schema::table('assinaturas', function (Blueprint $table) {
            $table->dropColumn(['cartao_bandeira', 'cartao_final', 'cartao_validade']);
        });
    }
};
