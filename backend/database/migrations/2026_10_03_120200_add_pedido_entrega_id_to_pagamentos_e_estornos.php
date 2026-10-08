<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * O pagamento online de um pedido de entrega precisa gravar o Pagamento
 * ligado ao PedidoEntrega — mesmo motivo do aluguel (ver
 * 2026_09_26_190000_permite_pagamento_de_alugueis.php): a tabela só conhecia
 * agendamento_id/aluguel_id. O mesmo vínculo é adicionado em `estornos`, para
 * o cancelamento/estorno de um pedido de entrega aparecer na mesma tela que
 * o admin já usa para acompanhar disputas de serviço/aluguel.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pagamentos', function (Blueprint $table) {
            $table->foreignId('pedido_entrega_id')->nullable()->after('aluguel_id')->constrained('pedidos_entrega')->nullOnDelete();
        });

        Schema::table('estornos', function (Blueprint $table) {
            $table->foreignId('pedido_entrega_id')->nullable()->after('item_aluguel_id')->constrained('pedidos_entrega')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('estornos', function (Blueprint $table) {
            $table->dropConstrainedForeignId('pedido_entrega_id');
        });

        Schema::table('pagamentos', function (Blueprint $table) {
            $table->dropConstrainedForeignId('pedido_entrega_id');
        });
    }
};
