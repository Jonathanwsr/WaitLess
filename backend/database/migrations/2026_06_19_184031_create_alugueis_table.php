<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('alugueis', function (Blueprint $table) {
            $table->id();
            $table->string('codigo_reserva')->unique();
            $table->string('numero_contracto')->nullable();
            $table->foreignId('estabelecimento_id')->constrained('users');
            $table->foreignId('item_aluguel_id')->constrained('itens_aluguel');
            $table->foreignId('servico_id')->nullable();
            $table->foreignId('proprietario_id')->constrained('users');
            $table->foreignId('locatario_id')->constrained('users');
            $table->unsignedBigInteger('contrato_id')->nullable(); 
            
            $table->enum('tipo_periodo', ['diaria', 'semanal', 'mensal']);
            $table->integer('quantidade_periodos');
            $table->dateTime('data_inicio');
            $table->dateTime('data_fim');
            $table->dateTime('data_checkin')->nullable();
            $table->dateTime('data_checkout')->nullable();
            $table->dateTime('data_devolucao_prevista')->nullable();
            $table->dateTime('data_devolucao_real')->nullable();
            
            $table->integer('quantidade')->default(1);
            $table->decimal('valor_unitario', 10, 2);
            $table->decimal('desconto', 10, 2)->default(0.00);
            $table->decimal('taxa_servico', 10, 2)->default(0.00);
            $table->decimal('valor_caucao', 10, 2)->default(0.00);
            $table->decimal('valor_multa_atraso', 10, 2)->default(0.00);
            $table->decimal('valor_danos', 10, 2)->default(0.00);
            $table->decimal('multa_cancelamento', 10, 2)->default(0.00);
            $table->decimal('valor_total', 10, 2);
            
            $table->string('forma_pagamento', 50);
            $table->boolean('pagamento_confirmado')->default(false);
            $table->boolean('contrato_assinado')->default(false);
            $table->boolean('renovacao_automatica')->default(false);
            $table->boolean('permitir_cancelamento')->default(true);
            $table->integer('dias_antecedencia_cancelamento')->default(0);
            $table->boolean('seguro_contratado')->default(false);
            
            $table->enum('status', ['pendente', 'aguardando_pagamento', 'aguardando_assinatura', 'confirmado', 'em_andamento', 'finalizado', 'cancelado'])->default('pendente');
            $table->enum('status_vistoria', ['nao_realizada', 'aprovada', 'reprovada', 'com_ressalvas'])->default('nao_realizada');
            $table->text('motivo_cancelamento')->nullable();
            $table->tinyInteger('avaliacao_locatario')->nullable();
            $table->tinyInteger('avaliacao_proprietario')->nullable();
            $table->longText('observacoes')->nullable();
            
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('alugueis');
    }
};