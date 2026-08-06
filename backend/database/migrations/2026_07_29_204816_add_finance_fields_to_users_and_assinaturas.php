<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Trava de edição de 30 dias no usuário
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('last_asaas_update')->nullable()->after('asaas_customer_id');
        });

        // Ajustes na tabela de assinaturas
        Schema::table('assinaturas', function (Blueprint $table) {
            $table->string('ciclo')->default('mensal')->after('valor_mensal'); // avulso, mensal, anual
            $table->string('metodo_pagamento')->nullable()->after('ciclo'); // pix, credit_card
            $table->string('fatura_id')->nullable()->after('gateway_assinatura_id'); // Para cobranças avulsas
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('last_asaas_update');
        });

        Schema::table('assinaturas', function (Blueprint $table) {
            $table->dropColumn(['ciclo', 'metodo_pagamento', 'fatura_id']);
        });
    }
};