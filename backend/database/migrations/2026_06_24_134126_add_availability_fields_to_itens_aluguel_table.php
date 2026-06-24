<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('itens_aluguel', function (Blueprint $table) {

            /*
            |--------------------------------------------------------------------------
            | DISPONIBILIDADE
            |--------------------------------------------------------------------------
            */

            // Sempre disponível
            $table->boolean('sempre_disponivel')
                ->default(true)
                ->after('valor_caucao');

            // Modo de funcionamento
            // todos
            // datas_especificas
            // dias_semana
            // dias_mes
            // personalizado
            $table->enum('tipo_disponibilidade', [
                'todos',
                'datas_especificas',
                'dias_semana',
                'dias_mes',
                'personalizado'
            ])->default('todos')->after('sempre_disponivel');

            /*
            |--------------------------------------------------------------------------
            | PERÍODO GERAL
            |--------------------------------------------------------------------------
            */

            $table->date('data_inicio_disponibilidade')->nullable();
            $table->date('data_fim_disponibilidade')->nullable();

            /*
            |--------------------------------------------------------------------------
            | DATAS ESPECÍFICAS
            |--------------------------------------------------------------------------
            */

            // Ex:
            // [
            //   "2026-12-24",
            //   "2026-12-25",
            //   "2026-12-31"
            // ]
            $table->json('datas_permitidas')->nullable();

            /*
            |--------------------------------------------------------------------------
            | DIAS DA SEMANA
            |--------------------------------------------------------------------------
            */

            // Ex:
            // [1,2,3,4,5]
            // Segunda até sexta
            $table->json('dias_semana_disponiveis')->nullable();

            /*
            |--------------------------------------------------------------------------
            | DIAS DO MÊS
            |--------------------------------------------------------------------------
            */

            // Ex:
            // [1,5,10,15,20]
            $table->json('dias_mes_disponiveis')->nullable();

            /*
            |--------------------------------------------------------------------------
            | HORÁRIOS
            |--------------------------------------------------------------------------
            */

            $table->time('horario_inicio')->nullable();

            $table->time('horario_fim')->nullable();

            // Horário máximo para devolução
            $table->time('horario_limite_devolucao')->nullable();

            /*
            |--------------------------------------------------------------------------
            | RESERVAS
            |--------------------------------------------------------------------------
            */

            // Quantidade mínima de horas antes da reserva
            $table->integer('antecedencia_reserva_horas')
                ->default(0);

            // Tempo mínimo de aluguel
            $table->integer('duracao_minima_horas')
                ->default(1);

            // Tempo máximo de aluguel
            $table->integer('duracao_maxima_horas')
                ->nullable();

            // Intervalo entre uma reserva e outra
            $table->integer('intervalo_entre_reservas_minutos')
                ->default(0);

            /*
            |--------------------------------------------------------------------------
            | BLOQUEIOS
            |--------------------------------------------------------------------------
            */

            // Datas bloqueadas
            $table->json('datas_bloqueadas')->nullable();

            // Horários bloqueados
            // [
            //   {
            //      "data":"2026-12-20",
            //      "inicio":"08:00",
            //      "fim":"12:00"
            //   }
            // ]
            $table->json('horarios_bloqueados')->nullable();

            /*
            |--------------------------------------------------------------------------
            | OBSERVAÇÃO
            |--------------------------------------------------------------------------
            */

            $table->text('observacoes_disponibilidade')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('itens_aluguel', function (Blueprint $table) {

            $table->dropColumn([
                'sempre_disponivel',
                'tipo_disponibilidade',

                'data_inicio_disponibilidade',
                'data_fim_disponibilidade',

                'datas_permitidas',

                'dias_semana_disponiveis',
                'dias_mes_disponiveis',

                'horario_inicio',
                'horario_fim',
                'horario_limite_devolucao',

                'antecedencia_reserva_horas',
                'duracao_minima_horas',
                'duracao_maxima_horas',
                'intervalo_entre_reservas_minutos',

                'datas_bloqueadas',
                'horarios_bloqueados',

                'observacoes_disponibilidade'
            ]);
        });
    }
};