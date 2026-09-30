<?php

namespace App\Exceptions;

use Symfony\Component\HttpKernel\Exception\HttpException;

/** Recurso exclusivo de assinantes Premium: vira uma tela amigável com convite para assinar. */
class PremiumRequiredException extends HttpException
{
    public function __construct(string $mensagem = 'Este recurso é exclusivo para assinantes Premium.')
    {
        parent::__construct(403, $mensagem);
    }
}
