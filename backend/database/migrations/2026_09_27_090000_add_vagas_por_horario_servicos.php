<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('servicos', function (Blueprint $table) {
            // Quantos clientes podem ocupar o MESMO horário no MESMO dia (ex.: aula em grupo = 10).
            // Nulo/1 mantém o comportamento antigo: um cliente por horário.
            $table->unsignedSmallInteger('vagas_por_horario')->default(1)->after('duracao_minutos');
        });
    }

    public function down(): void
    {
        Schema::table('servicos', function (Blueprint $table) {
            $table->dropColumn('vagas_por_horario');
        });
    }
};
