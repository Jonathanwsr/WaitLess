<?php

namespace App\Exceptions;

use Exception;

class CarteiraAsaasNaoConfiguradaException extends Exception
{
    public function __construct(string $message = 'O estabelecimento não possui uma carteira Asaas configurada.')
    {
        parent::__construct($message);
    }
}
