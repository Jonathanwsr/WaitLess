<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Separa as duas informações que `itens_aluguel.estabelecimento_id` misturava:
     * - `estabelecimento_id`: SEMPRE o dono (users.id) — é o que o Explorar, a reserva, o pagamento
     *   (carteira do dono) e a locação avulsa já usam;
     * - `local_id` (novo): o estabelecimento (estabelecimentos.id) quando a reserva é do catálogo de um local.
     *
     * Corrige os itens gravados pelo catálogo do estabelecimento com o id do local no lugar do dono
     * (esses não apareciam para o cliente) e as reservas (alugueis) que copiaram esse valor.
     */
    public function up(): void
    {
        Schema::table('itens_aluguel', function (Blueprint $table) {
            $table->foreignId('local_id')->nullable()->after('estabelecimento_id')->constrained('estabelecimentos')->nullOnDelete();
        });

        // Dono de cada local: sócio/proprietário vinculado (o primeiro), senão qualquer vínculo.
        $donoDoLocal = function (int $localId): ?int {
            return DB::table('estabelecimento_usuario')->where('estabelecimento_id', $localId)
                ->orderByRaw("CASE WHEN tipo IN ('socio','proprietario') THEN 0 ELSE 1 END")
                ->orderBy('id')
                ->value('usuario_id');
        };

        $errados = DB::table('itens_aluguel')
            ->whereNull('local_id')
            ->whereNotIn('estabelecimento_id', DB::table('users')->select('id'))
            ->whereIn('estabelecimento_id', DB::table('estabelecimentos')->select('id'))
            ->get(['id', 'estabelecimento_id']);

        foreach ($errados as $item) {
            $dono = $donoDoLocal((int) $item->estabelecimento_id);
            if (!$dono) {
                continue;
            }
            DB::table('itens_aluguel')->where('id', $item->id)->update(['local_id' => $item->estabelecimento_id, 'estabelecimento_id' => $dono]);
            DB::table('alugueis')->where('item_aluguel_id', $item->id)->where('estabelecimento_id', $item->estabelecimento_id)
                ->update(['estabelecimento_id' => $dono]);
            // O dono da reserva (quem recebe o pagamento e vê a reserva) também tinha ficado com o id do local.
            DB::table('alugueis')->where('item_aluguel_id', $item->id)->where('proprietario_id', $item->estabelecimento_id)
                ->update(['proprietario_id' => $dono]);
        }
    }

    public function down(): void
    {
        Schema::table('itens_aluguel', function (Blueprint $table) {
            $table->dropConstrainedForeignId('local_id');
        });
    }
};
