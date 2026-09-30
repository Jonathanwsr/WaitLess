<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Reaproveita o ledger de pontos já existente (historico_pontos) para as
     * campanhas administrativas em vez de criar uma segunda tabela de
     * movimentação. Duas mudanças:
     * 1) estabelecimento_id passa a ser opcional — pontos de campanha da
     *    Lokyva não pertencem a um estabelecimento específico;
     * 2) promocao_id (nullable) liga o lançamento à campanha que o gerou,
     *    pra exibir "de onde vieram" esses pontos no extrato do usuário.
     */
    public function up(): void
    {
        Schema::table('historico_pontos', function (Blueprint $table) {
            $table->foreignId('promocao_id')->nullable()->after('agendamento_id')->constrained('promocoes')->nullOnDelete();
        });

        // Alterar a nullability de uma coluna existente exige o doctrine/dbal
        // (change()) — como o projeto já roda em Postgres, fazemos direto via
        // SQL puro pra não depender dessa lib extra.
        DB::statement('ALTER TABLE historico_pontos ALTER COLUMN estabelecimento_id DROP NOT NULL');
    }

    public function down(): void
    {
        Schema::table('historico_pontos', function (Blueprint $table) {
            $table->dropConstrainedForeignId('promocao_id');
        });

        DB::statement('ALTER TABLE historico_pontos ALTER COLUMN estabelecimento_id SET NOT NULL');
    }
};
