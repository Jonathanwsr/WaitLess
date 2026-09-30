<?php

namespace App\Services;

use App\Models\User;

/**
 * Centraliza a taxa de conversão de pontos de fidelidade (saldo GLOBAL,
 * users.pontos_saldo) em desconto em reais. Essa mesma taxa (1000 pontos =
 * R$1,00) já existia hardcoded, independentemente, em pelo menos 4 lugares
 * do código (AgendamentoController, MobileAgendamentoController e a UI do
 * app) — este serviço passa a ser a única fonte de verdade pra evitar
 * divergência entre eles.
 */
class PontosService
{
    public const PONTOS_POR_REAL = 1000;

    public static function valorParaPontos(float $valor): int
    {
        return (int) floor($valor * self::PONTOS_POR_REAL);
    }

    public static function pontosParaValor(int $pontos): float
    {
        return round($pontos / self::PONTOS_POR_REAL, 2);
    }

    /**
     * Quantos pontos do saldo global do usuário podem de fato ser usados
     * nesse checkout: nunca mais que o saldo dele, nunca mais do que o
     * necessário pra zerar o subtotal.
     */
    public static function pontosAplicaveis(User $user, int $pontosSolicitados, float $subtotal): int
    {
        if ($pontosSolicitados <= 0 || $subtotal <= 0) {
            return 0;
        }

        $maximoPeloSubtotal = self::valorParaPontos($subtotal);

        return max(0, min($pontosSolicitados, (int) $user->pontos_saldo, $maximoPeloSubtotal));
    }
}
