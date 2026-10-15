<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Última localização que o app enviou: usada para avisar só quem já está na cidade de um Flash Deal.
        Schema::table('users', function (Blueprint $table) {
            $table->decimal('ultima_latitude', 10, 7)->nullable();
            $table->decimal('ultima_longitude', 10, 7)->nullable();
            $table->string('ultima_cidade', 120)->nullable();
            $table->timestamp('ultima_localizacao_em')->nullable()->index();
        });

        Schema::create('flash_deals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('criado_por')->constrained('users')->cascadeOnDelete();
            $table->string('alvo_tipo', 20); // item_aluguel | servico
            $table->unsignedBigInteger('alvo_id');
            $table->string('alvo_nome', 150);
            $table->unsignedBigInteger('estabelecimento_id')->nullable(); // local do serviço (itens usam o dono)
            $table->unsignedTinyInteger('percentual');
            $table->unsignedInteger('quantidade');
            $table->unsignedInteger('usados')->default(0);
            $table->string('cidade', 120)->nullable();
            $table->string('estado', 2)->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->unsignedSmallInteger('raio_km')->default(30);
            $table->timestamp('inicia_em');
            $table->timestamp('expira_em');
            $table->string('status', 20)->default('ativo'); // ativo | encerrado | esgotado | cancelado
            $table->json('promocao_anterior')->nullable();
            $table->unsignedInteger('notificados')->default(0);
            $table->timestamps();

            $table->index(['status', 'expira_em']);
            $table->index(['alvo_tipo', 'alvo_id', 'status']);
            $table->index(['criado_por', 'created_at']);
        });

        Schema::create('flash_deal_avisos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('flash_deal_id')->constrained('flash_deals')->cascadeOnDelete();
            $table->foreignId('usuario_id')->constrained('users')->cascadeOnDelete();
            $table->timestamp('clicado_em')->nullable();
            $table->timestamp('convertido_em')->nullable();
            $table->timestamps();

            $table->unique(['flash_deal_id', 'usuario_id']);
            $table->index(['usuario_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('flash_deal_avisos');
        Schema::dropIfExists('flash_deals');
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['ultima_latitude', 'ultima_longitude', 'ultima_cidade', 'ultima_localizacao_em']);
        });
    }
};
