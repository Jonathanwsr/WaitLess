<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Roteiro inteligente (premium) e agenda compartilhada de grupo.
 * Estende `viagens`/`viagem_usuario` (já usadas pelo Assistente de Viagens)
 * com: itens do roteiro, presença por item, despesas com divisão automática,
 * acertos entre membros e chat do grupo.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('viagens', function (Blueprint $table) {
            $table->string('cidade', 120)->nullable()->after('destino');
            $table->string('estado', 2)->nullable()->after('cidade');
            $table->string('codigo_convite', 16)->nullable()->unique();
            $table->json('preferencias')->nullable();
            $table->string('status', 15)->default('planejando'); // planejando | confirmada | concluida | cancelada
        });

        Schema::table('viagem_usuario', function (Blueprint $table) {
            // Presença do membro na viagem: pendente | confirmado | recusado
            $table->string('presenca', 12)->default('pendente');
        });
        // Quem já estava nas viagens antes deste recurso não precisa "aceitar" de novo.
        DB::table('viagem_usuario')->update(['presenca' => 'confirmado']);

        Schema::create('viagem_itens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('viagem_id')->constrained('viagens')->cascadeOnDelete();
            $table->date('dia')->nullable();
            $table->date('data_fim')->nullable(); // hospedagem/transporte que atravessam vários dias
            $table->unsignedSmallInteger('ordem')->default(0);
            $table->time('hora_inicio')->nullable();
            $table->time('hora_fim')->nullable();

            $table->string('tipo', 20); // hospedagem | transporte | servico | atracao | livre | personalizado
            $table->string('titulo');
            $table->text('descricao')->nullable();
            $table->string('endereco')->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();

            // Vínculo com o catálogo do Lokyva (sem FK: o item do catálogo pode ser removido depois)
            $table->unsignedBigInteger('estabelecimento_id')->nullable();
            $table->unsignedBigInteger('servico_id')->nullable();
            $table->unsignedBigInteger('item_aluguel_id')->nullable();

            $table->decimal('custo_estimado', 12, 2)->default(0); // total para o grupo
            $table->unsignedSmallInteger('deslocamento_min')->nullable(); // tempo desde o item anterior
            $table->decimal('distancia_km', 6, 1)->nullable();
            $table->boolean('destaque_premium')->default(false);
            $table->decimal('score', 6, 2)->nullable();

            // sugerido | reservado | confirmado | cancelado
            $table->string('status', 15)->default('sugerido');
            $table->unsignedBigInteger('agendamento_id')->nullable();
            $table->unsignedBigInteger('aluguel_id')->nullable();
            $table->foreignId('reservado_por_id')->nullable()->constrained('users')->nullOnDelete();

            $table->foreignId('criado_por_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('origem', 10)->default('auto'); // auto (roteiro inteligente) | manual
            $table->timestamps();

            $table->index(['viagem_id', 'dia', 'ordem']);
        });

        Schema::create('viagem_item_presencas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('viagem_item_id')->constrained('viagem_itens')->cascadeOnDelete();
            $table->foreignId('usuario_id')->constrained('users')->cascadeOnDelete();
            $table->string('status', 12); // confirmado | talvez | recusado
            $table->timestamps();

            $table->unique(['viagem_item_id', 'usuario_id']);
        });

        Schema::create('viagem_despesas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('viagem_id')->constrained('viagens')->cascadeOnDelete();
            $table->foreignId('viagem_item_id')->nullable()->constrained('viagem_itens')->nullOnDelete();
            $table->foreignId('pagador_id')->constrained('users')->cascadeOnDelete();
            $table->string('descricao');
            $table->decimal('valor', 12, 2);
            $table->date('data_despesa');
            $table->string('categoria', 20)->nullable();
            $table->foreignId('criado_por_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();

            $table->index('viagem_id');
        });

        Schema::create('viagem_despesa_partes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('viagem_despesa_id')->constrained('viagem_despesas')->cascadeOnDelete();
            $table->foreignId('usuario_id')->constrained('users')->cascadeOnDelete();
            $table->decimal('valor', 12, 2); // quanto essa pessoa deve dentro da despesa
            $table->timestamps();

            $table->unique(['viagem_despesa_id', 'usuario_id']);
        });

        // Acertos: "Ana pagou R$ 50 ao Bruno" — entram no saldo de cada um.
        Schema::create('viagem_pagamentos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('viagem_id')->constrained('viagens')->cascadeOnDelete();
            $table->foreignId('de_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('para_id')->constrained('users')->cascadeOnDelete();
            $table->decimal('valor', 12, 2);
            $table->string('observacao')->nullable();
            $table->foreignId('criado_por_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();

            $table->index('viagem_id');
        });

        Schema::create('viagem_mensagens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('viagem_id')->constrained('viagens')->cascadeOnDelete();
            $table->foreignId('usuario_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('tipo', 10)->default('texto'); // texto | sistema
            $table->text('conteudo');
            $table->timestamps();

            $table->index(['viagem_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('viagem_mensagens');
        Schema::dropIfExists('viagem_pagamentos');
        Schema::dropIfExists('viagem_despesa_partes');
        Schema::dropIfExists('viagem_despesas');
        Schema::dropIfExists('viagem_item_presencas');
        Schema::dropIfExists('viagem_itens');

        Schema::table('viagem_usuario', fn (Blueprint $t) => $t->dropColumn('presenca'));
        Schema::table('viagens', function (Blueprint $t) {
            $t->dropUnique(['codigo_convite']);
            $t->dropColumn(['cidade', 'estado', 'codigo_convite', 'preferencias', 'status']);
        });
    }
};
