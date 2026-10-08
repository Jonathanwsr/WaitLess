<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Taxa da plataforma de cada parcela paga: via split (online) ou lançada como saldo devedor (baixa manual). */
    public function up(): void
    {
        Schema::table('cobranca_parcelas', function (Blueprint $table) {
            $table->decimal('taxa_plataforma', 12, 2)->default(0)->after('valor');
        });
    }

    public function down(): void
    {
        Schema::table('cobranca_parcelas', function (Blueprint $table) {
            $table->dropColumn('taxa_plataforma');
        });
    }
};
