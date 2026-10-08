<?php

/**
 * Regras de uso de pontos de fidelidade (saldo global, users.pontos_saldo).
 */
return [
    // Cliente premium pode usar pontos mesmo em serviço/reserva cujo dono não marcou "aceita pontos".
    // Como o desconto sai do valor recebido pelo local, nesse caso o uso fica limitado a este
    // percentual do valor do pedido.
    'premium_sem_aceite_percentual' => (float) env('PONTOS_PREMIUM_SEM_ACEITE_PERCENTUAL', 20),
];
