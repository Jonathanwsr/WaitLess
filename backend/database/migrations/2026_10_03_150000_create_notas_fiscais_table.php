<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Registro de cada tentativa de emissão de nota fiscal (NFS-e) via Asaas
     * — um recurso novo do plano Sócio Premium. Fica registrado mesmo quando
     * falha (ex.: o sócio ainda não configurou o município/CNAE na conta
     * Asaas dele), pra ele conseguir ver o motivo e tentar de novo depois
     * de corrigir, sem precisar abrir um chamado de suporte.
     */
    public function up(): void
    {
        Schema::create('notas_fiscais', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pagamento_id')->constrained('pagamentos')->cascadeOnDelete();
            $table->foreignId('provider_id')->constrained('providers')->cascadeOnDelete();
            $table->string('asaas_invoice_id')->nullable();
            $table->enum('status', ['AGENDADA', 'SINCRONIZADA', 'AUTORIZADA', 'CANCELADA', 'ERRO', 'NAO_CONFIGURADO'])->default('AGENDADA');
            $table->decimal('valor', 10, 2);
            $table->text('descricao_servico')->nullable();
            $table->string('pdf_url')->nullable();
            $table->text('mensagem_erro')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notas_fiscais');
    }
};
