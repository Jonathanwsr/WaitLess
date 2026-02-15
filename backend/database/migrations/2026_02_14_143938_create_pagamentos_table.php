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
      Schema::create('pagamentos', function (Blueprint $table) {
    $table->id();
    $table->foreignId('usuario_id')->constrained('users'); // Quem pagou
    $table->foreignId('estabelecimento_id')->constrained('estabelecimentos'); // Quem recebeu
    $table->foreignId('agendamento_id')->nullable()->constrained('agendamentos');
    $table->string('gateway_pagamento')->nullable();
    $table->string('id_transacao_gateway')->nullable();
    $table->decimal('valor', 10, 2);
    $table->decimal('taxa', 10, 2)->default(0);
    $table->decimal('valor_liquido', 10, 2);
    $table->enum('status', ['pendente', 'pago', 'cancelado', 'estornado'])->default('pendente');
    $table->string('metodo_pagamento'); // pix, cartao, boleto
    $table->timestamp('data_pagamento')->nullable();
    $table->timestamps();
});
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pagamentos');
    }
};
