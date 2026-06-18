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
    Schema::create('conversas', function (Blueprint $table) {
        $table->id();
        $table->foreignId('usuario_id')->constrained('users')->onDelete('cascade'); // O Paciente/Cliente
        $table->foreignId('estabelecimento_id')->constrained('estabelecimentos')->onDelete('cascade'); // A Clínica/Loja
        $table->timestamps();

      
        $table->unique(['usuario_id', 'estabelecimento_id']);
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('conversas');
    }
};
