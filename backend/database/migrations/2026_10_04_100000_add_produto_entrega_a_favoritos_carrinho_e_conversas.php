<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Produtos para entrega passam a ser favoritáveis, colocáveis no carrinho
     * e assunto de conversa com o vendedor. Carrinho próprio (e não o de
     * serviços) porque o checkout de agendamento lê o servico_id do primeiro
     * item e misturar produtos quebraria esse fluxo.
     */
    public function up(): void
    {
        Schema::table('favoritos', function (Blueprint $table) {
            $table->foreignId('produto_entrega_id')->nullable()->after('item_aluguel_id')
                ->constrained('produtos_entrega')->cascadeOnDelete();
        });

        Schema::create('carrinho_produtos_entrega', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('produto_entrega_id')->constrained('produtos_entrega')->cascadeOnDelete();
            $table->unsignedInteger('quantidade')->default(1);
            $table->timestamps();

            $table->unique(['user_id', 'produto_entrega_id']);
        });

        Schema::table('conversas', function (Blueprint $table) {
            $table->foreignId('produto_entrega_id')->nullable()->after('aluguel_id')
                ->constrained('produtos_entrega')->nullOnDelete();
            $table->foreignId('vendedor_id')->nullable()->after('produto_entrega_id')
                ->constrained('users')->nullOnDelete();
        });

        // Conversa sobre produto avulso (sem estabelecimento) não tem estabelecimento_id.
        DB::statement('ALTER TABLE conversas ALTER COLUMN estabelecimento_id DROP NOT NULL');
    }

    public function down(): void
    {
        DB::statement('UPDATE conversas SET estabelecimento_id = vendedor_id WHERE estabelecimento_id IS NULL');
        DB::statement('ALTER TABLE conversas ALTER COLUMN estabelecimento_id SET NOT NULL');

        Schema::table('conversas', function (Blueprint $table) {
            $table->dropConstrainedForeignId('vendedor_id');
            $table->dropConstrainedForeignId('produto_entrega_id');
        });

        Schema::dropIfExists('carrinho_produtos_entrega');

        Schema::table('favoritos', function (Blueprint $table) {
            $table->dropConstrainedForeignId('produto_entrega_id');
        });
    }
};
