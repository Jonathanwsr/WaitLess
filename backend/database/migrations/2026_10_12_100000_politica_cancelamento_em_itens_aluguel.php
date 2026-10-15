<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Política de cancelamento de cada item de reserva (modelo Airbnb): flexivel, moderada, firme ou
     * rigorosa. Reservas de 28 dias ou mais usam a política de longa duração automaticamente.
     */
    public function up(): void
    {
        Schema::table('itens_aluguel', function (Blueprint $table) {
            $table->string('politica_cancelamento', 20)->default('moderada');
        });

        Schema::table('alugueis', function (Blueprint $table) {
            // Quem cancelou e quanto voltou: o cliente e o admin veem o motivo do valor devolvido.
            $table->foreignId('cancelado_por_usuario_id')->nullable()->constrained('users')->nullOnDelete();
            $table->decimal('valor_reembolsado', 12, 2)->nullable();
            $table->string('politica_aplicada', 20)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('alugueis', function (Blueprint $table) {
            $table->dropConstrainedForeignId('cancelado_por_usuario_id');
            $table->dropColumn(['valor_reembolsado', 'politica_aplicada']);
        });

        Schema::table('itens_aluguel', function (Blueprint $table) {
            $table->dropColumn('politica_cancelamento');
        });
    }
};
