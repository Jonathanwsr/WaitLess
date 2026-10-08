<?php

namespace App\Support;

/** Acesso único às taxas da plataforma (config/taxas.php). */
class Taxas
{
    /** Percentual da plataforma, ex.: 6.0 */
    public static function percentual(): float
    {
        return max(0.0, min(100.0, (float) config('taxas.plataforma_percentual', 6.0)));
    }

    /** Fração para multiplicar, ex.: 0.06 */
    public static function fracao(): float
    {
        return self::percentual() / 100;
    }

    /** Percentual que fica com o proprietário (usado no split do gateway), ex.: 94.0 */
    public static function parteDoLocalPercentual(): float
    {
        return round(100 - self::percentual(), 2);
    }

    /** Valor da taxa da plataforma sobre um total, arredondado em centavos. */
    public static function sobre(float $valor): float
    {
        return round($valor * self::fracao(), 2);
    }

    public static function cancelamentoTardioPercentual(): float
    {
        return (float) config('taxas.cancelamento_tardio_percentual', 2.0);
    }

    /** Percentual da plataforma sobre vendas de produtos para entrega/retirada, ex.: 1.0 */
    public static function percentualEntregas(): float
    {
        return max(0.0, min(100.0, (float) config('taxas.plataforma_entregas_percentual', 1.0)));
    }

    /** Percentual que fica com o vendedor na venda de um produto para entrega, ex.: 99.0 */
    public static function parteDoLocalPercentualEntregas(): float
    {
        return round(100 - self::percentualEntregas(), 2);
    }

    /** Valor da taxa da plataforma sobre uma venda de produto para entrega. */
    public static function sobreEntregas(float $valor): float
    {
        return round($valor * (self::percentualEntregas() / 100), 2);
    }

    /** Percentual da plataforma sobre pagamentos online de cobranças parceladas, ex.: 0.5 */
    public static function percentualCobrancas(): float
    {
        return max(0.0, min(100.0, (float) config('taxas.plataforma_cobrancas_percentual', 0.5)));
    }

    /** Percentual que vai para a carteira do sócio na cobrança parcelada (split), ex.: 99.5 */
    public static function parteDoSocioCobrancasPercentual(): float
    {
        return round(100 - self::percentualCobrancas(), 2);
    }
}
