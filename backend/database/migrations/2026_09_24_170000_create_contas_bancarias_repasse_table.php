<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Contas de destino do proprietário (Pix ou conta bancária) para onde ele pode
 * mandar o saldo da carteira. Cada conta só é liberada para saque depois de
 * validada com um Pix de R$ 0,01 enviado pela plataforma.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contas_bancarias_repasse', function (Blueprint $table) {
            $table->id();
            $table->foreignId('provider_id')->constrained('providers')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();

            $table->string('apelido', 60);
            $table->string('tipo', 10); // PIX | CONTA

            // Destino via chave Pix
            $table->string('pix_key_type', 10)->nullable();
            $table->string('pix_key')->nullable();

            // Destino via dados bancários
            $table->string('banco_codigo', 10)->nullable();
            $table->string('banco_nome', 100)->nullable();
            $table->string('agencia', 10)->nullable();
            $table->string('conta', 20)->nullable();
            $table->string('conta_digito', 3)->nullable();
            $table->string('tipo_conta', 20)->nullable(); // CHECKING_ACCOUNT | SAVINGS_ACCOUNT

            $table->string('titular_nome');
            $table->string('titular_documento', 20);

            // Validação por Pix de R$ 0,01
            $table->string('status_validacao', 15)->default('pendente'); // pendente | validando | validada | falhou
            $table->timestamp('validada_em')->nullable();
            $table->unsignedBigInteger('validacao_transferencia_id')->nullable();
            $table->unsignedSmallInteger('tentativas_validacao')->default(0);
            $table->string('ultimo_erro_codigo', 60)->nullable();
            $table->text('ultimo_erro_mensagem')->nullable();

            $table->boolean('padrao')->default(false);
            $table->boolean('ativa')->default(true);
            $table->timestamps();

            $table->index(['provider_id', 'ativa']);
            $table->index('status_validacao');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contas_bancarias_repasse');
    }
};
