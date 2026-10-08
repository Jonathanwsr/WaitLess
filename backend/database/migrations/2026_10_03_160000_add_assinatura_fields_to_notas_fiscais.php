<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Nota fiscal passa a cobrir também a cobrança da ASSINATURA premium (do
     * sócio ou do cliente) — essa é emitida pela própria plataforma (chave
     * Asaas master), não pela subconta do prestador, então pagamento_id e
     * provider_id (exclusivos do fluxo de venda) precisam ser opcionais.
     */
    public function up(): void
    {
        Schema::table('notas_fiscais', function (Blueprint $table) {
            $table->foreignId('assinatura_id')->nullable()->after('provider_id')->constrained('assinaturas')->nullOnDelete();
            $table->foreignId('usuario_id')->nullable()->after('assinatura_id')->constrained('users')->nullOnDelete();
            $table->string('tipo')->default('venda')->after('usuario_id'); // 'venda' (prestador) | 'assinatura' (plataforma)
        });

        DB::statement('ALTER TABLE notas_fiscais ALTER COLUMN pagamento_id DROP NOT NULL');
        DB::statement('ALTER TABLE notas_fiscais ALTER COLUMN provider_id DROP NOT NULL');
    }

    public function down(): void
    {
        Schema::table('notas_fiscais', function (Blueprint $table) {
            $table->dropConstrainedForeignId('assinatura_id');
            $table->dropConstrainedForeignId('usuario_id');
            $table->dropColumn('tipo');
        });

        DB::statement('ALTER TABLE notas_fiscais ALTER COLUMN pagamento_id SET NOT NULL');
        DB::statement('ALTER TABLE notas_fiscais ALTER COLUMN provider_id SET NOT NULL');
    }
};
