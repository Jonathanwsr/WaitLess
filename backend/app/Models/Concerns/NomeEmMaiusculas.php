<?php

namespace App\Models\Concerns;

/**
 * O nome (serviço, reserva, produto) é sempre gravado em MAIÚSCULAS, com espaços limpos —
 * vale para qualquer cadastro ou edição (site, app, importação), e é assim que aparece em
 * Explorar, vitrine, detalhes, carrinho, contratos etc.
 */
trait NomeEmMaiusculas
{
    public function setNomeAttribute($valor): void
    {
        $this->attributes['nome'] = self::nomeEmMaiusculas($valor);
    }

    public static function nomeEmMaiusculas($valor): ?string
    {
        if ($valor === null) {
            return null;
        }

        return mb_strtoupper(trim(preg_replace('/\s+/u', ' ', (string) $valor)), 'UTF-8');
    }
}
