<?php

/**
 * Regras da carteira do proprietário (saque antecipado e validação de conta).
 * Todos os valores podem ser sobrescritos no .env sem mexer em código.
 */
return [
    // Taxa cobrada pela plataforma (Lokyva) para liberar o dinheiro ANTES do repasse semanal.
    'taxa_antecipacao_percentual' => (float) env('CARTEIRA_TAXA_ANTECIPACAO_PERCENTUAL', 2.0),
    'taxa_antecipacao_minima' => (float) env('CARTEIRA_TAXA_ANTECIPACAO_MINIMA', 3.00),

    // Planos que liberam ver a carteira Asaas completa e sacar antes do repasse semanal.
    'planos_saque' => ['premium-socio-anual'],

    // Menor valor que pode ser sacado de uma vez.
    'saque_minimo' => (float) env('CARTEIRA_SAQUE_MINIMO', 20.00),

    // Valor do Pix enviado para provar que a conta cadastrada é real e do titular.
    'valor_validacao' => 0.01,

    // Wallet (walletId) da conta mãe da plataforma no Asaas: é para onde a taxa de antecipação
    // é transferida, por transferência interna entre contas Asaas.
    'wallet_plataforma' => env('ASAAS_PLATFORM_WALLET_ID'),
];
