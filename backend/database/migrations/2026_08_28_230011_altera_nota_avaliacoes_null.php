<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('avaliacoes', function (Blueprint $table) {
            $table->integer('nota')->nullable()->change();
            $table->integer('nota_localizacao')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('avaliacoes', function (Blueprint $table) {
            $table->integer('nota')->nullable(false)->change();
            $table->integer('nota_localizacao')->nullable(false)->change();
        });
    }
};