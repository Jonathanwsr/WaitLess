<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Sistema de Plano
            $table->string('plano_assinatura')->default('gratuito'); 
            $table->timestamp('plano_expira_em')->nullable(); 
            
            // Sistema de Pontos (Carteira Global)
            $table->integer('pontos_saldo')->default(0); 
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['plano_assinatura', 'plano_expira_em', 'pontos_saldo']);
        });
    }
};