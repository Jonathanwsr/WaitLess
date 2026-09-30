<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // agendamentos (serviços): hoje não tinha NENHUMA coluna de desconto
        // por pontos/cupom — só existia em alugueis.
        Schema::table('agendamentos', function (Blueprint $table) {
            $table->unsignedInteger('pontos_utilizados')->default(0)->after('valor_final');
            $table->decimal('valor_desconto_pontos', 10, 2)->nullable()->after('pontos_utilizados');
            $table->foreignId('cupom_id')->nullable()->after('valor_desconto_pontos')
                ->constrained('cupons')->nullOnDelete();
            $table->decimal('valor_desconto_cupom', 10, 2)->nullable()->after('cupom_id');
        });

        // alugueis: já tinha pontos_utilizados/valor_desconto_pontos, faltava só o cupom.
        Schema::table('alugueis', function (Blueprint $table) {
            $table->foreignId('cupom_id')->nullable()->after('valor_desconto_pontos')
                ->constrained('cupons')->nullOnDelete();
            $table->decimal('valor_desconto_cupom', 10, 2)->nullable()->after('cupom_id');
        });
    }

    public function down(): void
    {
        Schema::table('agendamentos', function (Blueprint $table) {
            $table->dropConstrainedForeignId('cupom_id');
            $table->dropColumn(['pontos_utilizados', 'valor_desconto_pontos', 'valor_desconto_cupom']);
        });

        Schema::table('alugueis', function (Blueprint $table) {
            $table->dropConstrainedForeignId('cupom_id');
            $table->dropColumn('valor_desconto_cupom');
        });
    }
};
