<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Lista de espera: o cliente pede aviso quando abrir vaga num dia (ou horário) que estava lotado. */
    public function up(): void
    {
        Schema::create('lista_espera', function (Blueprint $table) {
            $table->id();
            $table->foreignId('usuario_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('servico_id')->constrained('servicos')->cascadeOnDelete();
            $table->foreignId('estabelecimento_id')->constrained('estabelecimentos')->cascadeOnDelete();
            $table->date('data');
            $table->string('hora', 5)->nullable(); // null = qualquer horário do dia
            $table->string('status', 20)->default('aguardando'); // aguardando | avisado | cancelado
            $table->timestamp('avisado_em')->nullable();
            $table->timestamps();

            $table->index(['servico_id', 'data', 'status']);
            $table->unique(['usuario_id', 'servico_id', 'data', 'hora'], 'lista_espera_unica');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lista_espera');
    }
};
