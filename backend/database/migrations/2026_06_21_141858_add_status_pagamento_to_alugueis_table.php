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
        Schema::table('alugueis', function (Blueprint $table) {
            // Adiciona a coluna status_pagamento após forma_pagamento
            $table->string('status_pagamento')->nullable()->after('forma_pagamento')
                  ->comment('Ex: pendente, pago, cancelado, estornado');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('alugueis', function (Blueprint $table) {
            // Remove a coluna caso precise reverter
            $table->dropColumn('status_pagamento');
        });
    }
};