<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * A compra avulsa de produto (AgendamentoController::storeProdutoCarrinho)
     * cria um Agendamento "casca" sem serviço, só para servir de pedido/pagamento
     * — mas servico_id era NOT NULL, então esse fluxo sempre quebrava com uma
     * violação de not-null antes mesmo de chegar na tela de pagamento.
     */
    public function up(): void
    {
        DB::statement('ALTER TABLE agendamentos ALTER COLUMN servico_id DROP NOT NULL');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE agendamentos ALTER COLUMN servico_id SET NOT NULL');
    }
};
