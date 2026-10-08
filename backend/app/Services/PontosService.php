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

    /** Percentual máximo do pedido que um premium paga com pontos onde o local não aceita pontos. */
    public static function percentualPremiumSemAceite(): float
    {
        return max(0.0, min(100.0, (float) config('pontos.premium_sem_aceite_percentual', 20)));
    }

    /**
     * Regra única de uso de pontos num serviço ou reserva.
     * - Local aceita pontos: vale o limite que ele definiu (ou o pedido inteiro, se não definiu).
     * - Local não aceita, mas o cliente é premium: pode usar até o percentual de config/pontos.php.
     * - Senão: não pode usar pontos (devolve null).
     *
     * @param object $item Servico ou ItemAluguel (precisa de aceita_pontos e maximo_pontos_permitidos)
     * @return int|null máximo de pontos permitido para este pedido, ou null se não pode usar
     */
    public static function limiteDePontos(User $user, object $item, float $subtotal): ?int
    {
        if ($subtotal <= 0) {
            return null;
        }

        if ($item->aceita_pontos) {
            $limiteDoLocal = (int) ($item->maximo_pontos_permitidos ?? 0);

            return $limiteDoLocal > 0 ? $limiteDoLocal : self::valorParaPontos($subtotal);
        }

        if ($user->isPremium()) {
            return self::valorParaPontos($subtotal * self::percentualPremiumSemAceite() / 100);
        }

        return null;
    }

    /**
     * Quantos pontos aplicar de fato: respeita a regra do item, o saldo do cliente e o subtotal.
     * Devolve 0 quando o cliente não pode usar pontos neste pedido.
     */
    public static function pontosParaPedido(User $user, object $item, int $pontosSolicitados, float $subtotal): int
    {
        $limite = self::limiteDePontos($user, $item, $subtotal);
        if ($limite === null) {
            return 0;
        }

        return self::pontosAplicaveis($user, min($pontosSolicitados, $limite), $subtotal);
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
