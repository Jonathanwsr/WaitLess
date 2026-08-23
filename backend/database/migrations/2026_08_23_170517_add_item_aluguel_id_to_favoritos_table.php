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
        Schema::table('favoritos', function (Blueprint $table) {
            // Adicionando a coluna permitindo nulo
            $table->unsignedBigInteger('item_aluguel_id')->nullable()->after('servico_id');
            
            // Criando a chave estrangeira (ajuste o nome da tabela 'itens_aluguel' se o seu banco usar outro nome)
            $table->foreign('item_aluguel_id')->references('id')->on('itens_aluguel')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('favoritos', function (Blueprint $table) {
            //
        });
    }
};
