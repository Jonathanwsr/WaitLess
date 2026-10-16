<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Ofertas Exclusivas via Mensagem: o local manda cupom + comunicado para quem favoritou
 * (o local, um serviço ou uma reserva dele). A mensagem entra na conversa normal do cliente
 * com o local, marcada como "oferta" para o chat mostrar o cartão do cupom.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mensagens', function (Blueprint $table) {
            $table->string('tipo', 20)->default('texto')->after('tipo_remetente'); // texto | oferta
            $table->foreignId('cupom_id')->nullable()->after('tipo')->constrained('cupons')->nullOnDelete();
            $table->foreignId('oferta_id')->nullable()->after('cupom_id');
        });

        Schema::create('ofertas_favoritos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('estabelecimento_id')->constrained('estabelecimentos')->cascadeOnDelete();
            $table->foreignId('enviada_por')->constrained('users')->cascadeOnDelete();
            $table->foreignId('cupom_id')->nullable()->constrained('cupons')->nullOnDelete();
            $table->string('titulo', 120);
            $table->text('mensagem');
            $table->unsignedInteger('destinatarios')->default(0);
            $table->timestamps();

            $table->index(['estabelecimento_id', 'created_at']);
        });

        Schema::table('mensagens', function (Blueprint $table) {
            $table->foreign('oferta_id')->references('id')->on('ofertas_favoritos')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('mensagens', function (Blueprint $table) {
            $table->dropForeign(['oferta_id']);
            $table->dropForeign(['cupom_id']);
            $table->dropColumn(['tipo', 'cupom_id', 'oferta_id']);
        });
        Schema::dropIfExists('ofertas_favoritos');
    }
};
