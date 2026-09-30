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
        Schema::table('itens_aluguel', function (Blueprint $table) {
            $table->string('local_retirada', 500)->nullable()->after('fotos');
            $table->string('local_entrega', 500)->nullable()->after('local_retirada');
            $table->time('horario_retirada')->nullable()->after('local_entrega');
            $table->time('horario_entrega')->nullable()->after('horario_retirada');
            $table->longText('informacoes_extras')->nullable()->after('horario_entrega');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('itens_aluguel', function (Blueprint $table) {
            $table->dropColumn(['local_retirada', 'local_entrega', 'horario_retirada', 'horario_entrega', 'informacoes_extras']);
        });
    }
};
