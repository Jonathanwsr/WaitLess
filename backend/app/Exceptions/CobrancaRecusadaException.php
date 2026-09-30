<?php

namespace App\Exceptions;

use Exception;

/**
 * O gateway (Asaas) recusou a cobrança — ex.: cartão sem limite, dados inválidos.
 * A mensagem é segura para mostrar ao cliente.
 */
class CobrancaRecusadaException extends Exception
{
}
