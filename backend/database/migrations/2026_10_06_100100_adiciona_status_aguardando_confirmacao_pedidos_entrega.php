<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /** Pedido com pagamento no local / direto com o vendedor: aguarda o código de 6 dígitos na entrega. */
    public function up(): void
    {
        DB::statement('ALTER TABLE pedidos_entrega DROP CONSTRAINT pedidos_entrega_status_check');
        DB::statement("ALTER TABLE pedidos_entrega ADD CONSTRAINT pedidos_entrega_status_check CHECK (status::text = ANY (ARRAY['pendente_pagamento','pago','aguardando_confirmacao','concluido','cancelado','estornado']::text[]))");
    }

    public function down(): void
    {
        DB::statement("UPDATE pedidos_entrega SET status = 'pago' WHERE status = 'aguardando_confirmacao'");
        DB::statement('ALTER TABLE pedidos_entrega DROP CONSTRAINT pedidos_entrega_status_check');
        DB::statement("ALTER TABLE pedidos_entrega ADD CONSTRAINT pedidos_entrega_status_check CHECK (status::text = ANY (ARRAY['pendente_pagamento','pago','concluido','cancelado','estornado']::text[]))");
    }
};
