<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['agendamentos', 'alugueis'] as $tabela) {
            if (!Schema::hasColumn($tabela, 'lembrete_enviado_em')) {
                Schema::table($tabela, function (Blueprint $t) {
                    $t->timestamp('lembrete_enviado_em')->nullable();
                });
            }
        }
    }

    public function down(): void
    {
        foreach (['agendamentos', 'alugueis'] as $tabela) {
            if (Schema::hasColumn($tabela, 'lembrete_enviado_em')) {
                Schema::table($tabela, fn (Blueprint $t) => $t->dropColumn('lembrete_enviado_em'));
            }
        }
    }
};
