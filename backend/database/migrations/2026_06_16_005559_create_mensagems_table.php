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
    Schema::create('mensagens', function (Blueprint $table) {
        $table->id();
        $table->foreignId('conversa_id')->constrained('conversas')->onDelete('cascade');
        
       
        $table->unsignedBigInteger('remetente_id'); 
        $table->string('tipo_remetente'); 
        
        $table->text('conteudo');
        $table->timestamp('lida_em')->nullable(); 
        $table->timestamps();
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('mensagems');
    }
};
