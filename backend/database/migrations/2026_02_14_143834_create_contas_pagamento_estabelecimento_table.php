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
       Schema::create('contas_pagamento_estabelecimento', function (Blueprint $table) {
    $table->id();
    $table->foreignId('estabelecimento_id')->constrained('estabelecimentos')->cascadeOnDelete();
    $table->string('gateway'); // asaas, stripe, mercadopago
    $table->string('id_conta_gateway')->nullable();
    $table->string('chave_pix')->nullable();
    $table->boolean('ativo')->default(true);
    $table->timestamps();
});
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('contas_pagamento_estabelecimento');
    }
};
