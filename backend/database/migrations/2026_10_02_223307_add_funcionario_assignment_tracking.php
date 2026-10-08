<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('agendamentos', function (Blueprint $table) {
            // Quem atribuiu o funcionário a este agendamento (sócio/gerente, ou o
            // próprio funcionário quando "pega" um atendimento livre para si).
            $table->foreignId('atribuido_por')->nullable()->after('funcionario_id')->constrained('users')->nullOnDelete();
        });

        Schema::table('alugueis', function (Blueprint $table) {
            $table->foreignId('funcionario_id')->nullable()->after('item_aluguel_id')->constrained('funcionarios')->nullOnDelete();
            $table->foreignId('atribuido_por')->nullable()->after('funcionario_id')->constrained('users')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('agendamentos', function (Blueprint $table) {
            $table->dropConstrainedForeignId('atribuido_por');
        });

        Schema::table('alugueis', function (Blueprint $table) {
            $table->dropConstrainedForeignId('funcionario_id');
            $table->dropConstrainedForeignId('atribuido_por');
        });
    }
};
