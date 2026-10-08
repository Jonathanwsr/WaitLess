<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Permite que o admin vincule uma promoção a um serviço ou item de
     * aluguel específico, para que ela apareça como card clicável no
     * Explorar/Promoções e leve direto para a tela real de agendamento/
     * reserva daquele item (nunca os dois ao mesmo tempo — ver validação em
     * AdminPromocaoController::regrasValidacao()).
     */
    public function up(): void
    {
        Schema::table('promocoes', function (Blueprint $table) {
            $table->foreignId('servico_id')->nullable()->after('cupom_id')->constrained('servicos')->nullOnDelete();
            $table->foreignId('item_aluguel_id')->nullable()->after('servico_id')->constrained('itens_aluguel')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('promocoes', function (Blueprint $table) {
            $table->dropConstrainedForeignId('servico_id');
            $table->dropConstrainedForeignId('item_aluguel_id');
        });
    }
};
