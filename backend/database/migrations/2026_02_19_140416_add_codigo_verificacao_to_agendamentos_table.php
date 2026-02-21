<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('agendamentos', function (Blueprint $table) {
           
            $table->string('codigo_verificacao', 4)->nullable()->after('status');
        });
    }

    public function down()
    {
        Schema::table('agendamentos', function (Blueprint $table) {
            $table->dropColumn('codigo_verificacao');
        });
    }
};