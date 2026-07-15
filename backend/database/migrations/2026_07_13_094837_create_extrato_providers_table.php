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
        Schema::create('extrato_providers', function (Blueprint $table) {
    $table->id();

    $table->foreignId('provider_id')
        ->constrained('providers')
        ->cascadeOnDelete();

    $table->foreignId('usuario_id')
        ->nullable()
        ->constrained('users')
        ->nullOnDelete(); // Quem pagou

    // Polimorfismo para aceitar tanto Agendamento (Serviço) quanto Aluguel (Item)
    $table->string('origem_type')->nullable(); // Ex.: App\Models\Agendamento ou App\Models\Aluguel
    $table->unsignedBigInteger('origem_id')->nullable();

    $table->enum('tipo', [
        'credito',
        'debito',
        'estorno',
        'repasse'
    ]);

    // Valores financeiros
    $table->decimal('valor_bruto', 10, 2);
    $table->decimal('taxa_plataforma', 10, 2); // Comissão da plataforma (12%)
    $table->decimal('valor_liquido', 10, 2);   // Valor recebido pelo prestador (88%)

    // Descrição da movimentação
    $table->string('descricao');

    /**
     * NOVOS CAMPOS
     */

    // Situação da movimentação
    $table->enum('status', [
        'pendente',
        'processando',
        'liberado',
        'cancelado',
        'estornado'
    ])->default('pendente');

    // Data em que o dinheiro poderá ser sacado
    $table->timestamp('data_liberacao')->nullable();

    // Código da transação do gateway (Asaas, Mercado Pago, Stripe...)
    $table->string('codigo_transacao')->nullable();

    // Método de pagamento utilizado
    $table->enum('metodo_pagamento', [
        'pix',
        'cartao_credito',
        'cartao_debito',
        'boleto',
        'dinheiro',
        'saldo',
        'outro'
    ])->nullable();

    // Informações adicionais da transação
    $table->json('metadata')->nullable();

    // Datas
    $table->timestamp('created_at')->useCurrent();

    // Índices
    $table->index(['origem_type', 'origem_id']);
    $table->index('provider_id');
    $table->index('usuario_id');
    $table->index('status');
    $table->index('data_liberacao');
    $table->index('codigo_transacao');
});}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('extrato_providers');
    }
};