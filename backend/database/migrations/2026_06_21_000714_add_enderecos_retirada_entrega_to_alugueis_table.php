<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('alugueis', function (Blueprint $table) {
            // --- ENDEREÇO DE RETIRADA COMPLETO ---
            $table->string('cep_retirada', 10)->nullable()->after('forma_pagamento');
            $table->string('rua_retirada', 255)->nullable()->after('cep_retirada');
            $table->string('numero_retirada', 20)->nullable()->after('rua_retirada');
            $table->string('complemento_retirada', 255)->nullable()->after('numero_retirada');
            $table->string('bairro_retirada', 255)->nullable()->after('complemento_retirada');
            $table->string('cidade_retirada', 255)->nullable()->after('bairro_retirada');
            $table->string('estado_retirada', 2)->nullable()->after('cidade_retirada');
            $table->decimal('latitude_retirada', 10, 7)->nullable()->after('estado_retirada');
            $table->decimal('longitude_retirada', 10, 7)->nullable()->after('latitude_retirada');

            // --- ENDEREÇO DE ENTREGA COMPLETO ---
            $table->string('cep_entrega', 10)->nullable()->after('longitude_retirada');
            $table->string('rua_entrega', 255)->nullable()->after('cep_entrega');
            $table->string('numero_entrega', 20)->nullable()->after('rua_entrega');
            $table->string('complemento_entrega', 255)->nullable()->after('numero_entrega');
            $table->string('bairro_entrega', 255)->nullable()->after('complemento_entrega');
            $table->string('cidade_entrega', 255)->nullable()->after('bairro_entrega');
            $table->string('estado_entrega', 2)->nullable()->after('cidade_entrega');
            $table->decimal('latitude_entrega', 10, 7)->nullable()->after('estado_entrega');
            $table->decimal('longitude_entrega', 10, 7)->nullable()->after('latitude_entrega');
        });
    }

    public function down(): void
    {
        Schema::table('alugueis', function (Blueprint $table) {
            $table->dropColumn([
                'cep_retirada', 'rua_retirada', 'numero_retirada', 'complemento_retirada', 
                'bairro_retirada', 'cidade_retirada', 'estado_retirada', 'latitude_retirada', 'longitude_retirada',
                'cep_entrega', 'rua_entrega', 'numero_entrega', 'complemento_entrega', 
                'bairro_entrega', 'cidade_entrega', 'estado_entrega', 'latitude_entrega', 'longitude_entrega'
            ]);
        });
    }
};