<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('itens_aluguel', function (Blueprint $table) {
            // Dados gerais
            $table->id();
            $table->foreignId('estabelecimento_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('servico_id')->nullable()->comment('Vínculo opcional com a tabela geral de serviços');
            $table->string('nome', 255);
            $table->enum('categoria', ['casa', 'apartamento', 'carro', 'moto', 'bicicleta', 'patinete', 'quadra', 'sala', 'equipamento', 'ferramenta', 'outro']);
            $table->string('modelo', 255)->nullable();
            $table->string('marca', 255)->nullable();
            $table->string('tipo', 255)->nullable();
            $table->longText('descricao')->nullable();
            $table->longText('especificacoes')->nullable();
            $table->integer('quantidade')->default(1);
            $table->boolean('disponivel')->default(true);
            $table->boolean('ativo')->default(true);

            // Valores
            $table->decimal('valor_diaria', 10, 2)->nullable();
            $table->decimal('valor_semanal', 10, 2)->nullable();
            $table->decimal('valor_mensal', 10, 2)->nullable();
            $table->decimal('valor_caucao', 10, 2)->nullable();

            // Dados para imóveis
            $table->string('endereco')->nullable();
            $table->string('numero')->nullable();
            $table->string('complemento')->nullable();
            $table->string('bairro')->nullable();
            $table->string('cidade')->nullable();
            $table->string('estado', 2)->nullable();
            $table->string('cep')->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->integer('numero_quartos')->nullable();
            $table->integer('numero_banheiros')->nullable();
            $table->integer('numero_suites')->nullable();
            $table->integer('numero_comodos')->nullable();
            $table->integer('numero_vagas')->nullable();
            $table->decimal('area_total', 10, 2)->nullable();
            $table->decimal('area_construida', 10, 2)->nullable();
            $table->boolean('mobiliado')->default(false);
            $table->boolean('aceita_pet')->default(false);
            $table->boolean('possui_wifi')->default(false);
            $table->boolean('possui_ar_condicionado')->default(false);
            $table->boolean('piscina')->default(false);
            $table->boolean('churrasqueira')->default(false);

            // Dados para veículos
            $table->string('placa')->nullable();
            $table->string('renavam')->nullable();
            $table->string('chassis')->nullable();
            $table->string('marca_veiculo')->nullable();
            $table->string('modelo_veiculo')->nullable();
            $table->integer('ano')->nullable();
            $table->string('cor')->nullable();
            $table->string('combustivel')->nullable();
            $table->string('cambio')->nullable();
            $table->integer('quilometragem')->nullable();
            $table->string('cilindrada')->nullable();
            $table->string('potencia')->nullable();
            $table->integer('portas')->nullable();
            $table->integer('lugares')->nullable();
            $table->boolean('possui_seguro')->default(false);

            // Dados para equipamentos
            $table->string('fabricante')->nullable();
            $table->string('numero_serie')->nullable();
            $table->string('patrimonio')->nullable();
            $table->string('voltagem')->nullable();
            $table->string('potencia_equipamento')->nullable();
            $table->string('peso')->nullable();
            $table->string('dimensoes')->nullable();
            $table->string('garantia')->nullable();

            // Controle
            $table->longText('observacoes')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('itens_aluguel');
    }
};