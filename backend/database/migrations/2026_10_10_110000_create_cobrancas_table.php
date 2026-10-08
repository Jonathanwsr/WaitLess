<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Cobrança parcelada criada por um sócio premium para um cliente: serviços e/ou uma reserva.
     * Só vira cobrança no Asaas depois que o cliente aceita.
     */
    public function up(): void
    {
        Schema::create('cobrancas', function (Blueprint $table) {
            $table->id();
            $table->string('codigo', 20)->unique();
            $table->foreignId('estabelecimento_id')->constrained('estabelecimentos')->cascadeOnDelete();
            $table->foreignId('criado_por_usuario_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('cliente_id')->constrained('users')->cascadeOnDelete();
            $table->text('descricao')->nullable();
            // online: cada parcela vira uma cobrança no Asaas (link de pagamento). presencial: o sócio marca como paga.
            $table->string('modo', 12)->default('online');
            $table->decimal('valor_total', 12, 2);
            $table->decimal('taxa_percentual', 5, 2)->default(0);
            // aguardando_aceite | aceita | recusada | cancelada | quitada
            $table->string('status', 20)->default('aguardando_aceite');
            $table->timestamp('aceita_em')->nullable();
            $table->timestamp('recusada_em')->nullable();
            $table->timestamp('cancelada_em')->nullable();
            $table->timestamps();

            $table->index(['cliente_id', 'status']);
            $table->index(['estabelecimento_id', 'status']);
        });

        Schema::create('cobranca_itens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cobranca_id')->constrained('cobrancas')->cascadeOnDelete();
            $table->foreignId('servico_id')->nullable()->constrained('servicos')->nullOnDelete();
            $table->foreignId('agendamento_id')->nullable()->constrained('agendamentos')->nullOnDelete();
            $table->foreignId('funcionario_id')->nullable()->constrained('funcionarios')->nullOnDelete();
            $table->string('descricao', 255);
            $table->decimal('valor', 12, 2);
            $table->timestamp('data_referencia')->nullable();
            $table->timestamps();
        });

        Schema::create('cobranca_parcelas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cobranca_id')->constrained('cobrancas')->cascadeOnDelete();
            $table->unsignedSmallInteger('numero');
            $table->decimal('valor', 12, 2);
            $table->date('vencimento');
            // pendente | pago | atrasado | cancelado | estornado
            $table->string('status', 20)->default('pendente');
            $table->string('forma_pagamento', 12)->default('online');
            $table->string('asaas_payment_id')->nullable()->index();
            $table->text('invoice_url')->nullable();
            $table->timestamp('pago_em')->nullable();
            // true quando o sócio marcou a parcela como paga manualmente (dinheiro/presencial).
            $table->boolean('baixa_manual')->default(false);
            $table->timestamps();

            $table->unique(['cobranca_id', 'numero']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cobranca_parcelas');
        Schema::dropIfExists('cobranca_itens');
        Schema::dropIfExists('cobrancas');
    }
};
