<?php

namespace App\Support;

use Illuminate\Support\Str;

/**
 * Categorias de serviço, ramos de local, categorias de reserva e os grupos do Explorar (config/categorias.php).
 * O valor gravado em servicos.tipo_servico É o rótulo em si.
 */
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

    /** Ramos de atuação dos locais, agrupados: ['Hospedagem' => ['Hotel', ...], ...]. */
    public static function ramos(): array
    {
        return config('categorias.ramos', []);
    }

    /** Categorias de reserva agrupadas: ['Hospedagem' => ['casa' => 'Casa', ...], ...]. */
    public static function reservas(): array
    {
        return config('categorias.reservas', []);
    }

    /** Formato usado pelas telas de locação avulsa: ['Hospedagem' => ['casa', 'apartamento', ...], ...]. */
    public static function reservasPorGrupo(): array
    {
        return array_map('array_keys', self::reservas());
    }

    /** Todas as categorias de reserva aceitas pelo banco (inclui as de uso interno de produtos). */
    public static function valoresReserva(): array
    {
        return array_merge(array_merge(...array_values(array_map('array_keys', self::reservas()))), ['produto_extra', 'produto_avulso']);
    }

    /** ['casa' => 'Casa', ...] para mostrar nomes amigáveis nas telas. */
    public static function rotulosReserva(): array
    {
        return array_merge(...array_values(self::reservas()));
    }

    /** Regra de validação da categoria de reserva (só valores que o banco aceita). */
    public static function regraReserva(): array
    {
        return ['required', 'string', \Illuminate\Validation\Rule::in(self::valoresReserva())];
    }

    public static function rotuloReserva(?string $categoria): string
    {
        foreach (self::reservas() as $itens) {
            if (isset($itens[$categoria])) {
                return $itens[$categoria];
            }
        }

        return Str::of((string) $categoria)->replace('_', ' ')->ucfirst()->value();
    }

    /** Chips do Explorar (site e app). */
    public static function explorar(): array
    {
        return collect(config('categorias.explorar', []))
            ->map(fn ($g, $slug) => ['slug' => $slug, 'nome' => $g['nome'], 'icone' => $g['icone'], 'cor' => $g['cor']])
            ->values()
            ->all();
    }

    /** Chips do Explorar com quantos locais, serviços e reservas ativos existem em cada um (cache de 10 min). */
    public static function explorarComTotais(): array
    {
        return \Illuminate\Support\Facades\Cache::remember('categorias:explorar:totais', now()->addMinutes(10), function () {
            return collect(config('categorias.explorar', []))->map(function ($g, $slug) {
                $grupo = ['slug' => $slug] + $g;
                $locais = \App\Models\Estabelecimento::where('ativo', true)->tap(fn ($q) => self::filtrarLocais($q, $grupo))->count();
                $servicos = \App\Models\Servico::where('servicos.ativo', true)->tap(fn ($q) => self::filtrarServicos($q, $grupo))->count();
                $reservas = $g['reservas'] ? \App\Models\ItemAluguel::catalogo()->where('ativo', true)->whereIn('categoria', $g['reservas'])->count() : 0;

                return ['slug' => $slug, 'nome' => $g['nome'], 'icone' => $g['icone'], 'cor' => $g['cor'],
                    'locais' => $locais, 'servicos' => $servicos, 'reservas' => $reservas, 'total' => $locais + $servicos + $reservas];
            })->values()->all();
        });
    }

    /** Tudo de uma vez, para formulários e Explorar. */
    public static function catalogo(): array
    {
        return [
            'explorar' => self::explorar(),
            'servicos' => self::servicos(),
            'ramos' => self::ramos(),
            'reservas' => collect(self::reservas())->map(fn ($itens) => collect($itens)->map(fn ($r, $v) => ['valor' => $v, 'rotulo' => $r])->values()->all())->all(),
        ];
    }

    /**
     * Descobre o grupo do Explorar a partir de qualquer filtro já usado pelo site/app:
     * slug novo, filtros antigos (aliases), tipo de serviço, ramo do local ou categoria de reserva.
     *
     * @return array{slug:string, servicos:array, palavras:array, reservas:array}|null
     */
    public static function grupo(?string $filtro): ?array
    {
        $filtro = trim((string) $filtro);
        if ($filtro === '' || in_array(Str::lower($filtro), ['tudo', 'todas', 'todos'], true)) {
            return null;
        }
        $grupos = config('categorias.explorar', []);
        $chave = Str::of($filtro)->ascii()->lower()->value();

        foreach ($grupos as $slug => $g) {
            if ($chave === $slug || in_array($chave, $g['aliases'] ?? [], true)) {
                return ['slug' => $slug] + $g;
            }
        }
        foreach ($grupos as $slug => $g) {
            if (in_array($filtro, $g['servicos'], true) || in_array($filtro, $g['reservas'], true)) {
                return ['slug' => $slug] + $g;
            }
        }
        // Ramo do local: pelo grupo do formulário ou pelas palavras.
        foreach ($grupos as $slug => $g) {
            foreach ($g['palavras'] as $p) {
                if (str_contains(' ' . $chave . ' ', $p)) {
                    return ['slug' => $slug] + $g;
                }
            }
        }

        return null;
    }

    /** Coluna em minúsculas e sem acento (PostgreSQL), para comparar com as palavras do grupo. */
    public static function semAcento(string $coluna): string
    {
        return "translate(lower(coalesce({$coluna}, '')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')";
    }

    /** Locais do grupo: pelo ramo de atuação (palavras) ou por ter serviço do grupo. */
    public static function filtrarLocais($query, array $grupo, string $tabela = 'estabelecimentos'): void
    {
        $query->where(function ($q) use ($grupo, $tabela) {
            foreach ($grupo['palavras'] as $p) {
                $q->orWhereRaw("(' ' || " . self::semAcento("{$tabela}.ramo_atuacao") . " || ' ') like ?", ['%' . $p . '%']);
            }
            if ($grupo['servicos']) {
                $q->orWhereExists(fn ($s) => $s->selectRaw('1')->from('servicos')
                    ->whereColumn('servicos.estabelecimento_id', "{$tabela}.id")
                    ->where('servicos.ativo', true)
                    ->whereIn('servicos.tipo_servico', $grupo['servicos']));
            }
        });
    }

    /** Serviços do grupo: pelo tipo do serviço ou pelo ramo do local. */
    public static function filtrarServicos($query, array $grupo): void
    {
        $query->where(function ($q) use ($grupo) {
            if ($grupo['servicos']) {
                $q->whereIn('servicos.tipo_servico', $grupo['servicos']);
            }
            $q->orWhereHas('estabelecimento', function ($e) use ($grupo) {
                $e->where(function ($w) use ($grupo) {
                    foreach ($grupo['palavras'] as $p) {
                        $w->orWhereRaw("(' ' || " . self::semAcento('ramo_atuacao') . " || ' ') like ?", ['%' . $p . '%']);
                    }
                });
            });
        });
    }

    /** Reservas do grupo: pela categoria do item. */
    public static function filtrarReservas($query, array $grupo, string $coluna = 'categoria'): void
    {
        $query->whereIn($coluna, $grupo['reservas'] ?: ['__nenhuma__']);
    }
}
