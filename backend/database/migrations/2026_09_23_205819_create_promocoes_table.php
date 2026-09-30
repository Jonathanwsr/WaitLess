<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tabela nova para campanhas/promoções administradas pela Lokyva (não por
     * um estabelecimento específico) — cobre "pontos para todos os usuários",
     * "oferta exclusiva para assinantes de um plano" e vínculo opcional com um
     * cupom já existente (tabela `cupons`, que continua sendo por
     * estabelecimento e não é duplicada aqui).
     */
    public function up(): void
    {
        Schema::create('promocoes', function (Blueprint $table) {
            $table->id();
            $table->string('nome');
            $table->text('descricao')->nullable();
            $table->enum('tipo', ['pontos_todos', 'pontos_plano', 'oferta_assinantes', 'cupom'])->default('pontos_todos');

            // Benefício concedido pela campanha
            $table->unsignedInteger('quantidade_pontos')->nullable();
            $table->foreignId('cupom_id')->nullable()->constrained('cupons')->nullOnDelete();
            $table->decimal('desconto_percentual', 5, 2)->nullable();
            $table->decimal('desconto_valor', 10, 2)->nullable();

            // Elegibilidade
            $table->enum('publico_alvo', ['todos', 'clientes', 'proprietarios'])->default('todos');
            $table->string('plano_necessario')->nullable(); // ex: premium, premium-plus, premium-socio

            // Vigência e limite
            $table->date('data_inicio');
            $table->date('data_fim')->nullable();
            $table->unsignedInteger('limite_utilizacao')->nullable();
            $table->unsignedInteger('utilizacoes_atuais')->default(0);

            $table->boolean('ativo')->default(true);
            $table->text('condicoes')->nullable();
            $table->string('imagem')->nullable();

            // Controle de execução (campanhas tipo "conceder para todos" só
            // podem rodar uma vez — evita duplicar pontos se o admin clicar de novo)
            $table->timestamp('executada_em')->nullable();

            $table->foreignId('criado_por')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('promocoes');
    }
};
