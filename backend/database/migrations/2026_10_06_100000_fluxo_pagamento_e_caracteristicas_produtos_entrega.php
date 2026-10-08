<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Três formas de pagamento por pedido (online pelo Asaas com custódia,
     * pagamento no local e pagamento direto com o vendedor). Nas duas últimas o
     * pedido só é concluído quando o vendedor digita o código de 6 dígitos que o
     * cliente recebe. Também acrescenta características e categoria aos produtos
     * e o motivo de remoção feito pelo admin.
     */
    public function up(): void
    {
        Schema::table('pedidos_entrega', function (Blueprint $table) {
            $table->string('modo_pagamento', 20)->default('online')->after('metodo_pagamento'); // online | local | direto_vendedor
            $table->char('codigo_confirmacao', 6)->nullable()->after('modo_pagamento');
            $table->timestamp('liberado_em')->nullable()->after('data_conclusao');
            $table->string('disputa_status', 20)->nullable(); // solicitado | aprovado | reprovado (só pagamento fora da plataforma)
            $table->string('disputa_motivo', 255)->nullable();
            $table->text('disputa_descricao')->nullable();
            $table->timestamp('disputa_resolvida_em')->nullable();
        });

        Schema::table('produtos_entrega', function (Blueprint $table) {
            $table->string('categoria', 60)->nullable()->after('nome');
            $table->string('marca', 80)->nullable()->after('categoria');
            $table->string('unidade_medida', 20)->nullable()->after('marca');
            $table->string('peso_volume', 40)->nullable()->after('unidade_medida');
            $table->string('sku', 60)->nullable()->after('peso_volume');
            $table->json('tags')->nullable()->after('sku');
            $table->boolean('aceita_entrega')->default(true);
            $table->boolean('aceita_retirada')->default(true);
            $table->unsignedInteger('quantidade_minima')->default(1);
            $table->string('motivo_remocao', 255)->nullable();
        });

        Schema::create('notificacoes_usuario', function (Blueprint $table) {
            $table->id();
            $table->foreignId('usuario_id')->constrained('users')->cascadeOnDelete();
            $table->string('titulo', 120);
            $table->text('mensagem');
            $table->timestamp('lida_em')->nullable();
            $table->timestamps();

            $table->index(['usuario_id', 'lida_em']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notificacoes_usuario');

        Schema::table('produtos_entrega', function (Blueprint $table) {
            $table->dropColumn([
                'categoria', 'marca', 'unidade_medida', 'peso_volume', 'sku', 'tags',
                'aceita_entrega', 'aceita_retirada', 'quantidade_minima', 'motivo_remocao',
            ]);
        });

        Schema::table('pedidos_entrega', function (Blueprint $table) {
            $table->dropColumn([
                'modo_pagamento', 'codigo_confirmacao', 'liberado_em',
                'disputa_status', 'disputa_motivo', 'disputa_descricao', 'disputa_resolvida_em',
            ]);
        });
    }
};
