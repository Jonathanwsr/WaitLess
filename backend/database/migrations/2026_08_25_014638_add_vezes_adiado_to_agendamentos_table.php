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
    Schema::table('agendamentos', function (Blueprint $table) {
        $table->integer('vezes_adiado')->default(0)->after('adiado_ate');
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('agendamentos', function (Blueprint $table) {
            //
        });
    }
};
