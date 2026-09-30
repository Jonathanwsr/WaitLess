<?php

/**
 * Sistema de gamificação de pontos: check-in diário ("Estou usando"),
 * sugestões enviadas no app e bônus mensal automático por plano premium.
 * Todos os valores em pontos (1000 pontos = R$ 1,00, ver PontosService).
 * Pontos ganhos por check-in e sugestão são dobrados para quem tem
 * assinatura premium ativa (User::isPremium()) — mesma regra já aplicada
 * às avaliações e agora também às indicações.
 */
return [
    'checkin' => [
        'pontos' => (int) env('GAMIFICACAO_CHECKIN_PONTOS', 5),
    ],

    'sugestao' => [
        'pontos' => (int) env('GAMIFICACAO_SUGESTAO_PONTOS', 20),
        // Só a 1ª sugestão do dia gera pontos (as demais continuam sendo
        // registradas e visíveis ao admin, só não pontuam) — evita farm de pontos.
        'limite_pontuavel_por_dia' => 1,
    ],

    // Bônus mensal automático (recorrente, um crédito por ciclo de 30 dias
    // de assinatura ativa) para cada plano premium vendido hoje — ver
    // App\Services\PlanoService::PLANOS_PREMIUM para o catálogo de planos.
    // Valores novos, definidos para este programa (não existiam antes).
    'bonus_mensal_por_plano' => [
        'premium'             => 100, // cliente premium
        'premium-plus'        => 200, // cliente premium-plus
        'premium-socio'       => 300, // sócio premium-socio
        'premium-anual'       => 100, // sócio premium-anual
        'premium-socio-anual' => 200, // sócio premium-socio-anual
    ],
];
