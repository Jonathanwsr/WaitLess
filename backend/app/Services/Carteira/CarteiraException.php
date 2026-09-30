<?php

namespace App\Services\Carteira;

use RuntimeException;

/** Regra de negócio quebrada; a mensagem já está pronta para ser exibida ao proprietário. */
class CarteiraException extends RuntimeException
{
}
