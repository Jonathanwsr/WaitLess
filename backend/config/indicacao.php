<?php

/**
 * Programa de indicação ("convide um amigo"). Os pontos saem da plataforma (não do estabelecimento)
 * e valem como qualquer outro ponto: 1000 pontos = R$ 1,00.
 */
return [
    'pontos_indicador' => (int) env('INDICACAO_PONTOS_INDICADOR', 500),
    'pontos_indicado' => (int) env('INDICACAO_PONTOS_INDICADO', 300),
    // Teto de indicações recompensadas por pessoa (barra abuso do programa).
    'limite_por_indicador' => (int) env('INDICACAO_LIMITE_POR_INDICADOR', 50),
];
