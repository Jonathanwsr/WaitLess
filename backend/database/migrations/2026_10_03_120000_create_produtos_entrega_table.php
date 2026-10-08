<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Produtos para entrega/retirada — um módulo novo, separado dos
     * "Produtos" existentes (que só servem como extra vinculado a um
     * agendamento/aluguel específico). Um produto de entrega é vendido à
     * parte, pode ou não estar vinculado a um Estabelecimento já cadastrado
     * (fica a critério do sócio), e sempre tem um endereço próprio — o ponto
     * de onde ele parte, usado como local de retirada quando o cliente busca
     * ou como origem quando é entregue.
     */
    public function up(): void
    {
        Schema::create('produtos_entrega', function (Blueprint $table) {
            $table->id();

            // Dono do produto — sempre um usuário (sócio), independente de ter
            // ou não um Estabelecimento formal cadastrado.
            $table->foreignId('usuario_id')->constrained('users')->cascadeOnDelete();

            // Vínculo opcional com um local já cadastrado — fica a critério do
            // sócio; sem isso o produto é avulso.
            $table->foreignId('estabelecimento_id')->nullable()->constrained('estabelecimentos')->nullOnDelete();

            $table->string('nome');
            $table->text('descricao')->nullable();
            $table->decimal('valor', 10, 2);
            $table->unsignedInteger('estoque_disponivel')->default(0);
            $table->boolean('ativo')->default(true);

            // Até 3 fotos (ImageKit).
            $table->json('fotos')->nullable();

            // Endereço de origem do produto (retirada quando o cliente busca,
            // ou ponto de partida quando é entregue).
            $table->string('endereco_cep', 10)->nullable();
            $table->string('endereco_rua')->nullable();
            $table->string('endereco_numero', 20)->nullable();
            $table->string('endereco_complemento')->nullable();
            $table->string('endereco_bairro')->nullable();
            $table->string('endereco_cidade')->nullable();
            $table->string('endereco_estado', 2)->nullable();
            $table->decimal('endereco_latitude', 10, 8)->nullable();
            $table->decimal('endereco_longitude', 11, 8)->nullable();

            $table->softDeletes();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('produtos_entrega');
    }
};
