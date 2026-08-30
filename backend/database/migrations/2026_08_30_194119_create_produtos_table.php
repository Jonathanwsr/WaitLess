<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('produtos', function (Blueprint $table) {
            $table->id();
            $table->string('nome');
            $table->text('descricao')->nullable();
            $table->string('cor')->nullable();
            $table->string('tamanho')->nullable();
            
            // Chaves Estrangeiras
            $table->foreignId('usuario_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('estabelecimento_id')->constrained('estabelecimentos')->onDelete('cascade');
            $table->foreignId('usuario_estabelecimento_id')->nullable();
            $table->foreignId('pagamento_id')->nullable();
            $table->foreignId('servico_id')->nullable();
            $table->foreignId('agendamento_id')->nullable();
            $table->foreignId('aluguel_id')->nullable();
            
            // Valores e Promoções
            $table->boolean('is_promocao')->default(false);
            $table->decimal('valor_normal', 10, 2);
            $table->decimal('valor_promocional', 10, 2)->nullable();
            $table->decimal('valor_final', 10, 2); // Valor que será efetivamente cobrado
            
            // Arquivos e Regras de Negócio
            $table->json('fotos')->nullable(); // Array com caminhos das fotos (máx 5)
            $table->boolean('somente_premium')->default(false);
            $table->integer('estoque_disponivel')->default(0); // Vai diminuindo nas vendas
            $table->integer('quantidade_vendida')->default(0); // Soma das vendas
            
            // Categorização
            $table->string('categoria')->nullable();
            $table->string('subcategoria')->nullable();
            
            // Configuração do Produto
            $table->boolean('atrelado_reservas')->default(false); // true = atrelado, false = livre
            
            $table->timestamps();
            $table->softDeletes(); // Permite "apagar" sem deletar do banco caso tenha histórico
        });
    }
    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('produtos');
    }
};
