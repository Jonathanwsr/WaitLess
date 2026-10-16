<?php

namespace Tests\Support;

use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

/** Respostas falsas das APIs da Wikimedia (Wikipédia, Wikivoyage e Wikidata) para os testes do Guia/Roteiro. */
trait FalsaWikimedia
{
    /** @param array<int, array{pageid:int,title:string,lat:float,lon:float,dist:float}> $pontos */
    protected function fingirWikimedia(array $pontos = [], string $modo = 'ok'): void
    {
        Http::fake(function (Request $r) use ($pontos, $modo) {
            $url = urldecode($r->url());
            if (!str_contains($url, 'wiki')) {
                return Http::response([], 404);
            }
            if ($modo === 'falha') {
                return Http::response('erro', 500);
            }
            $vazio = $modo === 'vazio';

            if (str_contains($url, 'wikidata.org/wiki/Special:EntityData/Q100.json')) {
                return Http::response(['entities' => ['Q100' => ['claims' => [
                    'P1082' => [
                        ['rank' => 'normal', 'mainsnak' => ['datavalue' => ['value' => ['amount' => '+1400000']]], 'qualifiers' => ['P585' => [['datavalue' => ['value' => ['time' => '+2010-01-01']]]]]],
                        ['rank' => 'normal', 'mainsnak' => ['datavalue' => ['value' => ['amount' => '+1488920']]], 'qualifiers' => ['P585' => [['datavalue' => ['value' => ['time' => '+2022-01-01']]]]]],
                    ],
                    'P2046' => [['rank' => 'normal', 'mainsnak' => ['datavalue' => ['value' => ['amount' => '+218.435']]]]],
                    'P2044' => [['rank' => 'normal', 'mainsnak' => ['datavalue' => ['value' => ['amount' => '+4']]]]],
                    'P131' => [['mainsnak' => ['datavalue' => ['value' => ['id' => 'Q200']]]]],
                ]]]]);
            }
            if (str_contains($url, 'wbgetentities')) {
                return Http::response(['entities' => ['Q200' => ['labels' => ['pt' => ['value' => 'Pernambuco']]]]]);
            }
            if (str_contains($url, 'pt.wikivoyage.org')) {
                if (str_contains($url, 'list=search')) {
                    return Http::response(['query' => ['search' => $vazio ? [] : [['title' => 'Recife']]]]);
                }

                return Http::response(['query' => ['pages' => ['5' => ['extract' => "Introdução.\n== Compreender ==\nRecife é a capital de Pernambuco, cortada por rios e pontes.\n== Chegar ==\n=== De avião ===\nO Aeroporto Internacional dos Guararapes fica a 11 km do centro.\n== Ver ==\nO Marco Zero e o Recife Antigo concentram museus e casarões coloridos.\n== Contatos ==\nTelefones úteis da cidade."]]]]);
            }
            if (str_contains($url, 'rest_v1/page/summary/')) {
                return Http::response([
                    'type' => 'standard', 'title' => 'Recife', 'description' => 'capital de Pernambuco',
                    'extract' => 'Recife é um município brasileiro, capital de Pernambuco.',
                    'originalimage' => ['source' => 'https://upload.wikimedia.org/recife.jpg'],
                    'coordinates' => ['lat' => -8.0631, 'lon' => -34.8711],
                    'wikibase_item' => 'Q100',
                    'content_urls' => ['desktop' => ['page' => 'https://pt.wikipedia.org/wiki/Recife']],
                ]);
            }
            if (str_contains($url, 'list=search')) {
                return Http::response(['query' => ['search' => $vazio ? [] : [['title' => 'Recife']]]]);
            }
            if (str_contains($url, 'list=geosearch')) {
                return Http::response(['query' => ['geosearch' => $vazio ? [] : $pontos]]);
            }
            if (str_contains($url, 'pageids=')) {
                return Http::response(['query' => ['pages' => collect($pontos)->mapWithKeys(fn ($p) => [$p['pageid'] => [
                    'pageid' => $p['pageid'], 'title' => $p['title'], 'description' => 'ponto turístico',
                    'extract' => $p['extract'] ?? ($p['title'] . ' é um lugar histórico.'),
                    'thumbnail' => ['source' => 'https://upload.wikimedia.org/' . $p['pageid'] . '.jpg'],
                ]])->all()]]);
            }
            if (str_contains($url, 'prop=extracts')) {
                return Http::response(['query' => ['pages' => ['1' => ['extract' => 'Recife é um município brasileiro, capital do estado de Pernambuco. Conhecida como a Veneza brasileira.']]]]);
            }

            return Http::response([], 404);
        });
    }

    protected function pontosRecife(): array
    {
        return [
            ['pageid' => 1, 'title' => 'Recife', 'lat' => -8.0631, 'lon' => -34.8711, 'dist' => 0],
            ['pageid' => 10, 'title' => 'Marco Zero', 'lat' => -8.0632, 'lon' => -34.8710, 'dist' => 12],
            ['pageid' => 11, 'title' => 'Paço do Frevo', 'lat' => -8.0620, 'lon' => -34.8716, 'dist' => 140],
            ['pageid' => 12, 'title' => 'Museu Cais do Sertão', 'lat' => -8.0640, 'lon' => -34.8700, 'dist' => 160],
            // Outro "bairro", ~8 km dali.
            ['pageid' => 20, 'title' => 'Instituto Ricardo Brennand', 'lat' => -8.0310, 'lon' => -34.9440, 'dist' => 8800],
            ['pageid' => 21, 'title' => 'Oficina Brennand', 'lat' => -8.0330, 'lon' => -34.9460, 'dist' => 8900],
            ['pageid' => 22, 'title' => 'Parque da Jaqueira', 'lat' => -8.0370, 'lon' => -34.9300, 'dist' => 7300],
        ];
    }
}
