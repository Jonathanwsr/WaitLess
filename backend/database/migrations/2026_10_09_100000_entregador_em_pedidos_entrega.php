<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Quem faz a entrega: um funcionário (pelo usuário dele) ou o próprio sócio. */
    public function up(): void
    {
        Schema::table('pedidos_entrega', function (Blueprint $table) {
            $table->foreignId('entregador_usuario_id')->nullable()->after('funcionario_id')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('pedidos_entrega', function (Blueprint $table) {
            $table->dropConstrainedForeignId('entregador_usuario_id');
        });
    }
};
