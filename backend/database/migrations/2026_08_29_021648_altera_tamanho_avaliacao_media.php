<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Aumenta o tamanho da coluna no banco de dados para suportar a nota 10.00
        Schema::table('estabelecimentos', function (Blueprint $table) {
            $table->decimal('avaliacao_media', 4, 2)->nullable()->change();
        });

        // Garantia extra: faz o mesmo nas outras tabelas se as colunas existirem
        if (Schema::hasColumn('servicos', 'avaliacao_media')) {
            Schema::table('servicos', function (Blueprint $table) {
                $table->decimal('avaliacao_media', 4, 2)->nullable()->change();
            });
        }

        if (Schema::hasColumn('itens_aluguel', 'avaliacao_media')) {
            Schema::table('itens_aluguel', function (Blueprint $table) {
                $table->decimal('avaliacao_media', 4, 2)->nullable()->change();
            });
        }
    }

    public function down(): void
    {
        Schema::table('estabelecimentos', function (Blueprint $table) {
            $table->decimal('avaliacao_media', 3, 2)->nullable()->change();
        });
    }
};