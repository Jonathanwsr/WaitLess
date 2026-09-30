<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Locações: quantas pessoas a diária já inclui e quanto cada pessoa extra custa por dia.
        Schema::table('itens_aluguel', function (Blueprint $table) {
            $table->unsignedSmallInteger('pessoas_incluidas')->nullable();
            $table->decimal('valor_pessoa_extra', 10, 2)->nullable();
        });

        // Quantas pessoas o cliente informou na reserva (o valor já vem calculado em valor_final/valor_total).
        Schema::table('agendamentos', function (Blueprint $table) {
            $table->unsignedSmallInteger('quantidade_pessoas')->default(1);
        });
        Schema::table('alugueis', function (Blueprint $table) {
            $table->unsignedSmallInteger('quantidade_pessoas')->default(1);
        });

        // Triagem passa a valer para reservas (aluguéis, inclusive avulsos) e não só para serviços de um estabelecimento.
        // Em locação avulsa o "estabelecimento" é o próprio dono (users.id), então a FK para estabelecimentos sai.
        Schema::table('triagens', function (Blueprint $table) {
            $table->dropForeign(['estabelecimento_id']);
        });
        DB::statement('ALTER TABLE triagens ALTER COLUMN estabelecimento_id DROP NOT NULL');

        Schema::table('triagens', function (Blueprint $table) {
            $table->string('tipo', 10)->default('servico')->after('id'); // servico | reserva
            $table->foreignId('aluguel_id')->nullable()->after('agendamento_id')->constrained('alugueis')->nullOnDelete();
            $table->foreignId('dono_id')->nullable()->after('aluguel_id')->constrained('users')->nullOnDelete(); // quem analisa
            $table->foreignId('decidida_por_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('decidida_em')->nullable();
            $table->text('motivo_decisao')->nullable();
            $table->index(['dono_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::table('triagens', function (Blueprint $table) {
            $table->dropIndex(['dono_id', 'status']);
            $table->dropConstrainedForeignId('decidida_por_id');
            $table->dropConstrainedForeignId('dono_id');
            $table->dropConstrainedForeignId('aluguel_id');
            $table->dropColumn(['tipo', 'decidida_em', 'motivo_decisao']);
        });
        Schema::table('alugueis', fn (Blueprint $t) => $t->dropColumn('quantidade_pessoas'));
        Schema::table('agendamentos', fn (Blueprint $t) => $t->dropColumn('quantidade_pessoas'));
        Schema::table('itens_aluguel', fn (Blueprint $t) => $t->dropColumn(['pessoas_incluidas', 'valor_pessoa_extra']));
    }
};
