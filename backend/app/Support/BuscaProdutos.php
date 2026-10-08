<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Builder;

/**
 * Busca de produtos para entrega: ignora acentos e maiúsculas, procura cada palavra em nome,
 * descrição, categoria, local e vendedor (todas precisam aparecer) e ordena por relevância.
 * Acentos são tirados com translate() do Postgres, sem depender de extensão instalada.
 */
class BuscaProdutos
{
    private const COM_ACENTO = 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ';
    private const SEM_ACENTO = 'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn';

    private const MAX_TERMOS = 5;

    /** Expressão SQL da coluna em minúsculas e sem acento. */
    public static function semAcento(string $coluna): string
    {
        return "translate(lower(coalesce({$coluna}, '')), '" . self::COM_ACENTO . "', '" . self::SEM_ACENTO . "')";
    }

    public static function normalizar(string $texto): string
    {
        $texto = mb_strtolower(trim($texto));
        $texto = strtr($texto, array_combine(
            mb_str_split(mb_strtolower(self::COM_ACENTO)),
            mb_str_split(self::SEM_ACENTO)
        ));

        // Curingas do LIKE digitados pelo usuário viram texto comum.
        return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $texto);
    }

    /** Palavras da busca (até 5, com 2+ letras), já normalizadas. */
    public static function termos(?string $busca): array
    {
        if (!$busca) {
            return [];
        }

        $palavras = preg_split('/\s+/u', self::normalizar($busca), -1, PREG_SPLIT_NO_EMPTY);
        $palavras = array_values(array_unique(array_filter($palavras, fn ($p) => mb_strlen($p) >= 2)));

        return array_slice($palavras, 0, self::MAX_TERMOS);
    }

    /** Cada palavra precisa aparecer em algum dos campos do produto. */
    public static function aplicar(Builder $query, array $termos): void
    {
        foreach ($termos as $termo) {
            $padrao = "%{$termo}%";
            $query->where(function (Builder $q) use ($padrao) {
                $q->whereRaw(self::semAcento('produtos_entrega.nome') . ' LIKE ?', [$padrao])
                    ->orWhereRaw(self::semAcento('produtos_entrega.descricao') . ' LIKE ?', [$padrao])
                    ->orWhereRaw(self::semAcento('produtos_entrega.categoria') . ' LIKE ?', [$padrao])
                    ->orWhereHas('estabelecimento', fn ($e) => $e->whereRaw(self::semAcento('estabelecimentos.nome') . ' LIKE ?', [$padrao]))
                    ->orWhereHas('vendedor', fn ($v) => $v->whereRaw(self::semAcento('users.name') . ' LIKE ?', [$padrao]));
            });
        }
    }

    /**
     * Relevância: nome igual à busca > nome começa com a busca > palavra no nome > na categoria >
     * na descrição. Empate: promoção e mais vendidos primeiro.
     */
    public static function ordenarPorRelevancia(Builder $query, array $termos): void
    {
        if (!$termos) {
            return;
        }

        $nome = self::semAcento('produtos_entrega.nome');
        $frase = implode(' ', $termos);
        $partes = ["CASE WHEN {$nome} = ? THEN 100 ELSE 0 END", "CASE WHEN {$nome} LIKE ? THEN 50 ELSE 0 END"];
        $valores = [$frase, "{$frase}%"];

        foreach ($termos as $termo) {
            $partes[] = "CASE WHEN {$nome} LIKE ? THEN 20 ELSE 0 END";
            $partes[] = 'CASE WHEN ' . self::semAcento('produtos_entrega.categoria') . ' LIKE ? THEN 8 ELSE 0 END';
            $partes[] = 'CASE WHEN ' . self::semAcento('produtos_entrega.descricao') . ' LIKE ? THEN 4 ELSE 0 END';
            array_push($valores, "%{$termo}%", "%{$termo}%", "%{$termo}%");
        }

        $query->orderByRaw('(' . implode(' + ', $partes) . ') DESC', $valores)
            ->orderByDesc('tem_promocao')
            ->orderByDesc('total_vendidos');
    }
}
