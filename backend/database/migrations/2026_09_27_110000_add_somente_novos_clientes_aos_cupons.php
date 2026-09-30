<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Cupom "primeira reserva": só vale para quem ainda não reservou neste local (atrai clientes novos). */
    public function up(): void
    {
        Schema::table('cupons', function (Blueprint $table) {
            $table->boolean('somente_novos_clientes')->default(false)->after('apenas_plus');
        });
    }

    public function down(): void
    {
        Schema::table('cupons', function (Blueprint $table) {
            $table->dropColumn('somente_novos_clientes');
        });
    }
};
