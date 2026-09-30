<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Livro-razão de TODA movimentação que sai da carteira Asaas de um proprietário:
 * repasse semanal, repasse antecipado (com taxa) e Pix de validação de conta.
 * Cada linha tem id e nome ("Repasse semanal", "Repasse antecipado"...), guarda o
 * que foi enviado ao Asaas, o que voltou, e — quando dá errado — o erro em
 * linguagem amigável (para o proprietário) e o detalhe técnico (para o admin).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transferencias_carteira', function (Blueprint $table) {
            $table->id();
            $table->foreignId('provider_id')->constrained('providers')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('conta_bancaria_id')->nullable()->constrained('contas_bancarias_repasse')->nullOnDelete();

            $table->string('tipo', 20);   // repasse | antecipacao | validacao
            $table->string('nome', 80);   // Repasse semanal | Repasse antecipado | Validação de conta...
            $table->string('origem', 20)->default('proprietario'); // proprietario | automatico | admin

            $table->decimal('valor_bruto', 12, 2)->default(0);     // quanto saiu da carteira
            $table->decimal('taxa_plataforma', 12, 2)->default(0); // taxa Lokyva (antecipação)
            $table->decimal('taxa_asaas', 12, 2)->default(0);      // taxa da transferência no Asaas
            $table->decimal('valor_liquido', 12, 2)->default(0);   // quanto chega na conta do proprietário

            $table->string('status', 15)->default('pendente'); // pendente | processando | concluida | falhou | cancelada
            $table->string('external_reference', 64)->unique();
            $table->string('asaas_transfer_id')->nullable()->index();
            $table->string('asaas_taxa_transfer_id')->nullable(); // transferência interna da taxa Lokyva
            // nao_aplicavel | pendente | cobrada | falhou | devolvida
            $table->string('taxa_status', 15)->default('nao_aplicavel');
            // Quanto foi abatido de providers.saldo (repasse semanal) e volta para lá se a transferência falhar depois
            $table->decimal('saldo_local_debitado', 12, 2)->default(0);
            $table->string('asaas_status', 40)->nullable();

            $table->string('erro_codigo', 60)->nullable();
            $table->text('erro_mensagem')->nullable();  // linguagem amigável
            $table->text('erro_detalhe')->nullable();   // técnico (admin)

            $table->json('payload_enviado')->nullable();
            $table->json('resposta_asaas')->nullable();

            $table->unsignedSmallInteger('tentativas')->default(0);
            $table->timestamp('processado_em')->nullable();
            $table->timestamps();

            $table->index(['tipo', 'status']);
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transferencias_carteira');
    }
};
