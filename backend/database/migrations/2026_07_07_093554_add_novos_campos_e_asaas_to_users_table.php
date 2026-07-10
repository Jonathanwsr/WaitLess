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
        Schema::table('users', function (Blueprint $table) {
            // 📱 Contato
            $table->string('telefone')->nullable()->after('email');
            
            // 📊 Contadores de Histórico na Plataforma
            $table->unsignedInteger('numero_servicos')->default(0)->after('telefone');
            $table->unsignedInteger('numero_reservas')->default(0)->after('numero_servicos');

            // 💳 Integração com a API do Asaas (Pagamentos e Assinaturas)
            $table->string('asaas_customer_id')->nullable()->after('numero_reservas')->comment('ID do cliente gerado no Asaas (cus_xxxx)');
            $table->string('asaas_subscription_id')->nullable()->after('asaas_customer_id')->comment('ID da assinatura ativa no Asaas (sub_xxxx)');
            $table->string('asaas_subscription_status')->nullable()->after('asaas_subscription_id')->comment('Ex: ACTIVE, EXPIRED, OVERDUE');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'telefone',
                'numero_servicos',
                'numero_reservas',
                'asaas_customer_id',
                'asaas_subscription_id',
                'asaas_subscription_status'
            ]);
        });
    }
};