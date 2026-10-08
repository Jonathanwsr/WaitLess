<?php

namespace App\Services\Viagem;

use App\Models\Agendamento;
use App\Models\Aluguel;
use App\Models\Viagem;

/**
 * Desconto de grupo: quando membros da mesma viagem colaborativa reservam o
 * MESMO serviço/locação (dentro do período da viagem), cada um ganha um
 * desconto extra e pontos de bônus — incentiva o grupo inteiro a reservar
 * junto em vez de cada um procurar por conta própria.
 *
 * Funciona contando reservas de verdade (Agendamento/Aluguel) dos membros da
 * viagem pra esse mesmo serviço/item, não depende de "compartilhar" a
 * reserva manualmente na agenda da viagem — assim que a 2ª pessoa do grupo
 * reserva a mesma coisa, ela já sai com desconto.
 */
class DescontoGrupoService
{
    /** A partir de quantas pessoas do grupo (incluindo quem está reservando agora) o desconto vale. */
    public const MINIMO_PARTICIPANTES = 2;

    public const PERCENTUAL_DESCONTO = 10;

    /** Pontos de bônus por pessoa, além dos pontos normais do pagamento. */
    public const PONTOS_BONUS = 200;

    /** Quantos membros da viagem (sem contar quem está reservando agora) já têm reserva ativa para o mesmo serviço/item. */
    public function contarJaReservaram(Viagem $viagem, ?int $servicoId, ?int $itemAluguelId, int $usuarioAtualId): int
    {
        if (!$servicoId && !$itemAluguelId) {
            return 0;
        }

        $membrosIds = $viagem->membros()->pluck('users.id')
            ->push($viagem->criador_id)
            ->unique()
            ->reject(fn ($id) => (int) $id === $usuarioAtualId)
            ->values();

        if ($membrosIds->isEmpty()) {
            return 0;
        }

        if ($servicoId) {
            $query = Agendamento::whereIn('usuario_id', $membrosIds)
                ->where('servico_id', $servicoId)
                ->whereNotIn('status', ['cancelado']);

            if ($viagem->data_inicio && $viagem->data_fim) {
                $query->whereBetween('data_agendamento', [$viagem->data_inicio, $viagem->data_fim]);
            }

            return $query->count();
        }

        return Aluguel::whereIn('locatario_id', $membrosIds)
            ->where('item_aluguel_id', $itemAluguelId)
            ->whereNotIn('status', ['cancelado', 'reprovada'])
            ->count();
    }

    /**
     * @return array{elegivel: bool, participantes: int, desconto: float, valor_final: float}
     */
    public function calcular(Viagem $viagem, float $valorOriginal, ?int $servicoId, ?int $itemAluguelId, int $usuarioAtualId): array
    {
        $jaReservaram = $this->contarJaReservaram($viagem, $servicoId, $itemAluguelId, $usuarioAtualId);
        $participantes = $jaReservaram + 1;

        if ($participantes < self::MINIMO_PARTICIPANTES || $valorOriginal <= 0) {
            return ['elegivel' => false, 'participantes' => $participantes, 'desconto' => 0.0, 'valor_final' => round($valorOriginal, 2)];
        }

        $desconto = round($valorOriginal * self::PERCENTUAL_DESCONTO / 100, 2);

        return [
            'elegivel' => true,
            'participantes' => $participantes,
            'desconto' => $desconto,
            'valor_final' => max(0, round($valorOriginal - $desconto, 2)),
        ];
    }
}
