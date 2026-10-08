<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('avaliacoes_produto_entrega', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pedido_entrega_id')->unique()->constrained('pedidos_entrega')->cascadeOnDelete();
            $table->foreignId('cliente_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('produto_entrega_id')->constrained('produtos_entrega')->cascadeOnDelete();
            $table->foreignId('vendedor_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedTinyInteger('nota_produto');
            $table->unsignedTinyInteger('nota_vendedor');
            $table->text('comentario')->nullable();
            $table->timestamps();
        });

        Schema::table('pedidos_entrega', function (Blueprint $table) {
            $table->timestamp('em_rota_em')->nullable();
            $table->decimal('posicao_lat', 10, 7)->nullable();
            $table->decimal('posicao_lng', 10, 7)->nullable();
            $table->timestamp('posicao_atualizada_em')->nullable();
            $table->timestamp('pontos_concedidos_em')->nullable();
        });

        Schema::create('assinaturas_entrega', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cliente_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('produto_entrega_id')->constrained('produtos_entrega')->cascadeOnDelete();
            $table->unsignedInteger('quantidade')->default(1);
            $table->string('modo_recebimento', 20)->default('retirada');
            $table->string('modo_pagamento', 20)->default('local');
            $table->unsignedInteger('frequencia_dias')->default(30);
            $table->date('proxima_entrega_em');
            $table->json('endereco')->nullable();
            $table->string('status', 20)->default('ativa'); // ativa | pausada | cancelada
            $table->timestamps();
        });

        Schema::table('agendamentos', function (Blueprint $table) {
            $table->timestamp('aviso_vez_em')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('agendamentos', fn (Blueprint $t) => $t->dropColumn('aviso_vez_em'));
        Schema::dropIfExists('assinaturas_entrega');
        Schema::table('pedidos_entrega', function (Blueprint $table) {
            $table->dropColumn(['em_rota_em', 'posicao_lat', 'posicao_lng', 'posicao_atualizada_em', 'pontos_concedidos_em']);
        });
        Schema::dropIfExists('avaliacoes_produto_entrega');
    }
};
