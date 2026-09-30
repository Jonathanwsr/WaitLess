<?php

/**
 * Taxas da plataforma (Lokyva). Fonte ÚNICA da porcentagem: tudo que calcula, divide ou mostra
 * a taxa lê daqui (via App\Support\Taxas), para nunca haver números diferentes em telas e cobranças.
 */
return [
    // Percentual retido pela plataforma sobre cada venda online (e registrado como valor a acertar
    // nos pagamentos presenciais). O restante vai para o proprietário. Pode ser mudado no .env.
    'plataforma_percentual' => (float) env('TAXA_PLATAFORMA_PERCENTUAL', 6.0),

    // Percentual retido quando o cliente cancela com menos de 30 minutos de antecedência.
    'cancelamento_tardio_percentual' => (float) env('TAXA_CANCELAMENTO_TARDIO_PERCENTUAL', 2.0),
];
