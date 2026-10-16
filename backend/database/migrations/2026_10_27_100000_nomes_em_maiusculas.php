<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Padroniza os nomes já cadastrados de serviços, reservas e produtos em MAIÚSCULAS
 * (os novos já são gravados assim pelos models). Não dá para desfazer: o texto original não é guardado.
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (['servicos', 'itens_aluguel', 'produtos', 'produtos_entrega'] as $tabela) {
            if (Schema::hasTable($tabela) && Schema::hasColumn($tabela, 'nome')) {
                DB::table($tabela)->whereNotNull('nome')->update(['nome' => DB::raw('UPPER(TRIM(nome))')]);
            }
        }
    }

    public function down(): void
    {
        // Sem volta: o nome original em minúsculas não foi guardado.
    }
};
