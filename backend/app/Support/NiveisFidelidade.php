<?php

namespace App\Support;

/**
 * Níveis do programa de pontos da Lokyva. O nível vem do TOTAL de pontos já ganhos (não do saldo),
 * então usar pontos em descontos não faz o cliente "descer" de nível.
 */
class NiveisFidelidade
{
    /** [nome, pontos ganhos necessários] em ordem crescente. */
    private const NIVEIS = [
        ['Bronze', 0],
        ['Prata', 2000],
        ['Ouro', 10000],
        ['Diamante', 30000],
    ];

    public static function para(int $pontosGanhos): array
    {
        $atualIdx = 0;
        foreach (self::NIVEIS as $i => [, $minimo]) {
            if ($pontosGanhos >= $minimo) {
                $atualIdx = $i;
            }
        }

        [$nome, $minimo] = self::NIVEIS[$atualIdx];
        $proximo = self::NIVEIS[$atualIdx + 1] ?? null;

        return [
            'nome' => $nome,
            'pontos_ganhos' => $pontosGanhos,
            'proximo_nome' => $proximo[0] ?? null,
            'proximo_minimo' => $proximo[1] ?? null,
            'faltam' => $proximo ? max(0, $proximo[1] - $pontosGanhos) : 0,
            // 0 a 100 dentro da faixa atual (nível máximo = 100).
            'progresso' => $proximo ? (int) round((($pontosGanhos - $minimo) / max(1, $proximo[1] - $minimo)) * 100) : 100,
        ];
    }
}
