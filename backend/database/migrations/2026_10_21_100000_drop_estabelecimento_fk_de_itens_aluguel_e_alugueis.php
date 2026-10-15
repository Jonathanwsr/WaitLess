<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * `itens_aluguel.estabelecimento_id` (e `alugueis.estabelecimento_id`, que copia o valor do item)
     * é um campo de uso duplo: no catálogo do estabelecimento (ItemAluguelController) guarda um
     * `estabelecimentos.id`; na locação avulsa (LocacaoAvulsaController) guarda o `users.id` do dono.
     * A FK antiga para `users` derrubava o cadastro de reservas do estabelecimento sempre que o id do
     * local não existia como usuário. Mesma solução já aplicada em `conversas.estabelecimento_id`.
     */
    public function up(): void
    {
        DB::statement('ALTER TABLE itens_aluguel DROP CONSTRAINT IF EXISTS itens_aluguel_estabelecimento_id_foreign');
        DB::statement('ALTER TABLE alugueis DROP CONSTRAINT IF EXISTS alugueis_estabelecimento_id_foreign');
        DB::statement('CREATE INDEX IF NOT EXISTS itens_aluguel_estabelecimento_id_index ON itens_aluguel (estabelecimento_id)');
        DB::statement('CREATE INDEX IF NOT EXISTS alugueis_estabelecimento_id_index ON alugueis (estabelecimento_id)');
    }

    public function down(): void
    {
        // Não recria as FKs: com o uso duplo da coluna, elas voltariam a quebrar o catálogo do estabelecimento.
    }
};
