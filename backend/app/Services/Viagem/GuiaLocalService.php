<?php

namespace App\Services\Viagem;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Guia do Local: descrição, dados e dicas de viagem de uma cidade/ponto turístico, a partir das APIs públicas
 * da Wikimedia (Wikipédia, Wikivoyage e Wikidata em português). Sempre chamado pelo backend, com cache de 24h,
 * timeout curto e o User-Agent pedido pela política da Wikimedia. Conteúdo CC BY-SA: devolve sempre fonte e link.
 *
 * Se a Wikimedia falhar, os métodos devolvem null/[] — a tela segue funcionando só com as locações próximas.
 */
class GuiaLocalService
{
    private const WIKIPEDIA = 'https://pt.wikipedia.org/w/api.php';
    private const WIKIPEDIA_REST = 'https://pt.wikipedia.org/api/rest_v1/page/summary/';
    private const WIKIVOYAGE = 'https://pt.wikivoyage.org/w/api.php';
    private const WIKIDATA = 'https://www.wikidata.org/wiki/Special:EntityData/';
    private const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
    private const CACHE_HORAS = 24;

    /** Seções do Wikivoyage que viram "informações úteis", com o nome mostrado ao viajante. */
    public const SECOES = [
        'Compreender' => 'Sobre o destino',
        'Chegar' => 'Como chegar',
        'Circular' => 'Como circular',
        'Ver' => 'O que ver',
        'Fazer' => 'O que fazer',
        'Comer' => 'Onde comer',
        'Beber' => 'Onde beber',
        'Dormir' => 'Onde dormir',
        'Segurança' => 'Segurança',
    ];

    /** Guia de um destino buscado por nome ou termo. */
    public function porTermo(string $termo): ?array
    {
        $titulo = $this->buscarTitulo(trim($termo));

        return $titulo ? $this->local($titulo) : null;
    }

    /** Página da Wikipédia mais próxima de uma coordenada (para "Perto de mim" sem saber o nome da cidade). */
    public function porCoordenadas(float $lat, float $lng): ?array
    {
        $proximo = $this->pontosProximos($lat, $lng, 10000, 1)[0] ?? null;

        return $proximo ? $this->local($proximo['titulo']) : null;
    }

    /** Descrição, imagem, coordenadas, dados da cidade e dicas de viagem de uma página. */
    public function local(string $titulo): ?array
    {
        $resumo = $this->resumo($titulo);
        if (!$resumo) {
            return null;
        }

        $tituloFinal = $resumo['titulo'];

        return [
            'titulo' => $tituloFinal,
            'subtitulo' => $resumo['subtitulo'],
            'descricao' => $this->introducao($tituloFinal) ?: $resumo['resumo'],
            'resumo' => $resumo['resumo'],
            'imagem' => $resumo['imagem'],
            'coordenadas' => $resumo['coordenadas'],
            'dados' => $resumo['wikidata'] ? $this->dadosWikidata($resumo['wikidata']) : [],
            'infos_uteis' => $this->infosUteis($tituloFinal),
            'fonte' => 'Wikipédia / Wikivoyage (CC BY-SA 4.0)',
            'link' => $resumo['link'],
        ];
    }

    /** a) Busca por nome ou termo: título da página mais relevante. */
    public function buscarTitulo(string $termo): ?string
    {
        if (mb_strlen($termo) < 2) {
            return null;
        }

        return $this->lembrar('busca:' . md5(mb_strtolower($termo)), function () use ($termo) {
            $json = $this->get(self::WIKIPEDIA, ['action' => 'query', 'list' => 'search', 'srsearch' => $termo, 'srlimit' => 1, 'format' => 'json']);

            return $json['query']['search'][0]['title'] ?? null;
        });
    }

    /** b) Páginas num raio (até 10 km) de uma coordenada, mais perto primeiro, com foto e descrição curta. */
    public function pontosProximos(float $lat, float $lng, int $raioMetros = 10000, int $limite = 20): array
    {
        $raioMetros = max(100, min(10000, $raioMetros));
        $chave = 'geo:' . round($lat, 2) . ',' . round($lng, 2) . ':' . $raioMetros . ':' . $limite;

        return $this->lembrar($chave, function () use ($lat, $lng, $raioMetros, $limite) {
            // Pede mais do que precisa: parte das páginas próximas não é turística (emissoras, empresas, escolas…).
            $json = $this->get(self::WIKIPEDIA, [
                'action' => 'query', 'list' => 'geosearch', 'gscoord' => "{$lat}|{$lng}",
                'gsradius' => $raioMetros, 'gslimit' => min(50, $limite * 2), 'format' => 'json',
            ]);
            $lista = $json['query']['geosearch'] ?? null;
            if (!is_array($lista)) {
                return null;
            }

            $detalhes = $this->detalhesEmLote(array_column($lista, 'pageid'));

            return collect($lista)->map(function ($p) use ($detalhes) {
                $d = $detalhes[$p['pageid']] ?? [];

                return [
                    'titulo' => $p['title'],
                    'descricao' => $d['descricao'] ?? null,
                    'resumo' => $d['resumo'] ?? null,
                    'imagem' => $d['imagem'] ?? null,
                    'coordenadas' => ['lat' => (float) $p['lat'], 'lng' => (float) $p['lon']],
                    'distancia_km' => round(((float) ($p['dist'] ?? 0)) / 1000, 1),
                    'link' => 'https://pt.wikipedia.org/wiki/' . rawurlencode(str_replace(' ', '_', $p['title'])),
                    'aviso_horario' => 'Confira o horário de funcionamento',
                ];
            })->filter(fn ($p) => self::ehPontoTuristico($p['titulo'], $p['descricao']))->take($limite)->values()->all();
        }) ?? [];
    }

    /** c) Resumo com imagem e coordenadas (REST). */
    public function resumo(string $titulo): ?array
    {
        return $this->lembrar('resumo:' . md5($titulo), function () use ($titulo) {
            $json = $this->get(self::WIKIPEDIA_REST . rawurlencode(str_replace(' ', '_', $titulo)));
            if (!$json || empty($json['title']) || ($json['type'] ?? '') === 'disambiguation') {
                return null;
            }

            return [
                'titulo' => $json['title'],
                'subtitulo' => $json['description'] ?? null,
                'resumo' => $json['extract'] ?? null,
                'imagem' => $json['originalimage']['source'] ?? $json['thumbnail']['source'] ?? null,
                'coordenadas' => isset($json['coordinates']['lat']) ? ['lat' => (float) $json['coordinates']['lat'], 'lng' => (float) $json['coordinates']['lon']] : null,
                'wikidata' => $json['wikibase_item'] ?? null,
                'link' => $json['content_urls']['desktop']['page'] ?? ('https://pt.wikipedia.org/wiki/' . rawurlencode(str_replace(' ', '_', $titulo))),
            ];
        });
    }

    /** d) Introdução completa em texto puro. */
    public function introducao(string $titulo): ?string
    {
        return $this->lembrar('intro:' . md5($titulo), function () use ($titulo) {
            $json = $this->get(self::WIKIPEDIA, ['action' => 'query', 'prop' => 'extracts', 'exintro' => 1, 'explaintext' => 1, 'titles' => $titulo, 'format' => 'json']);
            $pagina = collect($json['query']['pages'] ?? [])->first();
            $texto = trim((string) ($pagina['extract'] ?? ''));

            return $texto !== '' ? $this->limitar($texto, 1800) : null;
        });
    }

    /** e) Dicas de viagem do Wikivoyage, por seção, em texto curto e limpo. */
    public function infosUteis(string $titulo): array
    {
        return $this->lembrar('voyage:' . md5($titulo), function () use ($titulo) {
            $busca = $this->get(self::WIKIVOYAGE, ['action' => 'query', 'list' => 'search', 'srsearch' => $titulo, 'srlimit' => 1, 'format' => 'json']);
            $tituloVoyage = $busca['query']['search'][0]['title'] ?? null;
            if (!$tituloVoyage) {
                return $busca === null ? null : [];
            }

            $json = $this->get(self::WIKIVOYAGE, ['action' => 'query', 'prop' => 'extracts', 'explaintext' => 1, 'titles' => $tituloVoyage, 'format' => 'json']);
            $texto = (string) (collect($json['query']['pages'] ?? [])->first()['extract'] ?? '');

            return self::secoesDoTexto($texto, 'https://pt.wikivoyage.org/wiki/' . rawurlencode(str_replace(' ', '_', $tituloVoyage)));
        }) ?? [];
    }

    /** f) População, área, altitude e estado (Wikidata). */
    public function dadosWikidata(string $qid): array
    {
        if (!preg_match('/^Q\d+$/', $qid)) {
            return [];
        }

        return $this->lembrar('wikidata:' . $qid, function () use ($qid) {
            $json = $this->get(self::WIKIDATA . $qid . '.json');
            $claims = $json['entities'][$qid]['claims'] ?? null;
            if (!is_array($claims)) {
                return null;
            }

            $quantidade = function (string $prop) use ($claims): ?float {
                $valores = collect($claims[$prop] ?? [])->filter(fn ($c) => isset($c['mainsnak']['datavalue']['value']['amount']));
                // População: a mais recente (qualificador P585 "data"); demais: a preferida ou a primeira.
                $escolhido = $valores->sortByDesc(fn ($c) => $c['qualifiers']['P585'][0]['datavalue']['value']['time'] ?? '')
                    ->sortByDesc(fn ($c) => ($c['rank'] ?? '') === 'preferred')->first();

                return $escolhido ? (float) ltrim($escolhido['mainsnak']['datavalue']['value']['amount'], '+') : null;
            };

            $dados = array_filter([
                'populacao' => ($p = $quantidade('P1082')) ? (int) $p : null,
                'area_km2' => ($a = $quantidade('P2046')) ? round($a, 1) : null,
                'altitude_m' => ($h = $quantidade('P2044')) ? (int) round($h) : null,
            ], fn ($v) => $v !== null);

            $estadoId = $claims['P131'][0]['mainsnak']['datavalue']['value']['id'] ?? null;
            if ($estadoId) {
                $rotulo = $this->get(self::WIKIDATA_API, ['action' => 'wbgetentities', 'ids' => $estadoId, 'props' => 'labels', 'languages' => 'pt|pt-br', 'format' => 'json']);
                $labels = $rotulo['entities'][$estadoId]['labels'] ?? [];
                $nome = $labels['pt']['value'] ?? $labels['pt-br']['value'] ?? null;
                if ($nome) {
                    $dados['estado'] = $nome;
                }
            }

            return $dados;
        }) ?? [];
    }

    /** Páginas que ficam perto mas não interessam ao viajante (emissoras, empresas, escolas, órgãos públicos…). */
    private const NAO_TURISTICO = [
        'emissora', 'televis', 'radio', 'rádio', 'jornal', 'empresa', 'escola', 'colégio', 'colegio', 'universidade', 'faculdade',
        'hospital', 'clínica', 'rodovia', 'avenida', 'estação de metr', 'subestação', 'sindicato', 'partido', 'clube de futebol',
        'futebol clube', 'banco brasileiro', 'tribunal', 'secretaria', 'autarquia', 'conjunto habitacional', 'loteamento',
    ];

    public static function ehPontoTuristico(string $titulo, ?string $descricao): bool
    {
        $texto = mb_strtolower($titulo . ' ' . ($descricao ?? ''));
        if (preg_match('/^(tv|rádio|radio|rede|cbn)\b/u', mb_strtolower($titulo))) {
            return false;
        }
        foreach (self::NAO_TURISTICO as $palavra) {
            if (str_contains($texto, $palavra)) {
                return false;
            }
        }

        return true;
    }

    /** Separa o texto puro do Wikivoyage nas seções úteis e resume cada uma. */
    public static function secoesDoTexto(string $texto, string $link): array
    {
        if (trim($texto) === '') {
            return [];
        }

        // Títulos de nível 2 ("== Ver ==") delimitam as seções; subtítulos ("=== Praias ===") ficam no texto.
        $partes = preg_split('/^==\s*([^=\n]+?)\s*==\s*$/mu', $texto, -1, PREG_SPLIT_DELIM_CAPTURE);
        $saida = [];
        for ($i = 1; $i < count($partes) - 1; $i += 2) {
            $nome = trim($partes[$i]);
            if (!isset(self::SECOES[$nome])) {
                continue;
            }
            $corpo = preg_replace('/^=+\s*([^=\n]+?)\s*=+\s*$/mu', '$1:', $partes[$i + 1]);
            $corpo = preg_replace("/[ \t]+/", ' ', $corpo);
            $corpo = trim(preg_replace("/\n{2,}/", "\n", $corpo));
            if (mb_strlen($corpo) < 25) {
                continue;
            }
            $saida[] = ['secao' => self::SECOES[$nome], 'original' => $nome, 'texto' => self::resumir($corpo, 650), 'link' => $link];
        }

        return $saida;
    }

    /** Corta num fim de frase perto do limite. */
    public static function resumir(string $texto, int $limite): string
    {
        if (mb_strlen($texto) <= $limite) {
            return $texto;
        }
        $corte = mb_substr($texto, 0, $limite);
        $ponto = max(mb_strrpos($corte, '. ') ?: 0, mb_strrpos($corte, ".\n") ?: 0);

        return ($ponto > $limite * 0.5 ? mb_substr($corte, 0, $ponto + 1) : rtrim($corte) . '…');
    }

    private function limitar(string $texto, int $limite): string
    {
        return self::resumir($texto, $limite);
    }

    /** Fotos e descrições curtas de várias páginas numa só chamada. */
    private function detalhesEmLote(array $pageIds): array
    {
        if (!$pageIds) {
            return [];
        }
        $json = $this->get(self::WIKIPEDIA, [
            'action' => 'query', 'pageids' => implode('|', array_slice($pageIds, 0, 20)), 'prop' => 'pageimages|description|extracts',
            'piprop' => 'thumbnail', 'pithumbsize' => 480, 'exintro' => 1, 'explaintext' => 1, 'exsentences' => 2, 'exlimit' => 20, 'format' => 'json',
        ]);

        return collect($json['query']['pages'] ?? [])->mapWithKeys(fn ($p) => [(int) ($p['pageid'] ?? 0) => [
            'descricao' => $p['description'] ?? null,
            'resumo' => isset($p['extract']) ? Str::limit(trim($p['extract']), 280) : null,
            'imagem' => $p['thumbnail']['source'] ?? null,
        ]])->all();
    }

    private function cliente(): PendingRequest
    {
        return Http::timeout((int) config('services.wikimedia.timeout', 5))
            ->connectTimeout(3)
            ->acceptJson()
            ->withHeaders(['User-Agent' => config('services.wikimedia.user_agent')]);
    }

    /** GET que nunca lança erro: null quando a Wikimedia falha ou responde algo inesperado. */
    private function get(string $url, array $query = []): ?array
    {
        try {
            $resposta = $this->cliente()->get($url, $query);
            if (!$resposta->successful()) {
                return null;
            }
            $json = $resposta->json();

            return is_array($json) ? $json : null;
        } catch (\Throwable $e) {
            Log::info('Guia do Local: Wikimedia indisponível (' . $e->getMessage() . ')');

            return null;
        }
    }

    /** Cache de 24h só para respostas válidas (uma falha não fica "presa" no cache). */
    private function lembrar(string $chave, \Closure $buscar): mixed
    {
        $chave = 'guia-local:' . $chave;
        if (Cache::has($chave)) {
            return Cache::get($chave);
        }
        $valor = $buscar();
        if ($valor !== null) {
            Cache::put($chave, $valor, now()->addHours(self::CACHE_HORAS));
        }

        return $valor;
    }
}
