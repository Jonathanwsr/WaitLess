<?php

namespace App\Services\Viagem;

use App\Models\Estabelecimento;
use App\Models\ItemAluguel;
use App\Models\Servico;
use App\Services\DestaquePremiumService;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Monta o roteiro de uma viagem só com o que existe no Lokyva no destino:
 * hospedagem (imóveis para alugar), veículo, e serviços/passeios distribuídos
 * pelos dias, respeitando o orçamento e calculando o deslocamento entre paradas.
 * Donos com plano premium entram com bônus de pontuação — são recomendados primeiro.
 */
class RoteiroInteligenteService
{
    public const HOSPEDAGEM = ['casa', 'apartamento', 'casa_praia', 'flat', 'chalé', 'cabana', 'kitnet', 'cobertura', 'sitio', 'chacara'];
    public const VEICULOS = ['carro', 'moto', 'van', 'motorhome', 'trailer'];
    public const PASSEIOS = ['barco', 'lancha', 'bicicleta', 'bicicleta_eletrica', 'patinete', 'patinete_eletrico'];

    private const HORARIOS_POR_RITMO = [
        'leve' => ['10:00', '15:00'],
        'moderado' => ['09:00', '14:00', '19:00'],
        'intenso' => ['08:30', '11:30', '15:00', '19:00'],
    ];

    private const VELOCIDADE_URBANA_KMH = 30;
    private const BONUS_PREMIUM = 25;
    private const FIM_DO_DIA = 22 * 60 + 30;

    public function __construct(private DestaquePremiumService $premium) {}

    /**
     * @param array{cidade:string, estado?:?string, data_inicio:string, data_fim:string, orcamento?:?float, pessoas:int, preferencias?:array} $p
     */
    public function gerar(array $p): array
    {
        $inicio = Carbon::parse($p['data_inicio'])->startOfDay();
        $fim = Carbon::parse($p['data_fim'])->startOfDay();
        $dias = (int) $inicio->diffInDays($fim) + 1;
        $noites = $dias - 1;
        $pessoas = max(1, (int) $p['pessoas']);
        $orcamento = isset($p['orcamento']) && $p['orcamento'] > 0 ? (float) $p['orcamento'] : null;
        $pref = $p['preferencias'] ?? [];
        $ritmo = array_key_exists($pref['ritmo'] ?? 'moderado', self::HORARIOS_POR_RITMO) ? ($pref['ritmo'] ?? 'moderado') : 'moderado';
        $interesses = collect($pref['interesses'] ?? [])->map(fn ($i) => Str::of($i)->ascii()->lower()->trim()->value())->filter()->values();

        $avisos = [];
        [$servicos, $imoveis, $veiculos, $passeios] = $this->candidatos($p['cidade'], $p['estado'] ?? null, $pessoas, $interesses);

        $itens = [];
        $gasto = 0.0;

        // ---- Hospedagem (até 45% do orçamento)
        $hospedagem = null;
        if ($noites >= 1 && ($pref['precisa_hospedagem'] ?? true)) {
            $hospedagem = $this->escolherPorDiaria($imoveis, $noites, $orcamento ? $orcamento * 0.45 : null, $avisos, 'hospedagem');
            if ($hospedagem) {
                $gasto += $hospedagem['custo'];
                $itens[] = $this->itemHospedagem($hospedagem, $inicio, $fim, $pessoas);
            } elseif ($imoveis->isEmpty()) {
                $avisos[] = 'Não encontramos hospedagem cadastrada no Lokyva para esse destino.';
            }
        }

        // ---- Veículo (até 15% do orçamento)
        if ($pref['precisa_veiculo'] ?? false) {
            $veiculo = $this->escolherPorDiaria($veiculos, $dias, $orcamento ? $orcamento * 0.15 : null, $avisos, 'veículo');
            if ($veiculo) {
                $gasto += $veiculo['custo'];
                $itens[] = $this->itemVeiculo($veiculo, $inicio, $fim);
            } elseif ($veiculos->isEmpty()) {
                $avisos[] = 'Não encontramos veículos para alugar nesse destino.';
            }
        }

        // ---- Atrações e serviços, dia a dia, sem repetir (10% do orçamento fica de reserva para alimentação e extras)
        $teto = $orcamento ? max($orcamento * 0.9 - $gasto, 0) : null;
        $pool = $servicos->concat($passeios)->sortByDesc('score')->values();
        if ($pool->isEmpty()) {
            $avisos[] = 'Não encontramos serviços ou passeios cadastrados no Lokyva para esse destino.';
        }

        $usados = [];
        $horarios = self::HORARIOS_POR_RITMO[$ritmo];
        $base = $hospedagem ? ['lat' => $hospedagem['lat'], 'lng' => $hospedagem['lng']] : ['lat' => null, 'lng' => null];
        $gastoAtividades = 0.0;

        for ($d = 0; $d < $dias; $d++) {
            $dia = $inicio->copy()->addDays($d);
            $pos = $base;
            $fimAnterior = null;
            $ordem = 1;

            foreach ($horarios as $horario) {
                $escolhido = $this->proximaParada($pool, $usados, $pos, $teto === null ? null : $teto - $gastoAtividades);
                if (!$escolhido) {
                    break;
                }

                $km = $this->distanciaKm($pos['lat'], $pos['lng'], $escolhido['lat'], $escolhido['lng']);
                $desloc = $km === null ? null : $this->minutosDeslocamento($km);

                $inicioMin = $this->minutos($horario);
                if ($fimAnterior !== null) {
                    $inicioMin = max($inicioMin, $fimAnterior + ($desloc ?? 15));
                }
                $fimMin = $inicioMin + $escolhido['duracao'];
                if ($fimMin > self::FIM_DO_DIA) {
                    break;
                }

                $usados[$escolhido['chave']] = true;
                $gastoAtividades += $escolhido['custo'];
                $itens[] = $this->itemAtividade($escolhido, $dia, $ordem++, $inicioMin, $fimMin, $km, $desloc);
                $fimAnterior = $fimMin;
                $pos = ['lat' => $escolhido['lat'], 'lng' => $escolhido['lng']];
            }
        }
        $gasto += $gastoAtividades;

        if ($pool->isNotEmpty() && collect($itens)->whereIn('tipo', ['servico', 'atracao'])->isEmpty()) {
            $avisos[] = 'O orçamento informado não cobre nenhum serviço disponível no destino. Aumente o valor ou reduza o número de pessoas.';
        }
        if ($orcamento && $gasto > $orcamento) {
            $avisos[] = 'O roteiro passou do orçamento em R$ ' . number_format($gasto - $orcamento, 2, ',', '.') . '. Troque a hospedagem ou o veículo para reduzir.';
        }

        return [
            'cidade' => $p['cidade'],
            'estado' => $p['estado'] ?? null,
            'dias' => $dias,
            'noites' => $noites,
            'itens' => $itens,
            'avisos' => $avisos,
            'resumo' => [
                'total_estimado' => round($gasto, 2),
                'orcamento' => $orcamento,
                'restante' => $orcamento ? round($orcamento - $gasto, 2) : null,
                'por_pessoa' => round($gasto / $pessoas, 2),
                'itens_premium' => collect($itens)->where('destaque_premium', true)->count(),
            ],
        ];
    }

    // ------------------------------------------------------------ candidatos

    /** @return array{0: Collection, 1: Collection, 2: Collection, 3: Collection} serviços, imóveis, veículos, passeios */
    private function candidatos(string $cidade, ?string $estado, int $pessoas, Collection $interesses): array
    {
        $alvo = $this->normalizar($cidade);

        $estabIds = Estabelecimento::query()->where('ativo', true)->get(['id', 'cidade', 'estado'])
            ->filter(fn ($e) => $this->mesmaCidade($alvo, $e->cidade, $estado, $e->estado))
            ->pluck('id');

        $premiumEstab = $this->premium->idsEstabelecimentosPremium();
        $premiumUsuarios = $this->premium->idsUsuariosPremium();

        $servicos = Servico::with('estabelecimento:id,nome,cidade,estado,latitude,longitude,ramo_atuacao,rua,numero,bairro')
            ->whereIn('estabelecimento_id', $estabIds)->where('ativo', true)->get()
            ->map(function (Servico $s) use ($premiumEstab, $interesses, $pessoas) {
                $e = $s->estabelecimento;
                $premium = $premiumEstab->contains($s->estabelecimento_id);

                return [
                    'chave' => 's' . $s->id,
                    'tipo' => 'servico',
                    'titulo' => $s->nome,
                    'descricao' => Str::limit((string) $s->descricao, 240),
                    'nome_local' => $e?->nome,
                    'endereco' => $e ? collect([$e->rua, $e->numero, $e->bairro])->filter()->implode(', ') : null,
                    'lat' => $e?->latitude ? (float) $e->latitude : null,
                    'lng' => $e?->longitude ? (float) $e->longitude : null,
                    'preco_unit' => $this->precoComDesconto((float) $s->valor, (bool) $s->tem_promocao, $s->tipo_desconto, $s->valor_desconto),
                    'por_pessoa' => true,
                    '_pessoas' => $pessoas,
                    'duracao' => max(30, (int) ($s->duracao_minutos ?: 90)),
                    'estabelecimento_id' => $s->estabelecimento_id,
                    'servico_id' => $s->id,
                    'item_aluguel_id' => null,
                    'premium' => $premium,
                    'score' => $this->pontuar($s->avaliacao_media, $s->total_avaliacoes, $premium, $interesses, [$s->nome, $s->descricao, $e?->ramo_atuacao]),
                ];
            })->filter(fn ($x) => $x['preco_unit'] >= 0)->values();

        $itens = ItemAluguel::catalogo()->where('ativo', true)
            ->where(fn ($q) => $q->whereNull('disponivel')->orWhere('disponivel', true))
            ->get()
            ->filter(fn ($i) => $this->mesmaCidade($alvo, $i->cidade, $estado, $i->estado));

        $mapear = function (ItemAluguel $i) use ($premiumUsuarios, $interesses, $pessoas) {
            $premium = $premiumUsuarios->contains($i->estabelecimento_id);
            $diaria = (float) ($i->valor_final ?: $i->valor_diaria ?: 0);
            $capacidadeOk = !$i->capacidade_pessoas || $i->capacidade_pessoas >= $pessoas;

            return [
                'chave' => 'i' . $i->id,
                'tipo' => 'aluguel',
                'categoria' => $i->categoria,
                'titulo' => $i->nome,
                'descricao' => Str::limit((string) $i->descricao, 240),
                'nome_local' => null,
                'endereco' => $i->enderecoCompleto,
                'lat' => $i->latitude ? (float) $i->latitude : null,
                'lng' => $i->longitude ? (float) $i->longitude : null,
                'preco_unit' => $this->precoComDesconto($diaria, (bool) $i->tem_promocao, $i->tipo_desconto, $i->valor_desconto),
                'por_pessoa' => false,
                'duracao' => 180,
                'capacidade' => $i->capacidade_pessoas,
                'estabelecimento_id' => null,
                'servico_id' => $i->servico_id,
                'item_aluguel_id' => $i->id,
                'premium' => $premium,
                // Quem cabe todo o grupo é preferido; quem não cabe perde pontos mas continua elegível.
                'score' => $this->pontuar($i->avaliacao_media, $i->total_avaliacoes, $premium, $interesses, [$i->nome, $i->descricao, $i->categoria]) - ($capacidadeOk ? 0 : 12),
            ];
        };

        $mapeados = $itens->map($mapear)->filter(fn ($x) => $x['preco_unit'] > 0);
        $por = fn (array $cats) => $mapeados->filter(fn ($x) => in_array($x['categoria'], $cats, true))->sortByDesc('score')->values();

        $passeios = $por(self::PASSEIOS)->map(fn ($x) => ['tipo' => 'atracao'] + $x)->values();

        return [$servicos, $por(self::HOSPEDAGEM), $por(self::VEICULOS), $passeios];
    }

    private function pontuar(mixed $media, mixed $total, bool $premium, Collection $interesses, array $textos): float
    {
        $nota = $media !== null && (float) $media > 0 ? (float) $media : 3.5;
        $score = $nota * 10 + log(1 + max((int) $total, 0)) * 2;

        if ($premium) {
            $score += self::BONUS_PREMIUM;
        }

        $texto = Str::of(implode(' ', array_filter($textos)))->ascii()->lower()->value();
        if ($interesses->contains(fn ($i) => $i !== '' && str_contains($texto, $i))) {
            $score += 8;
        }

        return round($score, 2);
    }

    // ------------------------------------------------------------ escolhas

    /** Melhor item por pontuação que cabe no teto; se nenhum cabe, o mais barato (com aviso). */
    private function escolherPorDiaria(Collection $candidatos, int $diarias, ?float $teto, array &$avisos, string $rotulo): ?array
    {
        if ($candidatos->isEmpty()) {
            return null;
        }

        $comCusto = $candidatos->map(fn ($c) => $c + ['custo' => round($c['preco_unit'] * $diarias, 2)]);
        $cabem = $teto === null ? $comCusto : $comCusto->filter(fn ($c) => $c['custo'] <= $teto);

        if ($cabem->isNotEmpty()) {
            return $cabem->sortByDesc('score')->first();
        }

        $maisBarato = $comCusto->sortBy('custo')->first();
        $avisos[] = "A opção de {$rotulo} mais barata (R$ " . number_format($maisBarato['custo'], 2, ',', '.') . ') passa da parte do orçamento reservada a ela.';

        return $maisBarato;
    }

    /** Próxima parada do dia: maximiza pontuação e penaliza distância; respeita o que ainda cabe no orçamento. */
    private function proximaParada(Collection $pool, array $usados, array $pos, ?float $orcamentoRestante): ?array
    {
        $melhor = null;
        $melhorNota = -INF;

        foreach ($pool as $c) {
            if (isset($usados[$c['chave']])) {
                continue;
            }

            $custo = $c['por_pessoa'] ? $c['preco_unit'] * ($c['_pessoas'] ?? 1) : $c['preco_unit'];
            $c['custo'] = $custo;
            if ($orcamentoRestante !== null && $custo > $orcamentoRestante) {
                continue;
            }

            $km = $this->distanciaKm($pos['lat'], $pos['lng'], $c['lat'], $c['lng']);
            $nota = $c['score'] - ($km === null ? 0 : min($km, 60) * 0.8);

            if ($nota > $melhorNota) {
                $melhorNota = $nota;
                $melhor = $c;
            }
        }

        return $melhor;
    }

    // ------------------------------------------------------------ montagem dos itens

    private function itemHospedagem(array $h, Carbon $inicio, Carbon $fim, int $pessoas): array
    {
        $aviso = !empty($h['capacidade']) && $h['capacidade'] < $pessoas
            ? " Atenção: comporta {$h['capacidade']} pessoas e o grupo tem {$pessoas}."
            : '';

        return array_replace($this->base($h, 'hospedagem', $h['titulo']), [
            'dia' => $inicio->toDateString(), 'data_fim' => $fim->toDateString(),
            'ordem' => 0, 'hora_inicio' => '14:00:00', 'hora_fim' => '12:00:00',
            'descricao' => trim("Check-in às 14h, check-out às 12h.{$aviso} " . $h['descricao']),
            'custo_estimado' => $h['custo'],
        ]);
    }

    private function itemVeiculo(array $v, Carbon $inicio, Carbon $fim): array
    {
        return array_replace($this->base($v, 'transporte', $v['titulo']), [
            'dia' => $inicio->toDateString(), 'data_fim' => $fim->toDateString(),
            'ordem' => 0, 'hora_inicio' => '09:00:00', 'hora_fim' => null,
            'custo_estimado' => $v['custo'],
        ]);
    }

    private function itemAtividade(array $a, Carbon $dia, int $ordem, int $inicioMin, int $fimMin, ?float $km, ?int $desloc): array
    {
        return array_replace($this->base($a, $a['tipo'] === 'servico' ? 'servico' : 'atracao', $a['titulo']), [
            'dia' => $dia->toDateString(), 'data_fim' => null,
            'ordem' => $ordem,
            'hora_inicio' => $this->hora($inicioMin), 'hora_fim' => $this->hora($fimMin),
            'custo_estimado' => round($a['custo'], 2),
            'deslocamento_min' => $desloc, 'distancia_km' => $km === null ? null : round($km, 1),
        ]);
    }

    private function base(array $c, string $tipo, string $titulo): array
    {
        return [
            'tipo' => $tipo,
            'titulo' => $titulo,
            'descricao' => trim(($c['nome_local'] ? $c['nome_local'] . '. ' : '') . $c['descricao']),
            'endereco' => $c['endereco'],
            'latitude' => $c['lat'], 'longitude' => $c['lng'],
            'estabelecimento_id' => $c['estabelecimento_id'],
            'servico_id' => $c['servico_id'],
            'item_aluguel_id' => $c['item_aluguel_id'],
            'destaque_premium' => (bool) $c['premium'],
            'score' => $c['score'],
            'deslocamento_min' => null, 'distancia_km' => null,
            'status' => 'sugerido', 'origem' => 'auto',
        ];
    }

    // ------------------------------------------------------------ utilidades

    private function precoComDesconto(float $valor, bool $promo, ?string $tipo, mixed $desconto): float
    {
        if (!$promo || !$desconto) {
            return $valor;
        }

        $novo = $tipo === 'fixo' ? $valor - (float) $desconto : $valor * (1 - ((float) $desconto / 100));

        return round(max($novo, 0), 2);
    }

    private function normalizar(?string $texto): string
    {
        return Str::of((string) $texto)->ascii()->lower()->replaceMatches('/[^a-z0-9 ]/', '')->squish()->value();
    }

    /** "Maceió, AL" e "Maceio" são a mesma cidade; estado só desempata quando ambos informam. */
    private function mesmaCidade(string $alvoNormalizado, ?string $cidade, ?string $estadoAlvo, ?string $estado): bool
    {
        $c = $this->normalizar($cidade);
        if ($c === '' || $alvoNormalizado === '') {
            return false;
        }
        if (!($c === $alvoNormalizado || str_contains($alvoNormalizado, $c) || str_contains($c, $alvoNormalizado))) {
            return false;
        }

        return !$estadoAlvo || !$estado || Str::upper($estadoAlvo) === Str::upper($estado);
    }

    public function distanciaKm(?float $lat1, ?float $lng1, ?float $lat2, ?float $lng2): ?float
    {
        if ($lat1 === null || $lng1 === null || $lat2 === null || $lng2 === null) {
            return null;
        }

        $r = 6371;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;

        return $r * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }

    private function minutosDeslocamento(float $km): int
    {
        // Rota urbana costuma ser ~30% mais longa que a linha reta.
        return (int) max(5, round(($km * 1.3 / self::VELOCIDADE_URBANA_KMH) * 60 + 5));
    }

    private function minutos(string $hhmm): int
    {
        [$h, $m] = array_map('intval', explode(':', $hhmm));

        return $h * 60 + $m;
    }

    private function hora(int $min): string
    {
        return sprintf('%02d:%02d:00', intdiv($min, 60), $min % 60);
    }
}
