<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Roteiro de Viagem (dia a dia, Manhã/Tarde/Noite), separado das "viagens em grupo" que já existem:
 * mistura pontos turísticos do Guia do Local, locações do Lokyva e anotações do usuário.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('roteiros', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('titulo', 200);
            $table->string('destino', 150);
            $table->string('estado', 60)->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->date('data_inicio');
            $table->date('data_fim');
            $table->unsignedSmallInteger('pessoas')->default(1);
            $table->decimal('orcamento', 10, 2)->nullable();
            $table->json('interesses')->nullable();
            // De onde o primeiro deslocamento de cada dia é calculado.
            $table->string('partida', 20)->default('centro'); // centro | hospedagem | localizacao
            $table->decimal('partida_latitude', 10, 7)->nullable();
            $table->decimal('partida_longitude', 10, 7)->nullable();
            $table->string('token_compartilhamento', 64)->nullable()->unique();
            $table->timestamps();

            $table->index(['user_id', 'data_inicio']);
        });

        Schema::create('roteiro_dias', function (Blueprint $table) {
            $table->id();
            $table->foreignId('roteiro_id')->constrained('roteiros')->cascadeOnDelete();
            $table->unsignedSmallInteger('numero');
            $table->date('data');
            $table->timestamps();

            $table->unique(['roteiro_id', 'numero']);
        });

        Schema::create('roteiro_itens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('roteiro_id')->constrained('roteiros')->cascadeOnDelete();
            $table->foreignId('roteiro_dia_id')->constrained('roteiro_dias')->cascadeOnDelete();
            $table->string('periodo', 10); // manha | tarde | noite
            $table->unsignedSmallInteger('ordem')->default(0);
            $table->string('tipo', 20); // ponto_turistico | locacao | anotacao
            $table->string('titulo', 250);
            $table->text('descricao')->nullable();
            $table->string('categoria', 40)->nullable(); // hospedagem, veiculos, restaurantes, passeios…
            $table->string('hora', 5)->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            // Ponto turístico: página da Wikipédia (atribuição exigida pela licença CC BY-SA).
            $table->string('link', 500)->nullable();
            $table->string('imagem', 500)->nullable();
            // Locação do Lokyva.
            $table->foreignId('servico_id')->nullable()->constrained('servicos')->nullOnDelete();
            $table->foreignId('item_aluguel_id')->nullable()->constrained('itens_aluguel')->nullOnDelete();
            $table->decimal('custo_estimado', 10, 2)->default(0);
            $table->text('anotacao')->nullable();
            $table->timestamps();

            $table->index(['roteiro_dia_id', 'periodo', 'ordem']);
        });

        // "Reservar tudo": um pedido único com as reservas criadas a partir do roteiro.
        Schema::create('roteiro_pedidos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('roteiro_id')->constrained('roteiros')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('codigo', 20)->unique();
            $table->string('status', 20)->default('criado');
            $table->decimal('total', 10, 2)->default(0);
            $table->json('reservas'); // [{tipo: agendamento|aluguel, id, titulo, valor}]
            $table->json('nao_reservados')->nullable(); // [{titulo, motivo}]
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('roteiro_pedidos');
        Schema::dropIfExists('roteiro_itens');
        Schema::dropIfExists('roteiro_dias');
        Schema::dropIfExists('roteiros');
    }
};
