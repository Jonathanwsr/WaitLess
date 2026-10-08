<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Pedido de um produto de entrega/retirada feito pelo cliente. Guarda uma
     * cópia (snapshot) do valor e do endereço de origem do produto no momento
     * da compra — preço e endereço do produto podem mudar depois sem afetar
     * pedidos já feitos.
     */
    public function up(): void
    {
        Schema::create('pedidos_entrega', function (Blueprint $table) {
            $table->id();
            $table->string('codigo_pedido')->unique();

            $table->foreignId('cliente_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('produto_entrega_id')->constrained('produtos_entrega')->restrictOnDelete();

            // Snapshot do vendedor/local no momento da compra — usado para
            // resolver a carteira Asaas e o responsável por um estorno, sem
            // depender do produto ainda existir/estar vinculado da mesma forma depois.
            $table->foreignId('vendedor_id')->constrained('users'); // dono do produto (users.id)
            $table->foreignId('estabelecimento_id')->nullable()->constrained('estabelecimentos')->nullOnDelete();

            $table->unsignedInteger('quantidade')->default(1);
            $table->decimal('valor_unitario', 10, 2);
            $table->decimal('valor_total', 10, 2);
            $table->decimal('taxa_plataforma', 10, 2)->default(0);

            $table->enum('modo_recebimento', ['retirada', 'entrega']);

            // Endereço de origem do produto, copiado no momento da compra.
            $table->string('origem_rua')->nullable();
            $table->string('origem_numero', 20)->nullable();
            $table->string('origem_complemento')->nullable();
            $table->string('origem_bairro')->nullable();
            $table->string('origem_cidade')->nullable();
            $table->string('origem_estado', 2)->nullable();
            $table->string('origem_cep', 10)->nullable();

            // Endereço de entrega informado pelo cliente — só quando modo_recebimento = entrega.
            $table->string('entrega_cep', 10)->nullable();
            $table->string('entrega_rua')->nullable();
            $table->string('entrega_numero', 20)->nullable();
            $table->string('entrega_complemento')->nullable();
            $table->string('entrega_bairro')->nullable();
            $table->string('entrega_cidade')->nullable();
            $table->string('entrega_estado', 2)->nullable();
            $table->text('entrega_observacoes')->nullable();

            $table->foreignId('pagamento_id')->nullable()->constrained('pagamentos')->nullOnDelete();

            $table->enum('status', ['pendente_pagamento', 'pago', 'concluido', 'cancelado', 'estornado'])->default('pendente_pagamento');
            $table->timestamp('data_conclusao')->nullable();
            $table->timestamp('data_cancelamento')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pedidos_entrega');
    }
};
