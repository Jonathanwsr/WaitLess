<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Venda cruzada preditiva de viagem: ofertas disparadas a partir de uma reserva de hospedagem.
     * - veiculo_pre_checkin: 2 dias antes do check-in, oferece um veículo na cidade.
     * - chegada: gatilho por localização; ao chegar, vira ofertas de restaurante e spa.
     */
    public function up(): void
    {
        Schema::create('ofertas_viagem', function (Blueprint $table) {
            $table->id();
            $table->foreignId('usuario_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('aluguel_id')->constrained('alugueis')->cascadeOnDelete();
            // veiculo_pre_checkin | chegada | chegada_restaurante | chegada_spa
            $table->string('tipo', 30);
            // agendada | aguardando_chegada | enviada | clicada | convertida | sem_oferta | cancelada | expirada
            $table->string('status', 20)->default('agendada');
            $table->timestamp('disparar_em')->nullable();
            $table->string('cidade', 120)->nullable();
            $table->string('estado', 2)->nullable();
            // O que foi oferecido: item_aluguel | estabelecimento | servico
            $table->string('alvo_tipo', 20)->nullable();
            $table->unsignedBigInteger('alvo_id')->nullable();
            $table->string('titulo', 150)->nullable();
            $table->string('mensagem', 500)->nullable();
            $table->timestamp('enviada_em')->nullable();
            $table->timestamp('clicada_em')->nullable();
            $table->timestamp('convertida_em')->nullable();
            $table->timestamps();

            $table->unique(['aluguel_id', 'tipo']);
            $table->index(['status', 'disparar_em']);
            $table->index(['usuario_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ofertas_viagem');
    }
};
