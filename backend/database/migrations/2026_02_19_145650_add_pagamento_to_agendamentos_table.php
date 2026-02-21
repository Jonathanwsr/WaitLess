<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
{
    Schema::table('agendamentos', function (Blueprint $table) {
        $table->string('pagamento_id')->nullable()->after('codigo_verificacao');
        $table->string('status_pagamento')->default('aguardando')->after('pagamento_id');
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
