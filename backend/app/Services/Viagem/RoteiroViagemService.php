<?php

namespace App\Services\Viagem;

use App\Models\ItemAluguel;
use App\Models\Roteiro;
use App\Models\RoteiroItem;
use App\Models\Servico;
use App\Models\User;
use App\Services\GeocodificacaoService;
use App\Services\PrecificacaoService;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Roteiro de Viagem dia a dia: mistura pontos turísticos do Guia do Local com locações do Lokyva.
 *
 * Geração: escolhe os pontos (pelos interesses), agrupa os mais próximos no mesmo dia (vizinho mais
 * próximo + divisão em dias), organiza Manhã/Tarde/Noite, sugere restaurante no almoço e no jantar e
 * hospedagem/veículo quando faz sentido. Locações seguem o ranking do Explorar (LocacoesProximasService).
 */
class RoteiroViagemService
{
    public const MAX_DIAS = 30;
    public const INTERESSES = ['praia', 'natureza', 'gastronomia', 'cultura', 'aventura', 'compras', 'vida_noturna', 'pet'];
    public const PERIODOS = ['manha' => 'Manhã', 'tarde' => 'Tarde', 'noite' => 'Noite'];
    public const AVISO_HORARIO = 'Confira o horário de funcionamento';

    /** Palavras que aproximam um ponto turístico de cada interesse. */
    private const PALAVRAS = [
        'praia' => ['praia', 'orla', 'litoral', 'ilha', 'baia', 'enseada', 'mar '],
        'natureza' => ['parque', 'reserva', 'cachoeira', 'serra', 'trilha', 'jardim', 'lagoa', 'rio ', 'mata', 'pico', 'mirante', 'ecologic'],
        'gastronomia' => ['mercado', 'feira', 'gastron', 'culinaria'],
        'cultura' => ['museu', 'igreja', 'teatro', 'histor', 'cultural', 'monumento', 'catedral', 'palacio', 'forte', 'biblioteca', 'basilica', 'convento', 'memorial', 'capela', 'patrimonio'],
        'aventura' => ['trilha', 'cachoeira', 'serra', 'pico', 'dunas', 'mergulho', 'rapel'],
        'compras' => ['shopping', 'mercado', 'feira', 'artesanato', 'comercial'],
        'vida_noturna' => ['bar', 'boate', 'casa de show', 'polo', 'orla'],
        'pet' => ['parque', 'praca', 'praia', 'orla'],
    ];

    private const VELOCIDADE_KMH = 30;
    private const VELOCIDADE_A_PE_KMH = 4.5;
    private const LIMITE_A_PE_KM = 1.5;

    public function __construct(
        private GuiaLocalService $guia,
        private LocacoesProximasService $proximas,
        private GeocodificacaoService $geo,
        private PrecificacaoService $precos,
    ) {}

    // ------------------------------------------------------------------ geração

    /**
     * @param array{destino?:?string, latitude?:?float, longitude?:?float, data_inicio:string, data_fim?:?string, dias?:?int,
     *              pessoas?:int, orcamento?:?float, interesses?:array, partida?:string, partida_latitude?:?float,
     *              partida_longitude?:?float, precisa_hospedagem?:bool, precisa_veiculo?:bool, raio_km?:?float} $p
     */
    public function gerar(array $p): array
    {
        $inicio = Carbon::parse($p['data_inicio'])->startOfDay();
        $fim = !empty($p['data_fim']) ? Carbon::parse($p['data_fim'])->startOfDay() : $inicio->copy()->addDays(max(1, (int) ($p['dias'] ?? 1)) - 1);
        $dias = (int) $inicio->diffInDays($fim) + 1;
        if ($fim->lt($inicio) || $dias > self::MAX_DIAS) {
            throw ValidationException::withMessages(['data_fim' => 'Escolha um período de 1 a ' . self::MAX_DIAS . ' dias.']);
        }
        $noites = $dias - 1;
        $pessoas = max(1, min(50, (int) ($p['pessoas'] ?? 1)));
        $orcamento = !empty($p['orcamento']) && (float) $p['orcamento'] > 0 ? (float) $p['orcamento'] : null;
        $interesses = collect($p['interesses'] ?? [])->filter(fn ($i) => in_array($i, self::INTERESSES, true))->values()->all();
        $raio = (float) ($p['raio_km'] ?? LocacoesProximasService::RAIO_PADRAO_KM);
        $avisos = [];

        // 1) Destino: Guia do Local (Wikipédia) e, se ela falhar, o geocodificador.
        [$local, $centro, $nomeDestino] = $this->resolverDestino($p);

        // 2) Pontos turísticos perto do destino, priorizando os interesses.
        $pontos = collect($this->guia->pontosProximos($centro['lat'], $centro['lng'], (int) min(10000, $raio * 1000), 30))
            ->reject(fn ($pt) => $local && Str::lower($pt['titulo']) === Str::lower($local['titulo']))
            ->map(fn ($pt) => $pt + ['pontuacao' => $this->pontuar($pt, $interesses)])
            ->sort(fn ($a, $b) => [$b['pontuacao'], $a['distancia_km']] <=> [$a['pontuacao'], $b['distancia_km']])
            ->take($dias * 3)
            ->values();
        if ($pontos->isEmpty()) {
            $avisos[] = 'Não conseguimos carregar os pontos turísticos agora. O roteiro foi montado com as locações do Lokyva; tente gerar de novo mais tarde.';
        }

        // 3) Locações do Lokyva por perto, já no ranking do Explorar.
        $locs = $this->proximas->lista($centro['lat'], $centro['lng'], $raio);
        $usados = [];

        $hospedagem = null;
        if ($noites >= 1 && ($p['precisa_hospedagem'] ?? true)) {
            $hospedagem = $locs->first(fn ($l) => $l['categoria'] === 'hospedagem' && $l['tipo'] === 'item_aluguel' && (!$l['capacidade'] || $l['capacidade'] >= $pessoas))
                ?? $locs->first(fn ($l) => $l['categoria'] === 'hospedagem');
            if (!$hospedagem) {
                $avisos[] = 'Não encontramos hospedagem do Lokyva perto desse destino.';
            } else {
                $usados[$hospedagem['chave']] = true;
            }
        }
        $veiculo = null;
        if ($p['precisa_veiculo'] ?? false) {
            $veiculo = $locs->first(fn ($l) => $l['categoria'] === 'veiculos');
            if (!$veiculo) {
                $avisos[] = 'Não encontramos veículos para alugar perto desse destino.';
            } else {
                $usados[$veiculo['chave']] = true;
            }
        }

        // 4) Ponto de partida de cada dia.
        $partida = in_array($p['partida'] ?? 'centro', ['centro', 'hospedagem', 'localizacao'], true) ? ($p['partida'] ?? 'centro') : 'centro';
        $base = $centro;
        if ($partida === 'localizacao' && isset($p['partida_latitude'], $p['partida_longitude'])) {
            $base = ['lat' => (float) $p['partida_latitude'], 'lng' => (float) $p['partida_longitude']];
        } elseif ($partida === 'hospedagem' && $hospedagem) {
            $base = ['lat' => $hospedagem['lat'], 'lng' => $hospedagem['lng']];
        } elseif ($partida !== 'centro') {
            $partida = 'centro';
        }

        // 5) Pontos mais próximos entre si no mesmo dia: rota do vizinho mais próximo, depois dividida em dias.
        $ordenados = $this->vizinhoMaisProximo($pontos->all(), $base);
        $porDia = $ordenados ? array_chunk($ordenados, (int) ceil(count($ordenados) / $dias)) : [];

        $restaurantes = $locs->where('categoria', 'restaurantes')->values();
        $atividades = $locs->filter(fn ($l) => in_array($l['categoria'], ['passeios', 'bem_estar'], true))
            ->sortBy(fn ($l) => ($l['categoria'] === 'passeios' && array_intersect($interesses, ['aventura', 'natureza', 'praia']) ? 0 : 1) * 10 + $l['nivel'])
            ->values();
        if ($restaurantes->isEmpty()) {
            $avisos[] = 'Ainda não há restaurantes do Lokyva perto desse destino; deixamos o almoço e o jantar livres.';
        }

        $saidaDias = [];
        for ($d = 0; $d < $dias; $d++) {
            $data = $inicio->copy()->addDays($d);
            $pts = $porDia[$d] ?? [];
            $itens = [];
            $pos = $base;

            if ($d === 0 && $veiculo) {
                $itens[] = $this->itemLocacao($veiculo, 'manha', '08:30', $this->custoLocacao($veiculo, $pessoas, $dias, $noites), 'Retirada do veículo · ' . $veiculo['titulo']);
            }
            foreach (array_slice($pts, 0, 2) as $i => $pt) {
                $itens[] = $this->itemPonto($pt, 'manha', $i === 0 ? '09:00' : '10:45');
                $pos = $pt['coordenadas'];
            }

            if ($almoco = $this->maisProximo($restaurantes, $pos, $usados)) {
                $usados[$almoco['chave']] = true;
                $itens[] = $this->itemLocacao($almoco, 'tarde', '12:30', $this->custoLocacao($almoco, $pessoas, $dias, $noites), 'Almoço · ' . $almoco['titulo']);
                $pos = ['lat' => $almoco['lat'], 'lng' => $almoco['lng']];
            }
            foreach (array_slice($pts, 2) as $pt) {
                $itens[] = $this->itemPonto($pt, 'tarde', '14:30');
                $pos = $pt['coordenadas'];
            }
            if ($atividade = $this->maisProximo($atividades, $pos, $usados)) {
                $usados[$atividade['chave']] = true;
                $itens[] = $this->itemLocacao($atividade, 'tarde', '16:15', $this->custoLocacao($atividade, $pessoas, $dias, $noites));
                $pos = ['lat' => $atividade['lat'], 'lng' => $atividade['lng']];
            }

            if ($d === 0 && $hospedagem) {
                $itens[] = $this->itemLocacao($hospedagem, 'noite', '18:00', $this->custoLocacao($hospedagem, $pessoas, $dias, $noites), 'Check-in · ' . $hospedagem['titulo']);
            }
            if ($jantar = $this->maisProximo($restaurantes, $pos, $usados)) {
                $usados[$jantar['chave']] = true;
                $itens[] = $this->itemLocacao($jantar, 'noite', '19:30', $this->custoLocacao($jantar, $pessoas, $dias, $noites), 'Jantar · ' . $jantar['titulo']);
            }

            $saidaDias[] = ['numero' => $d + 1, 'data' => $data->toDateString(), 'itens' => $itens];
        }

        $roteiro = [
            'id' => null,
            'titulo' => trim((string) ($p['titulo'] ?? '')) ?: ($dias === 1 ? "Um dia em {$nomeDestino}" : "{$dias} dias em {$nomeDestino}"),
            'destino' => $nomeDestino,
            'estado' => $local['dados']['estado'] ?? null,
            'latitude' => $centro['lat'],
            'longitude' => $centro['lng'],
            'data_inicio' => $inicio->toDateString(),
            'data_fim' => $fim->toDateString(),
            'pessoas' => $pessoas,
            'orcamento' => $orcamento,
            'interesses' => $interesses,
            'partida' => $partida,
            'partida_latitude' => $partida === 'localizacao' ? $base['lat'] : null,
            'partida_longitude' => $partida === 'localizacao' ? $base['lng'] : null,
        ];

        $tela = $this->montar($roteiro, $saidaDias);
        $tela['avisos'] = array_values(array_unique(array_merge($avisos, $tela['avisos'])));
        $tela['guia'] = $local ? ['titulo' => $local['titulo'], 'resumo' => $local['resumo'], 'imagem' => $local['imagem'], 'fonte' => $local['fonte'], 'link' => $local['link']] : null;
        $tela['sugestoes_flash'] = $locs->filter(fn ($l) => $l['flash_deal'] && !isset($usados[$l['chave']]))->take(6)->values()->all();

        return $tela;
    }

    /** @return array{0: ?array, 1: array{lat: float, lng: float}, 2: string} */
    private function resolverDestino(array $p): array
    {
        $termo = trim((string) ($p['destino'] ?? ''));
        $temCoord = isset($p['latitude'], $p['longitude']) && is_numeric($p['latitude']) && is_numeric($p['longitude']);
        $local = null;
        $centro = null;

        if ($termo !== '') {
            $local = $this->guia->porTermo($termo);
            $centro = $local['coordenadas'] ?? null;
            if (!$centro && ($ponto = $this->geo->coordenadas($termo))) {
                $centro = ['lat' => $ponto[0], 'lng' => $ponto[1]];
            }
        } elseif ($temCoord) {
            $centro = ['lat' => (float) $p['latitude'], 'lng' => (float) $p['longitude']];
            $local = $this->guia->porCoordenadas($centro['lat'], $centro['lng']);
        }

        if (!$centro) {
            throw ValidationException::withMessages(['destino' => 'Não encontramos esse destino. Confira o nome da cidade ou do ponto turístico e tente de novo.']);
        }

        return [$local, $centro, $local['titulo'] ?? ($termo !== '' ? Str::title($termo) : 'Perto de você')];
    }

    private function pontuar(array $ponto, array $interesses): int
    {
        $texto = ' ' . Str::of(implode(' ', [$ponto['titulo'], $ponto['descricao'] ?? '', $ponto['resumo'] ?? '']))->ascii()->lower()->value() . ' ';
        $pontos = $ponto['imagem'] ? 1 : 0;
        // Bairros, estádios e afins entram no roteiro só se faltar opção melhor.
        if (preg_match('/\b(bairro|estadio|arena|distrito)\b/', $texto)) {
            $pontos -= 2;
        }
        foreach ($interesses as $i) {
            foreach (self::PALAVRAS[$i] ?? [] as $palavra) {
                if (str_contains($texto, $palavra)) {
                    $pontos += 3;
                    break;
                }
            }
        }

        return $pontos;
    }

    /** Ordem de visita do vizinho mais próximo a partir da base (reduz o deslocamento). */
    public function vizinhoMaisProximo(array $pontos, array $base): array
    {
        $restantes = array_values($pontos);
        $ordem = [];
        $pos = $base;
        while ($restantes) {
            $melhor = 0;
            $menor = INF;
            foreach ($restantes as $i => $pt) {
                $km = $this->distanciaKm($pos['lat'], $pos['lng'], $pt['coordenadas']['lat'], $pt['coordenadas']['lng']) ?? INF;
                if ($km < $menor) {
                    $menor = $km;
                    $melhor = $i;
                }
            }
            $pos = $restantes[$melhor]['coordenadas'];
            $ordem[] = $restantes[$melhor];
            array_splice($restantes, $melhor, 1);
        }

        return $ordem;
    }

    private function maisProximo(Collection $lista, array $pos, array $usados): ?array
    {
        // Mantém o ranking (premium primeiro) mas evita mandar o viajante longe: até 3 km tudo é "perto".
        return $lista->reject(fn ($l) => isset($usados[$l['chave']]))
            ->sortBy(fn ($l) => [min(3, (int) floor($this->distanciaKm($pos['lat'], $pos['lng'], $l['lat'], $l['lng']) ?? 99)), $l['nivel'], $this->distanciaKm($pos['lat'], $pos['lng'], $l['lat'], $l['lng'])])
            ->first();
    }

    private function itemPonto(array $pt, string $periodo, string $hora): array
    {
        return [
            'tipo' => 'ponto_turistico',
            'periodo' => $periodo,
            'hora' => $hora,
            'titulo' => $pt['titulo'],
            'descricao' => $pt['resumo'] ?? $pt['descricao'] ?? null,
            'categoria' => 'ponto_turistico',
            'latitude' => $pt['coordenadas']['lat'],
            'longitude' => $pt['coordenadas']['lng'],
            'link' => $pt['link'],
            'imagem' => $pt['imagem'],
            'servico_id' => null,
            'item_aluguel_id' => null,
            'custo_estimado' => 0,
            'anotacao' => null,
        ];
    }

    private function itemLocacao(array $l, string $periodo, string $hora, float $custo, ?string $titulo = null): array
    {
        return [
            'tipo' => 'locacao',
            'periodo' => $periodo,
            'hora' => $hora,
            'titulo' => $titulo ?? $l['titulo'],
            'descricao' => $l['descricao'],
            'categoria' => $l['categoria'],
            'latitude' => $l['lat'],
            'longitude' => $l['lng'],
            'link' => null,
            'imagem' => null,
            'servico_id' => $l['tipo'] === 'servico' ? $l['id'] : null,
            'item_aluguel_id' => $l['tipo'] === 'item_aluguel' ? $l['id'] : null,
            'custo_estimado' => round($custo, 2),
            'anotacao' => null,
        ];
    }

    /** Custo estimado no roteiro: serviço por pessoa; hospedagem por noite; veículo por dia; demais, uma diária. */
    public function custoLocacao(array $l, int $pessoas, int $dias, int $noites): float
    {
        $unit = (float) $l['valor_com_promocao'];
        if ($l['tipo'] === 'servico') {
            return $unit * $pessoas;
        }
        $unidades = !empty($l['capacidade']) ? (int) ceil($pessoas / max(1, $l['capacidade'])) : 1;

        return match ($l['categoria']) {
            'hospedagem' => $unit * max(1, $noites) * $unidades,
            'veiculos' => $unit * $dias * $unidades,
            default => $unit * $unidades,
        };
    }

    // ------------------------------------------------------------- tela (gerado ou salvo)

    /**
     * Junta o roteiro e os dias numa estrutura única para web/app/PDF: itens por período, numeração para o mapa,
     * distância/tempo até o próximo item, custo por dia, total e aviso de orçamento.
     */
    public function montar(array $roteiro, array $dias): array
    {
        $base = $roteiro['partida_latitude'] !== null && $roteiro['partida_longitude'] !== null
            ? ['lat' => (float) $roteiro['partida_latitude'], 'lng' => (float) $roteiro['partida_longitude']]
            : ['lat' => (float) $roteiro['latitude'], 'lng' => (float) $roteiro['longitude']];
        $totalDias = max(1, count($dias));
        $noites = max(1, $totalDias - 1);
        $infos = $this->infoLocacoes(collect($dias)->pluck('itens')->flatten(1));
        $hospedagem = collect($dias)->pluck('itens')->flatten(1)->first(fn ($i) => $i['tipo'] === 'locacao' && ($i['categoria'] ?? null) === 'hospedagem');
        if (($roteiro['partida'] ?? 'centro') === 'hospedagem' && $hospedagem && $hospedagem['latitude']) {
            $base = ['lat' => (float) $hospedagem['latitude'], 'lng' => (float) $hospedagem['longitude']];
        }

        // Hospedagem e veículo valem para a viagem toda: o custo é dividido pelas noites / pelos dias.
        $todosItens = collect($dias)->pluck('itens')->flatten(1);
        $ehFixo = fn ($i) => ($i['tipo'] ?? null) === 'locacao' && in_array($i['categoria'] ?? null, ['hospedagem', 'veiculos'], true);
        $porNoite = $todosItens->filter(fn ($i) => $ehFixo($i) && $i['categoria'] === 'hospedagem')->sum('custo_estimado') / $noites;
        $porDiaVeiculo = $todosItens->filter(fn ($i) => $ehFixo($i) && $i['categoria'] === 'veiculos')->sum('custo_estimado') / $totalDias;

        $avisos = [];
        $total = 0.0;
        $saida = [];
        foreach (array_values($dias) as $indiceDia => $dia) {
            $itens = collect($dia['itens'])
                ->sortBy(fn ($i) => [array_search($i['periodo'], array_keys(self::PERIODOS), true), $i['ordem'] ?? 0, $i['hora'] ?? '99:99'])
                ->values();
            $pos = $base;
            $numero = 0;
            $custoDia = 0.0;
            $periodos = array_fill_keys(array_keys(self::PERIODOS), []);

            foreach ($itens as $i) {
                $info = $this->infoDoItem($i, $infos);
                $km = null;
                $min = null;
                if ($i['latitude'] !== null && $i['longitude'] !== null) {
                    $numero++;
                    $km = $this->distanciaKm($pos['lat'], $pos['lng'], (float) $i['latitude'], (float) $i['longitude']);
                    $pos = ['lat' => (float) $i['latitude'], 'lng' => (float) $i['longitude']];
                }
                if ($km !== null) {
                    $min = $this->minutos($km);
                }
                if ($info && !$info['disponivel']) {
                    $avisos[] = "\"{$i['titulo']}\" não está mais disponível no Lokyva. Troque por outra opção.";
                }

                $custo = (float) ($i['custo_estimado'] ?? 0);
                $total += $custo;
                if (!$ehFixo($i)) {
                    $custoDia += $custo;
                }

                $periodos[$i['periodo']][] = array_merge($i, [
                    'numero' => $i['latitude'] !== null ? $numero : null,
                    'distancia_km' => $km !== null ? round($km, 1) : null,
                    'minutos' => $min,
                    'modo' => $km === null ? null : ($km <= self::LIMITE_A_PE_KM ? 'a_pe' : 'carro'),
                    'aviso_horario' => $i['tipo'] === 'ponto_turistico' ? self::AVISO_HORARIO : null,
                    'locacao' => $info,
                ]);
            }

            $custoDia += ($indiceDia < $noites ? $porNoite : 0) + $porDiaVeiculo;

            $saida[] = [
                'id' => $dia['id'] ?? null,
                'numero' => (int) $dia['numero'],
                'data' => $dia['data'],
                'periodos' => $periodos,
                'custo' => round($custoDia, 2),
            ];
        }

        // Sobra de arredondamento vai para o último dia, para a soma dos dias bater com o total.
        $somaDias = array_sum(array_column($saida, 'custo'));
        if ($saida && abs($somaDias - $total) >= 0.01) {
            $ultimo = count($saida) - 1;
            $saida[$ultimo]['custo'] = max(0.0, round($saida[$ultimo]['custo'] + ($total - $somaDias), 2));
        }

        $orcamento = $roteiro['orcamento'] ?? null;
        $passou = $orcamento && $total > $orcamento;
        if ($passou) {
            $avisos[] = 'O roteiro passou do orçamento em R$ ' . number_format($total - $orcamento, 2, ',', '.') . '. Remova ou troque alguma locação para economizar.';
        }

        return [
            'roteiro' => $roteiro,
            'dias' => $saida,
            'resumo' => [
                'total' => round($total, 2),
                'por_pessoa' => round($total / max(1, (int) ($roteiro['pessoas'] ?? 1)), 2),
                'orcamento' => $orcamento,
                'passou_orcamento' => (bool) $passou,
                'diferenca' => $orcamento ? round($orcamento - $total, 2) : null,
                'locacoes' => collect($saida)->pluck('periodos')->flatten(2)->where('tipo', 'locacao')->count(),
            ],
            'avisos' => array_values(array_unique($avisos)),
        ];
    }

    /** Dados vivos das locações do roteiro (foto, selo, Flash Deal, se continua ativa). */
    private function infoLocacoes(Collection $itens): array
    {
        $servicos = Servico::with('estabelecimento:id,nome,foto_perfil,ativo')
            ->whereIn('id', $itens->pluck('servico_id')->filter()->unique()->all())->get()->keyBy('id');
        $alugueis = ItemAluguel::whereIn('id', $itens->pluck('item_aluguel_id')->filter()->unique()->all())->get()->keyBy('id');

        return ['servicos' => $servicos, 'itens' => $alugueis];
    }

    private function infoDoItem(array $i, array $infos): ?array
    {
        if ($i['tipo'] !== 'locacao') {
            return null;
        }
        if (!empty($i['servico_id'])) {
            $s = $infos['servicos'][$i['servico_id']] ?? null;

            return [
                'tipo' => 'servico',
                'id' => (int) $i['servico_id'],
                'local_id' => $s?->estabelecimento_id,
                'nome' => $s?->nome,
                'local' => $s?->estabelecimento?->nome,
                'foto' => $s ? (collect(is_array($s->fotos) ? $s->fotos : (json_decode((string) $s->fotos, true) ?: []))->first(fn ($f) => is_string($f)) ?: $s->estabelecimento?->foto_perfil) : null,
                'disponivel' => (bool) ($s && $s->ativo && $s->estabelecimento?->ativo),
                'horario_a_combinar' => $s ? $s->horarioACombinar() : false,
            ];
        }
        if (!empty($i['item_aluguel_id'])) {
            $a = $infos['itens'][$i['item_aluguel_id']] ?? null;

            return [
                'tipo' => 'item_aluguel',
                'id' => (int) $i['item_aluguel_id'],
                'local_id' => $a?->local_id,
                'nome' => $a?->nome,
                'local' => null,
                'foto' => $a?->foto_principal,
                'disponivel' => (bool) ($a && $a->ativo && $a->disponivel !== false),
                'horario_a_combinar' => false,
            ];
        }

        return null;
    }

    /** Estrutura de tela de um roteiro salvo. */
    public function paraTela(Roteiro $r, bool $doDono = true): array
    {
        $r->loadMissing('dias.itens');
        $dados = [
            'id' => $r->id,
            'titulo' => $r->titulo,
            'destino' => $r->destino,
            'estado' => $r->estado,
            'latitude' => $r->latitude,
            'longitude' => $r->longitude,
            'data_inicio' => $r->data_inicio->toDateString(),
            'data_fim' => $r->data_fim->toDateString(),
            'pessoas' => (int) $r->pessoas,
            'orcamento' => $r->orcamento,
            'interesses' => $r->interesses ?? [],
            'partida' => $r->partida,
            'partida_latitude' => $doDono ? $r->partida_latitude : null,
            'partida_longitude' => $doDono ? $r->partida_longitude : null,
        ];
        $dias = $r->dias->map(fn ($d) => [
            'id' => $d->id,
            'numero' => $d->numero,
            'data' => $d->data->toDateString(),
            'itens' => $d->itens->map(fn (RoteiroItem $i) => [
                'id' => $i->id, 'tipo' => $i->tipo, 'periodo' => $i->periodo, 'ordem' => $i->ordem, 'hora' => $i->hora,
                'titulo' => $i->titulo, 'descricao' => $i->descricao, 'categoria' => $i->categoria,
                'latitude' => $i->latitude, 'longitude' => $i->longitude, 'link' => $i->link, 'imagem' => $i->imagem,
                'servico_id' => $i->servico_id, 'item_aluguel_id' => $i->item_aluguel_id,
                'custo_estimado' => (float) $i->custo_estimado, 'anotacao' => $i->anotacao,
            ])->all(),
        ])->all();

        $tela = $this->montar($dados, $dias);
        if ($doDono) {
            $tela['roteiro']['compartilhado'] = (bool) $r->token_compartilhamento;
            $tela['roteiro']['link_compartilhamento'] = $r->token_compartilhamento ? url('/roteiro/' . $r->token_compartilhamento) : null;
            $tela['pedidos'] = $r->pedidos()->take(5)->get(['id', 'codigo', 'status', 'total', 'reservas', 'nao_reservados', 'created_at'])->all();
        }

        return $tela;
    }

    // ------------------------------------------------------------------ salvar

    /** Cria ou substitui (edição/reordenação) o roteiro inteiro do dono. */
    public function salvar(User $user, array $dados, ?Roteiro $roteiro = null): Roteiro
    {
        $inicio = Carbon::parse($dados['data_inicio'])->startOfDay();
        $fim = Carbon::parse($dados['data_fim'])->startOfDay();
        $totalDias = (int) $inicio->diffInDays($fim) + 1;
        if ($totalDias < 1 || $totalDias > self::MAX_DIAS) {
            throw ValidationException::withMessages(['data_fim' => 'Escolha um período de 1 a ' . self::MAX_DIAS . ' dias.']);
        }
        $pessoas = max(1, (int) ($dados['pessoas'] ?? 1));
        $noites = max(1, $totalDias - 1);

        // Locações: o custo é recalculado aqui (o valor enviado pela tela não é confiável).
        $todos = collect($dados['dias'] ?? [])->pluck('itens')->flatten(1);
        $servicos = Servico::whereIn('id', $todos->pluck('servico_id')->filter()->unique()->all())->get()->keyBy('id');
        $alugueis = ItemAluguel::whereIn('id', $todos->pluck('item_aluguel_id')->filter()->unique()->all())->get()->keyBy('id');

        return DB::transaction(function () use ($user, $dados, $roteiro, $inicio, $fim, $totalDias, $pessoas, $noites, $servicos, $alugueis) {
            $atributos = [
                'titulo' => Str::limit(trim((string) ($dados['titulo'] ?? '')) ?: 'Roteiro em ' . $dados['destino'], 200, ''),
                'destino' => $dados['destino'],
                'estado' => $dados['estado'] ?? null,
                'latitude' => $dados['latitude'] ?? null,
                'longitude' => $dados['longitude'] ?? null,
                'data_inicio' => $inicio->toDateString(),
                'data_fim' => $fim->toDateString(),
                'pessoas' => $pessoas,
                'orcamento' => $dados['orcamento'] ?? null,
                'interesses' => array_values(array_intersect($dados['interesses'] ?? [], self::INTERESSES)),
                'partida' => $dados['partida'] ?? 'centro',
                // A localização do usuário não é guardada: o ponto de partida "minha localização" vale só na geração.
                'partida_latitude' => null,
                'partida_longitude' => null,
            ];
            if ($roteiro) {
                $roteiro->update($atributos);
                $roteiro->itens()->delete();
                $roteiro->dias()->delete();
            } else {
                $roteiro = Roteiro::create($atributos + ['user_id' => $user->id]);
            }

            $diasEnviados = array_values($dados['dias'] ?? []);
            for ($n = 0; $n < $totalDias; $n++) {
                $dia = $roteiro->dias()->create(['numero' => $n + 1, 'data' => $inicio->copy()->addDays($n)->toDateString()]);
                $ordemPorPeriodo = [];
                foreach (array_values($diasEnviados[$n]['itens'] ?? []) as $item) {
                    $periodo = in_array($item['periodo'] ?? null, RoteiroItem::PERIODOS, true) ? $item['periodo'] : 'manha';
                    $ordemPorPeriodo[$periodo] = ($ordemPorPeriodo[$periodo] ?? 0) + 1;
                    $linha = $this->linhaDoItem($item, $servicos, $alugueis, $pessoas, $totalDias, $noites);
                    if (!$linha) {
                        continue;
                    }
                    $dia->itens()->create($linha + [
                        'roteiro_id' => $roteiro->id,
                        'periodo' => $periodo,
                        'ordem' => $ordemPorPeriodo[$periodo],
                    ]);
                }
            }

            return $roteiro->fresh();
        });
    }

    private function linhaDoItem(array $item, Collection $servicos, Collection $alugueis, int $pessoas, int $dias, int $noites): ?array
    {
        $tipo = $item['tipo'] ?? null;
        $base = [
            'tipo' => $tipo,
            'titulo' => Str::limit(trim((string) ($item['titulo'] ?? '')), 250, ''),
            'descricao' => isset($item['descricao']) ? Str::limit(strip_tags((string) $item['descricao']), 2000, '') : null,
            'hora' => isset($item['hora']) && preg_match('/^\d{2}:\d{2}$/', (string) $item['hora']) ? $item['hora'] : null,
            'anotacao' => isset($item['anotacao']) ? Str::limit(strip_tags((string) $item['anotacao']), 2000, '') : null,
            'latitude' => isset($item['latitude']) && is_numeric($item['latitude']) ? (float) $item['latitude'] : null,
            'longitude' => isset($item['longitude']) && is_numeric($item['longitude']) ? (float) $item['longitude'] : null,
            'link' => null, 'imagem' => null, 'servico_id' => null, 'item_aluguel_id' => null, 'categoria' => null, 'custo_estimado' => 0,
        ];

        if ($tipo === 'ponto_turistico') {
            return array_merge($base, [
                'categoria' => 'ponto_turistico',
                'link' => self::urlWikimedia($item['link'] ?? null),
                'imagem' => self::urlWikimedia($item['imagem'] ?? null),
            ]);
        }

        if ($tipo === 'anotacao') {
            return array_merge($base, [
                'titulo' => $base['titulo'] ?: 'Anotação',
                'categoria' => 'anotacao',
                'custo_estimado' => max(0, min(1000000, (float) ($item['custo_estimado'] ?? 0))),
            ]);
        }

        if ($tipo !== 'locacao') {
            return null;
        }
        if (!empty($item['servico_id']) && ($s = $servicos->get((int) $item['servico_id']))) {
            $valor = $this->precos->comPromocao((float) $s->valor, (bool) $s->tem_promocao, $s->tipo_desconto, $s->valor_desconto);
            $local = $s->estabelecimento()->first(['id', 'nome', 'ramo_atuacao', 'latitude', 'longitude']);

            return array_merge($base, [
                'servico_id' => $s->id,
                'titulo' => $base['titulo'] ?: $s->nome,
                'categoria' => LocacoesProximasService::categoriaDoServico($local?->ramo_atuacao, $s->tipo_servico, $s->nome),
                'latitude' => $local?->latitude ? (float) $local->latitude : $base['latitude'],
                'longitude' => $local?->longitude ? (float) $local->longitude : $base['longitude'],
                'custo_estimado' => round($valor * $pessoas, 2),
            ]);
        }
        if (!empty($item['item_aluguel_id']) && ($a = $alugueis->get((int) $item['item_aluguel_id']))) {
            $valor = $this->precos->comPromocao((float) $a->valor_diaria, (bool) $a->tem_promocao, $a->tipo_desconto, $a->valor_desconto);
            $categoria = LocacoesProximasService::categoriaDoItem($a->categoria);
            $capacidade = (int) ($a->capacidade_pessoas ?: $a->lugares ?: 0);

            return array_merge($base, [
                'item_aluguel_id' => $a->id,
                'titulo' => $base['titulo'] ?: $a->nome,
                'categoria' => $categoria,
                'latitude' => $a->latitude ? (float) $a->latitude : $base['latitude'],
                'longitude' => $a->longitude ? (float) $a->longitude : $base['longitude'],
                'custo_estimado' => round($this->custoLocacao(['tipo' => 'item_aluguel', 'valor_com_promocao' => $valor, 'capacidade' => $capacidade ?: null, 'categoria' => $categoria], $pessoas, $dias, $noites), 2),
            ]);
        }

        return null; // locação que não existe mais
    }

    /** Só aceita links/imagens da Wikimedia em pontos turísticos (o link compartilhado não pode virar vitrine de outro site). */
    public static function urlWikimedia(?string $url): ?string
    {
        $url = trim((string) $url);

        return preg_match('~^https://([a-z0-9-]+\.)*(wikipedia|wikivoyage|wikimedia|wikidata)\.org/~i', $url) ? Str::limit($url, 500, '') : null;
    }

    public function duplicar(Roteiro $r): Roteiro
    {
        return DB::transaction(function () use ($r) {
            $r->loadMissing('dias.itens');
            $novo = $r->replicate(['token_compartilhamento']);
            $novo->titulo = Str::limit($r->titulo . ' (cópia)', 200, '');
            $novo->save();
            foreach ($r->dias as $dia) {
                $novoDia = $novo->dias()->create(['numero' => $dia->numero, 'data' => $dia->data->toDateString()]);
                foreach ($dia->itens as $item) {
                    $novoDia->itens()->create(collect($item->getAttributes())->except(['id', 'roteiro_id', 'roteiro_dia_id', 'created_at', 'updated_at'])->all() + ['roteiro_id' => $novo->id]);
                }
            }

            return $novo;
        });
    }

    /** Roteiro em andamento hoje e o próximo item da agenda. */
    public function hoje(User $user): ?array
    {
        $hoje = now()->toDateString();
        $r = Roteiro::where('user_id', $user->id)->whereDate('data_inicio', '<=', $hoje)->whereDate('data_fim', '>=', $hoje)->orderBy('data_inicio')->first();
        if (!$r) {
            return null;
        }
        $tela = $this->paraTela($r);
        $dia = collect($tela['dias'])->firstWhere('data', $hoje);
        $itens = collect($dia['periodos'] ?? [])->flatten(1)->values();
        $agora = now()->format('H:i');
        $proximo = $itens->first(fn ($i) => ($i['hora'] ?? '00:00') >= $agora) ?? null;

        return ['roteiro' => $tela['roteiro'], 'dia' => $dia, 'proximo' => $proximo, 'resumo' => $tela['resumo']];
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

    /** Tempo estimado: a pé até 1,5 km; acima disso, carro em rota urbana (~30% mais longa que a linha reta). */
    public function minutos(float $km): int
    {
        if ($km <= self::LIMITE_A_PE_KM) {
            return (int) max(1, round($km / self::VELOCIDADE_A_PE_KMH * 60));
        }

        return (int) max(5, round(($km * 1.3 / self::VELOCIDADE_KMH) * 60 + 5));
    }
}
