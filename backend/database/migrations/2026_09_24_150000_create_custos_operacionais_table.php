<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Custos operacionais da plataforma (APIs externas, e-mail transacional, IA,
 * hospedagem...) não têm nenhuma integração automática de billing — são
 * lançados manualmente pelo admin aqui pra entrarem no cálculo de lucro
 * real no painel de relatórios (Admin/Relatorios).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('custos_operacionais', function (Blueprint $table) {
            $table->id();
            $table->string('categoria'); // api_externa, email, ia, hospedagem, outro
            $table->string('descricao');
            $table->decimal('valor', 10, 2);
            $table->date('competencia'); // mês/ano a que o gasto se refere (sempre dia 1)
            $table->boolean('recorrente')->default(false);
            $table->foreignId('criado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('custos_operacionais');
    }
};
