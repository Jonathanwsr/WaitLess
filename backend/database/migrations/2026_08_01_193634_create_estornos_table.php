<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('estornos', function (Blueprint $table) {
            $table->id();
            $table->string('codigo_estorno')->unique();
            $table->foreignId('usuario_id')->constrained('users')->cascadeOnDelete(); // Cliente
            $table->foreignId('prestador_id')->constrained('users')->cascadeOnDelete(); // Dono/Sócio
            $table->foreignId('estabelecimento_id')->constrained('estabelecimentos')->cascadeOnDelete();
            
            // Relacionamentos Polimórficos / Opcionais
            $table->foreignId('servico_id')->nullable()->constrained('servicos')->nullOnDelete();
            $table->foreignId('item_aluguel_id')->nullable()->constrained('itens_aluguel')->nullOnDelete();
            $table->foreignId('pagamento_id')->constrained('pagamentos')->cascadeOnDelete();
            
            $table->string('categoria'); // SERVIÇO, ALUGUEL
            $table->string('subcategoria')->nullable(); // Ex: Hotel, Barbearia

            // Dados Financeiros
            $table->decimal('valor_pago', 10, 2);
            $table->decimal('valor_estornado', 10, 2)->default(0);
            $table->decimal('taxa_plataforma', 10, 2)->default(0);
            $table->decimal('taxa_asaas', 10, 2)->default(0);
            $table->decimal('valor_liquido', 10, 2)->default(0);
            
            // Status e Motivos
            $table->enum('status', [
                'PENDENTE', 'EM_ANALISE', 'AGUARDANDO_DOCUMENTOS', 
                'APROVADO', 'REPROVADO', 'ESTORNO_SOLICITADO_ASAAS', 
                'ESTORNADO', 'ERRO_ASAAS', 'CANCELADO'
            ])->default('PENDENTE');
            $table->string('motivo');
            $table->text('descricao_cliente');
            $table->text('descricao_admin')->nullable();
            
            $table->enum('forma_pagamento', ['PIX', 'CREDIT_CARD', 'BOLETO']);
            $table->enum('tipo_estorno', ['TOTAL', 'PARCIAL']);
            
            // Integração Gateway
            $table->string('id_transacao_asaas')->nullable();
            $table->string('id_estorno_asaas')->nullable();
            
            // Prazos e Controle de Visualização/Defesa do Prestador
            $table->boolean('prestador_visualizou')->default(false);
            $table->dateTime('data_visualizacao_prestador')->nullable();
            $table->boolean('prestador_respondeu')->default(false);
            $table->dateTime('data_resposta_prestador')->nullable();
            $table->dateTime('prazo_resposta')->nullable(); // 48h após abertura
            
            // Datas
            $table->dateTime('data_pagamento');
            $table->dateTime('data_solicitacao')->useCurrent();
            $table->dateTime('data_aprovacao')->nullable();
            $table->dateTime('data_estorno')->nullable();
            $table->dateTime('data_cancelamento')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('estornos');
    }
};
