<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * O pagamento online de locações (cartão/Pix/boleto via Asaas) precisa gravar o
 * Pagamento ligado ao Aluguel — a tabela só conhecia agendamentos. Em locação
 * avulsa o "estabelecimento" do aluguel é o próprio dono (users.id), que não
 * existe em `estabelecimentos`, então esse vínculo passa a ser opcional.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pagamentos', function (Blueprint $table) {
            $table->foreignId('aluguel_id')->nullable()->after('agendamento_id')->constrained('alugueis')->nullOnDelete();
        });

        DB::statement('ALTER TABLE pagamentos ALTER COLUMN estabelecimento_id DROP NOT NULL');

        Schema::table('alugueis', function (Blueprint $table) {
            $table->foreignId('pagamento_id')->nullable()->constrained('pagamentos')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('alugueis', function (Blueprint $table) {
            $table->dropConstrainedForeignId('pagamento_id');
        });

        Schema::table('pagamentos', function (Blueprint $table) {
            $table->dropConstrainedForeignId('aluguel_id');
        });
    }
};
