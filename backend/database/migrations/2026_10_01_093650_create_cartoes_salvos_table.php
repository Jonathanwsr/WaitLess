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
        Schema::create('cartoes_salvos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            // Token tokenizado pelo Asaas (nunca guardamos número/CVV do cartão aqui).
            $table->string('token', 100);
            $table->string('bandeira', 30)->nullable();
            $table->string('ultimos_digitos', 4)->nullable();
            $table->string('nome_titular', 100)->nullable();
            $table->boolean('padrao')->default(false);
            $table->timestamps();

            $table->unique(['user_id', 'token']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('cartoes_salvos');
    }
};
