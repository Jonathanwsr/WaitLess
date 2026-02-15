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
    Schema::table('users', function (Blueprint $table) {
        // Adiciona a coluna papel. O default 'user' evita erros em registros que já existem.
        $table->string('papel')->default('user')->after('email');
    });
}

public function down(): void
{
    Schema::table('users', function (Blueprint $table) {
        // Remove a coluna caso você precise dar um rollback
        $table->dropColumn('papel');
    });
}
};