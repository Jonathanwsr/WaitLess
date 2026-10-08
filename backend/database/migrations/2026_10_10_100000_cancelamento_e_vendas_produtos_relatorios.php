<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Quem cancelou o pedido (cliente ou vendedor) e os totais de produto no relatório semanal. */
    public function up(): void
    {
        Schema::table('pedidos_entrega', function (Blueprint $table) {
            $table->foreignId('cancelado_por_usuario_id')->nullable()->after('data_cancelamento')->constrained('users')->nullOnDelete();
        });

        Schema::table('relatorios_financeiros_semanais', function (Blueprint $table) {
            $table->unsignedInteger('total_produtos_vendidos')->default(0)->after('receita_locacoes_avulsas');
            $table->decimal('receita_produtos', 12, 2)->default(0)->after('total_produtos_vendidos');
        });
    }

    public function down(): void
    {
        Schema::table('relatorios_financeiros_semanais', function (Blueprint $table) {
            $table->dropColumn(['total_produtos_vendidos', 'receita_produtos']);
        });

        Schema::table('pedidos_entrega', function (Blueprint $table) {
            $table->dropConstrainedForeignId('cancelado_por_usuario_id');
        });
    }
};
