<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('itens_aluguel', function (Blueprint $table) {
            $table->decimal('avaliacao_media', 3, 1)->default(0); 
            $table->integer('total_avaliacoes')->default(0); 
        });
    }

    public function down(): void
    {
        Schema::table('itens_aluguel', function (Blueprint $table) {
            $table->dropColumn(['avaliacao_media', 'total_avaliacoes']);
        });
    }
};