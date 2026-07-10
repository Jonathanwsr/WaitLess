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
        Schema::table('providers', function (Blueprint $table) {

            // Tipo de pessoa
            $table->enum('person_type', ['FISICA', 'JURIDICA'])
                ->after('email');

            // Dados de contato e endereço
            $table->string('mobile_phone')->after('person_type');
            $table->string('postal_code', 8)->after('mobile_phone');
            $table->string('address')->after('postal_code');
            $table->string('address_number')->after('address');
            $table->string('complement')->nullable()->after('address_number');
            $table->string('province')->after('complement'); // Bairro

            // Campos para Pessoa Jurídica
            $table->string('company_type')->nullable()->after('province');
            $table->string('responsible_name')->nullable()->after('company_type');
            $table->string('responsible_cpf')->nullable()->after('responsible_name');

            // Dados retornados pelo Asaas
            $table->string('asaas_wallet_id')->nullable()->unique()->after('responsible_cpf');
            $table->string('asaas_api_key')->nullable()->after('asaas_wallet_id');
            $table->string('asaas_status')->default('PENDING')->after('asaas_api_key');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('providers', function (Blueprint $table) {

            $table->dropUnique(['asaas_wallet_id']);

            $table->dropColumn([
                'person_type',
                'mobile_phone',
                'postal_code',
                'address',
                'address_number',
                'complement',
                'province',
                'company_type',
                'responsible_name',
                'responsible_cpf',
                'asaas_wallet_id',
                'asaas_api_key',
                'asaas_status',
            ]);
        });
    }
};