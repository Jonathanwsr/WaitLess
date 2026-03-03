<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('assinaturas', function (Blueprint $table) {
            $table->id();
            // Relação com o utilizador (Dono do estabelecimento ou Cliente)
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            
            // Dados do Plano
            $table->string('nome_plano'); // 'basico', 'profissional', 'premium', 'plus'
            $table->enum('tipo_publico', ['estabelecimento', 'cliente']);
            $table->decimal('valor_mensal', 8, 2);
            
            // Controle de Status e Integração (Mercado Pago, Stripe, etc)
            $table->string('gateway_assinatura_id')->nullable(); // ID gerado pelo gateway de pagamento
            $table->enum('status', ['ativa', 'pendente', 'cancelada', 'atrasada'])->default('pendente');
            
            // Prazos
            $table->timestamp('data_inicio')->nullable();
            $table->timestamp('data_vencimento')->nullable();
            $table->timestamp('cancelada_em')->nullable();
            
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('assinaturas');
    }
};