<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Mesmo motivo do índice em `agendamentos`: no Postgres a FK não cria índice
 * sozinha. `historico_pontos` é lida toda vez que alguém abre a tela de
 * pontos/gamificação (por usuário) ou o painel admin (por estabelecimento), e
 * `pagamentos` é lida toda vez que se busca o pagamento de um agendamento ou
 * se filtra por status (financeiro, extrato, estornos).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('historico_pontos', function (Blueprint $table) {
            $table->index(['usuario_id', 'created_at'], 'idx_historico_pontos_usuario_data');
            $table->index('estabelecimento_id', 'idx_historico_pontos_estabelecimento');
        });

        Schema::table('pagamentos', function (Blueprint $table) {
            $table->index('agendamento_id', 'idx_pagamentos_agendamento');
            $table->index(['estabelecimento_id', 'status'], 'idx_pagamentos_estab_status');
            $table->index('usuario_id', 'idx_pagamentos_usuario');
        });
    }

    public function down(): void
    {
        Schema::table('historico_pontos', function (Blueprint $table) {
            $table->dropIndex('idx_historico_pontos_usuario_data');
            $table->dropIndex('idx_historico_pontos_estabelecimento');
        });

        Schema::table('pagamentos', function (Blueprint $table) {
            $table->dropIndex('idx_pagamentos_agendamento');
            $table->dropIndex('idx_pagamentos_estab_status');
            $table->dropIndex('idx_pagamentos_usuario');
        });
    }
};
