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
        Schema::table('servicos', function (Blueprint $table) {
            $table->boolean('somente_premium')->default(false);
            $table->boolean('tem_promocao')->default(false);
            $table->enum('tipo_desconto', ['percentual', 'fixo'])->default('percentual');
            $table->decimal('valor_desconto', 10, 2)->nullable();
            $table->boolean('aceita_pontos')->default(false);
            $table->integer('maximo_pontos_permitidos')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('servicos', function (Blueprint $table) {
            $table->dropColumn([
                'somente_premium',
                'tem_promocao',
                'tipo_desconto',
                'valor_desconto',
                'aceita_pontos',
                'maximo_pontos_permitidos',
            ]);
        });
    }
};
