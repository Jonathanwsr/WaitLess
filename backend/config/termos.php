<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Versão atual do Termo de Compromisso
    |--------------------------------------------------------------------------
    |
    | Fonte única de verdade para a versão do termo — usada na validação do
    | aceite no cadastro (web e mobile), gravada em users.termo_compromisso_versao,
    | e exibida na tela "Termos e Compromissos" do perfil pra comparar com o que
    | o usuário aceitou. Sempre que o texto do termo mudar de forma relevante,
    | incremente este valor.
    */
    'versao_atual' => '2.0',
];
