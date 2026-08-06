<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Atualizando a tabela de pagamentos
        Schema::table('pagamentos', function (Blueprint $table) {
            $table->boolean('permite_estorno')->default(true)->after('status');
            $table->string('status_estorno')->nullable()->after('permite_estorno');
            $table->decimal('valor_estornado', 10, 2)->default(0)->after('status_estorno');
            $table->dateTime('data_estorno')->nullable()->after('valor_estornado');
            $table->string('codigo_estorno')->nullable()->after('data_estorno');
            $table->string('id_estorno_asaas')->nullable()->after('codigo_estorno');
        });

        // Atualizando a tabela providers (Wallet)
        Schema::table('providers', function (Blueprint $table) {
            $table->decimal('valor_retido', 10, 2)->default(0)->after('asaas_status');
            $table->decimal('valor_disponivel', 10, 2)->default(0)->after('valor_retido');
            $table->decimal('valor_estornado', 10, 2)->default(0)->after('valor_disponivel');
            $table->decimal('valor_em_analise', 10, 2)->default(0)->after('valor_estornado');
            $table->decimal('valor_liberado', 10, 2)->default(0)->after('valor_em_analise');
            $table->dateTime('data_proxima_liberacao')->nullable()->after('valor_liberado');
            $table->string('status_wallet')->default('ATIVA')->after('data_proxima_liberacao'); // ATIVA, BLOQUEADA
        });
    }

    public function down(): void
    {
        Schema::table('pagamentos', function (Blueprint $table) {
            $table->dropColumn(['permite_estorno', 'status_estorno', 'valor_estornado', 'data_estorno', 'codigo_estorno', 'id_estorno_asaas']);
        });

        Schema::table('providers', function (Blueprint $table) {
            $table->dropColumn(['valor_retido', 'valor_disponivel', 'valor_estornado', 'valor_em_analise', 'valor_liberado', 'data_proxima_liberacao', 'status_wallet']);
        });
    }
};