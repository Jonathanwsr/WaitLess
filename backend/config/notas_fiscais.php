<?php

/**
 * Notas fiscais de serviço (NFS-e) emitidas pela PRÓPRIA Lokyva pela conta principal do Asaas.
 *
 * A receita da Lokyva é só a comissão de intermediação: o valor da venda vai direto para a
 * carteira do sócio pelo split do Asaas, e é o sócio quem emite a nota da venda para o cliente.
 * Por isso a Lokyva emite, a cada pagamento online, uma nota para o sócio pelo valor da taxa.
 *
 * Os códigos de serviço e as alíquotas dependem do município e do regime tributário da empresa:
 * preencha com o que o contador indicar. A conta principal do Asaas também precisa estar com a
 * configuração fiscal feita (município, inscrição municipal e certificado/senha da prefeitura).
 */
return [
    // Liga/desliga a nota da comissão da Lokyva para o sócio.
    'comissao_ativa' => (bool) env('NFSE_COMISSAO_ATIVA', true),

    // Comissões abaixo deste valor não geram nota individual (ex.: 0,5% de uma parcela pequena).
    'comissao_valor_minimo' => (float) env('NFSE_COMISSAO_VALOR_MINIMO', 0.01),

    // Serviço da intermediação.
    // - Cidade que emite pela NFS-e NACIONAL (Portal Nacional): informe o código de tributação nacional
    //   em NFSE_SERVICO_CODIGO (formato do portal, ex.: 10.05.01) + o nome, e deixe NFSE_SERVICO_ID vazio.
    //   O código nacional também precisa estar no cadastro do serviço na conta Asaas.
    // - Cidade que emite pela prefeitura: use o ID do Asaas (GET /invoices/municipalServices)
    //   ou o código + nome do item que o contador indicar.
    'servico_id' => env('NFSE_SERVICO_ID'),
    'servico_codigo' => env('NFSE_SERVICO_CODIGO'),
    'servico_nome' => env('NFSE_SERVICO_NOME', 'Intermediação de negócios e licenciamento de uso de plataforma digital'),

    // Alíquotas (%) e retenção de ISS da Lokyva, conforme o regime tributário da empresa.
    'impostos' => [
        'retainIss' => (bool) env('NFSE_RETER_ISS', false),
        'iss' => (float) env('NFSE_ISS', 0),
        'pis' => (float) env('NFSE_PIS', 0),
        'cofins' => (float) env('NFSE_COFINS', 0),
        'csll' => (float) env('NFSE_CSLL', 0),
        'ir' => (float) env('NFSE_IR', 0),
        'inss' => (float) env('NFSE_INSS', 0),
    ],

    'observacoes' => env('NFSE_OBSERVACOES', 'Documento emitido pela Lokyva. O valor refere-se exclusivamente à comissão de intermediação; o valor da venda foi repassado diretamente ao parceiro pelo arranjo de pagamento (split).'),
];
