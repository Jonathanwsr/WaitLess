<?php

namespace App\Services\Viagem;

use App\Models\FlashDeal;
use App\Models\ItemAluguel;
use App\Models\Servico;
use App\Services\DestaquePremiumService;
use App\Services\PrecificacaoService;
use App\Services\Servico\DetalheServicoService;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Locações do Lokyva perto de uma coordenada (Haversine no banco), na mesma ordem do Explorar:
 * premium > aceita pontos > aceita pagamento online > demais (DestaquePremiumService::nivelDeDestaque)
 * e, dentro de cada grupo, a mais perto primeiro. Agrupa por categoria de viagem.
 */
class LocacoesProximasService
{
    public const RAIO_PADRAO_KM = 10;

    public const CATEGORIAS = [
        'hospedagem' => 'Hospedagem',
        'restaurantes' => 'Restaurantes e bares',
        'passeios' => 'Passeios e experiências',
        'veiculos' => 'Veículos',
        'bem_estar' => 'Spa, beleza e bem-estar',
        'servicos' => 'Outros serviços',
        'espacos' => 'Espaços e equipamentos',
    ];

    private const RAMOS = [
        // A ordem importa: "barbearia" contém "bar", então bem-estar é testado antes de restaurantes.
        'bem_estar' => ['spa', 'massag', 'estetic', 'bem-estar', 'bem estar', 'beleza', 'salao', 'barbearia', 'sauna', 'terma'],
        'hospedagem' => ['hotel', 'pousada', 'hospedagem', 'hostel', 'resort'],
        'passeios' => ['turismo', 'passeio', 'aventura', 'tour', 'mergulho', 'lazer', 'trilha', 'ecoturismo'],
        'restaurantes' => ['restaurante', 'gastronom', 'bar ', ' bar', 'boteco', 'lanchonete', 'pizzaria', 'cafe', 'cafeteria', 'comida', 'aliment', 'churrascaria', 'sorveteria', 'padaria', 'hamburgueria', 'bistro'],
    ];

    public function __construct(
        private DestaquePremiumService $destaque,
        private PrecificacaoService $precos,
        private DetalheServicoService $detalhe,
    ) {}

    /** Agrupadas por categoria: { hospedagem: [...], restaurantes: [...], ... } (só as categorias com itens). */
    public function agrupadas(float $lat, float $lng, float $raioKm = self::RAIO_PADRAO_KM, int $porCategoria = 10): array
    {
        return $this->lista($lat, $lng, $raioKm)
            ->groupBy('categoria')
            ->sortBy(fn ($v, $k) => array_search($k, array_keys(self::CATEGORIAS), true))
            ->map(fn (Collection $itens, $cat) => ['rotulo' => self::CATEGORIAS[$cat] ?? $cat, 'itens' => $itens->take($porCategoria)->values()->all()])
            ->all();
    }

    /** Lista única já ordenada pelo ranking + distância. */
    public function lista(float $lat, float $lng, float $raioKm = self::RAIO_PADRAO_KM): Collection
    {
        $raioKm = max(1, min(50, $raioKm));
        $flash = $this->flashDealsAtivos();

        $servicos = $this->servicosProximos($lat, $lng, $raioKm)->map(fn ($s) => $this->normalizarServico($s, $flash));
        $itens = $this->itensProximos($lat, $lng, $raioKm)->map(fn ($i) => $this->normalizarItem($i, $flash));

        return $servicos->concat($itens)
            ->sort(fn ($a, $b) => [$a['nivel'], $a['distancia_km']] <=> [$b['nivel'], $b['distancia_km']])
            ->values();
    }

    /** Expressão de Haversine (km) protegida contra arredondamento fora do domínio do acos. */
    public static function haversine(string $latCol, string $lngCol): string
    {
        return "(6371 * acos(LEAST(1, GREATEST(-1, cos(radians(?)) * cos(radians({$latCol})) * cos(radians({$lngCol}) - radians(?)) + sin(radians(?)) * sin(radians({$latCol}))))))";
    }

    private function servicosProximos(float $lat, float $lng, float $raio): Collection
    {
        $dist = self::haversine('estabelecimentos.latitude', 'estabelecimentos.longitude');

        return Servico::query()
            ->join('estabelecimentos', 'estabelecimentos.id', '=', 'servicos.estabelecimento_id')
            ->where('servicos.ativo', true)->where('estabelecimentos.ativo', true)
            ->whereNotNull('estabelecimentos.latitude')->whereNotNull('estabelecimentos.longitude')
            ->whereRaw("{$dist} <= ?", [$lat, $lng, $lat, $raio])
            ->select('servicos.*', 'estabelecimentos.nome as local_nome', 'estabelecimentos.ramo_atuacao', 'estabelecimentos.cidade as local_cidade',
                'estabelecimentos.latitude as local_lat', 'estabelecimentos.longitude as local_lng', 'estabelecimentos.foto_perfil as local_foto')
            ->selectRaw("{$dist} as distancia_km", [$lat, $lng, $lat])
            ->orderByRaw("{$dist}", [$lat, $lng, $lat])
            ->limit(200)
            ->get();
    }

    private function itensProximos(float $lat, float $lng, float $raio): Collection
    {
        // Reserva sem coordenada própria usa a do local a que pertence.
        $latCol = 'COALESCE(itens_aluguel.latitude, locais.latitude)';
        $lngCol = 'COALESCE(itens_aluguel.longitude, locais.longitude)';
        $dist = self::haversine($latCol, $lngCol);

        return ItemAluguel::query()->catalogo()
            ->leftJoin('estabelecimentos as locais', 'locais.id', '=', 'itens_aluguel.local_id')
            ->where('itens_aluguel.ativo', true)
            ->where(fn ($q) => $q->whereNull('itens_aluguel.disponivel')->orWhere('itens_aluguel.disponivel', true))
            ->whereRaw("{$latCol} IS NOT NULL AND {$lngCol} IS NOT NULL")
            ->whereRaw("{$dist} <= ?", [$lat, $lng, $lat, $raio])
            ->select('itens_aluguel.*', 'locais.nome as local_nome')
            ->selectRaw("{$latCol} as ponto_lat, {$lngCol} as ponto_lng")
            ->selectRaw("{$dist} as distancia_km", [$lat, $lng, $lat])
            ->orderByRaw("{$dist}", [$lat, $lng, $lat])
            ->limit(200)
            ->get();
    }

    private function normalizarServico(Servico $s, array $flash): array
    {
        $valor = (float) $s->valor;
        $comPromo = $this->precos->comPromocao($valor, (bool) $s->tem_promocao, $s->tipo_desconto, $s->valor_desconto);
        $foto = collect($this->detalhe->json($s->fotos))->first(fn ($f) => is_string($f)) ?: $s->local_foto;

        return $this->comDestaque([
            'chave' => 'servico:' . $s->id,
            'tipo' => 'servico',
            'id' => (int) $s->id,
            'titulo' => $s->nome,
            'local' => ['id' => (int) $s->estabelecimento_id, 'nome' => $s->local_nome],
            'categoria' => self::categoriaDoServico($s->ramo_atuacao, $s->tipo_servico, $s->nome),
            'descricao' => $s->descricao ? Str::limit(strip_tags($s->descricao), 160) : null,
            'foto' => $foto,
            'valor' => round($valor, 2),
            'valor_com_promocao' => round($comPromo, 2),
            'tem_promocao' => $comPromo < $valor,
            'unidade' => 'por pessoa',
            'avaliacao' => $s->avaliacao_media ? round((float) $s->avaliacao_media, 1) : null,
            'lat' => (float) $s->local_lat,
            'lng' => (float) $s->local_lng,
            'distancia_km' => round((float) $s->distancia_km, 2),
            'cidade' => $s->local_cidade,
            'duracao_minutos' => (int) ($s->duracao_minutos ?: 60),
            'aceita_pontos' => (bool) $s->aceita_pontos,
            'flash_deal' => $flash['servico:' . $s->id] ?? null,
        ], (int) $s->estabelecimento_id, 'estabelecimento');
    }

    private function normalizarItem(ItemAluguel $i, array $flash): array
    {
        $valor = (float) $i->valor_diaria;
        $comPromo = $this->precos->comPromocao($valor, (bool) $i->tem_promocao, $i->tipo_desconto, $i->valor_desconto);

        return $this->comDestaque([
            'chave' => 'item_aluguel:' . $i->id,
            'tipo' => 'item_aluguel',
            'id' => (int) $i->id,
            'titulo' => $i->nome,
            'local' => $i->local_id ? ['id' => (int) $i->local_id, 'nome' => $i->local_nome] : null,
            'categoria' => self::categoriaDoItem($i->categoria),
            'categoria_item' => $i->categoria,
            'descricao' => $i->descricao ? Str::limit(strip_tags($i->descricao), 160) : null,
            'foto' => $i->foto_principal,
            'valor' => round($valor, 2),
            'valor_com_promocao' => round($comPromo, 2),
            'tem_promocao' => $comPromo < $valor,
            'unidade' => 'por diária',
            'avaliacao' => $i->avaliacao_media ? round((float) $i->avaliacao_media, 1) : null,
            'lat' => (float) $i->ponto_lat,
            'lng' => (float) $i->ponto_lng,
            'distancia_km' => round((float) $i->distancia_km, 2),
            'cidade' => $i->cidade,
            'capacidade' => (int) ($i->capacidade_pessoas ?: $i->lugares ?: 0) ?: null,
            'aceita_pontos' => (bool) $i->aceita_pontos,
            'flash_deal' => $flash['item_aluguel:' . $i->id] ?? null,
        ], (int) $i->estabelecimento_id, 'usuario');
    }

    /** Mesma régua do Explorar: 0 premium, 1 aceita pontos, 2 pagamento online, 3 demais. */
    private function comDestaque(array $dados, int $dono, string $tipoDono): array
    {
        $nivel = $this->destaque->nivelDeDestaque($dono, $tipoDono);

        return $dados + [
            'nivel' => $nivel,
            'destaque_premium' => $nivel === 0,
            'aceita_pagamento_online' => $this->destaque->aceitaPagamentoOnline($dono, $tipoDono),
        ];
    }

    /** Flash Deals ativos por "tipo:id" (o selo aparece na locação e vira sugestão no roteiro). */
    private function flashDealsAtivos(): array
    {
        return FlashDeal::where('status', 'ativo')
            ->where('expira_em', '>', now())
            ->where(fn ($q) => $q->whereNull('inicia_em')->orWhere('inicia_em', '<=', now()))
            ->whereColumn('usados', '<', 'quantidade')
            ->get(['id', 'alvo_tipo', 'alvo_id', 'percentual', 'expira_em', 'quantidade', 'usados'])
            ->mapWithKeys(fn (FlashDeal $d) => [$d->alvo_tipo . ':' . $d->alvo_id => [
                'id' => $d->id,
                'percentual' => (int) $d->percentual,
                'expira_em' => $d->expira_em?->toIso8601String(),
                'vagas_restantes' => max(0, (int) $d->quantidade - (int) $d->usados),
            ]])
            ->all();
    }

    public static function categoriaDoItem(?string $categoria): string
    {
        $c = Str::of((string) $categoria)->lower()->value();

        return match (true) {
            in_array($c, RoteiroInteligenteService::HOSPEDAGEM, true) || in_array($c, ['flat', 'apartamento', 'kitnet', 'cobertura', 'chalé', 'cabana', 'quarto', 'hotel', 'pousada'], true) => 'hospedagem',
            in_array($c, RoteiroInteligenteService::VEICULOS, true) || $c === 'caminhao' => 'veiculos',
            in_array($c, RoteiroInteligenteService::PASSEIOS, true) => 'passeios',
            default => 'espacos',
        };
    }

    public static function categoriaDoServico(?string $ramo, ?string $tipo, ?string $nome): string
    {
        $texto = ' ' . Str::of(implode(' ', [$ramo, $tipo, $nome]))->ascii()->lower()->value() . ' ';
        foreach (self::RAMOS as $categoria => $palavras) {
            foreach ($palavras as $p) {
                if (str_contains($texto, Str::ascii($p))) {
                    return $categoria;
                }
            }
        }

        return 'servicos';
    }
}
