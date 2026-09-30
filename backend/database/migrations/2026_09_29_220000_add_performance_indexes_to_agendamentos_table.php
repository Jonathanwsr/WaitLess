<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Índices de performance para `agendamentos`, a tabela mais consultada do
 * sistema (fila, dashboard, agenda de funcionários, relatórios). No Postgres,
 * uma foreign key NÃO cria índice automático na coluna que referencia — só a
 * tabela/coluna referenciada já tem índice via chave primária. Sem estes
 * índices, toda consulta por estabelecimento/funcionário/usuário + status +
 * data faz um full scan que só piora conforme a tabela cresce.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('agendamentos', function (Blueprint $table) {
            // Cobre a fila, a agenda de funcionários e o dashboard do dono/gerente
            // (todas filtram por estabelecimento + status + data, nesta ordem de seletividade).
            $table->index(['estabelecimento_id', 'data_agendamento', 'status'], 'idx_agendamentos_estab_data_status');

            // Cobre a agenda pessoal do funcionário e o cálculo de "última vez que atendeu".
            $table->index(['funcionario_id', 'data_agendamento', 'status'], 'idx_agendamentos_func_data_status');

            // Cobre "meus agendamentos" do cliente (dashboard, histórico).
            $table->index(['usuario_id', 'status'], 'idx_agendamentos_usuario_status');

            // Cobre filtros/relatórios por serviço (médias de avaliação, contagens).
            $table->index('servico_id', 'idx_agendamentos_servico');

            // Cobre relatórios/admin que filtram só por período, sem estabelecimento.
            $table->index('data_agendamento', 'idx_agendamentos_data');
        });
    }

    public function down(): void
    {
        Schema::table('agendamentos', function (Blueprint $table) {
            $table->dropIndex('idx_agendamentos_estab_data_status');
            $table->dropIndex('idx_agendamentos_func_data_status');
            $table->dropIndex('idx_agendamentos_usuario_status');
            $table->dropIndex('idx_agendamentos_servico');
            $table->dropIndex('idx_agendamentos_data');
        });
    }
};
