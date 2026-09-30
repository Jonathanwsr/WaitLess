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
        Schema::create('relatorios_financeiros_semanais', function (Blueprint $table) {
            $table->id();
            $table->foreignId('usuario_id')->constrained('users')->cascadeOnDelete();
            $table->date('semana_inicio');
            $table->date('semana_fim');

            // Agendamentos (serviços)
            $table->unsignedInteger('total_agendamentos')->default(0);
            $table->decimal('receita_agendamentos', 12, 2)->default(0);

            // Aluguéis vinculados a um Estabelecimento de verdade
            $table->unsignedInteger('total_alugueis_estabelecimento')->default(0);
            $table->decimal('receita_alugueis_estabelecimento', 12, 2)->default(0);

            // Locações avulsas (dono direto, sem Estabelecimento)
            $table->unsignedInteger('total_locacoes_avulsas')->default(0);
            $table->decimal('receita_locacoes_avulsas', 12, 2)->default(0);

            $table->decimal('receita_bruta_total', 12, 2)->default(0);
            $table->decimal('taxa_plataforma_total', 12, 2)->default(0);
            $table->decimal('receita_liquida_total', 12, 2)->default(0);

            $table->timestamp('enviado_em')->nullable();
            $table->timestamps();

            $table->unique(['usuario_id', 'semana_inicio']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('relatorios_financeiros_semanais');
    }
};
