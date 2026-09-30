<?php

namespace App\Support;

/** Acesso às categorias de serviço (config/categorias.php). O valor gravado É o rótulo em si. */
class Categorias
{
    /** Lista completa: valor (gravado em servicos.tipo_servico), ícone, cor. */
    public static function servicos(): array
    {
        return config('categorias.servicos', []);
    }

    /** Só os valores válidos (para validação do formulário). */
    public static function valores(): array
    {
        return array_column(self::servicos(), 'valor');
    }

    public static function icone(?string $valor): string
    {
        foreach (self::servicos() as $c) {
            if ($c['valor'] === $valor) {
                return $c['icone'];
            }
        }

        return 'more-horiz';
    }

    public static function cor(?string $valor): string
    {
        foreach (self::servicos() as $c) {
            if ($c['valor'] === $valor) {
                return $c['cor'];
            }
        }

        return '#6A6C72';
    }
}
