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
        // Cria a tabela de pedidos de saque
        Schema::create('saques_funcionarios', function (Blueprint $table) {
            $table->id();
            $table->foreignId('funcionario_id')->constrained('funcionarios')->cascadeOnDelete();
            $table->decimal('valor', 10, 2);
            $table->string('status')->default('pendente'); // pendente, pago, rejeitado
            $table->timestamps();
        });

       
        Schema::table('funcionarios', function (Blueprint $table) {
            if (!Schema::hasColumn('funcionarios', 'meta_mensal')) {
                $table->decimal('meta_mensal', 10, 2)->nullable()->default(5000.00);
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('saques_funcionarios');
    }
};
