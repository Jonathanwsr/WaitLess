<?php

namespace App\Services\Viagem;

use App\Models\Cupom;
use App\Models\FlashDeal;
use App\Models\ItemAluguel;
use App\Models\ProdutoEntrega;
use App\Models\Servico;
use App\Services\DestaquePremiumService;
use App\Services\PrecificacaoService;
use Illuminate\Support\Collection;

/**
 * "Mala de viagem": o que dá para pôr na viagem em uma cidade, por categoria
 * (hospedagem, passeios e serviços, transporte e produtos), já no formato de item de viagem.
 * Cada item vem marcado com o que chama atenção: destaque Premium, exclusivo Premium,
 * promoção, oferta relâmpago e cupom disponível — e a busca pode filtrar por isso.
 * Premium primeiro (mesma regra do Explorar), depois os mais bem avaliados.
 */
class MalaViagemService
{
    public const CATEGORIAS = ['tudo', 'hospedagem', 'passeios', 'transporte', 'produtos'];
    public const FILTROS = ['premium', 'promocao', 'cupom', 'relampago'];
    public const ORDENS = ['relevancia', 'menor_preco', 'maior_preco', 'avaliacao'];

    public function __construct(private DestaquePremiumService $destaque, private PrecificacaoService $precos)
    {
    }

    /**
     * @param array{filtros?:array, ordem?:string, preco_max?:float|null} $opcoes
     * @return array{itens:Collection, contagem:array}
     */
    public function buscar(string $categoria, string $cidade, ?string $busca = null, array $opcoes = []): array
    {
        $todos = $this->catalogo($categoria, $cidade, $busca);

        // Quantos itens de cada selo existem na busca atual (para os chips de filtro).
        $contagem = ['total' => $todos->count()];
        foreach (self::FILTROS as $f) {
            $contagem[$f] = $todos->filter(fn ($i) => $this->temSelo($i, $f))->count();
        }

        $filtros = array_values(array_intersect($opcoes['filtros'] ?? [], self::FILTROS));
        $precoMax = isset($opcoes['preco_max']) && $opcoes['preco_max'] !== '' ? (float) $opcoes['preco_max'] : null;

        $itens = $todos
            ->filter(fn ($i) => collect($filtros)->every(fn ($f) => $this->temSelo($i, $f)))
            ->when($precoMax, fn ($c) => $c->filter(fn ($i) => $i['preco'] > 0 && $i['preco'] <= $precoMax));

        $itens = match ($opcoes['ordem'] ?? 'relevancia') {
            'menor_preco' => $itens->sortBy(fn ($i) => [$i['preco'] > 0 ? 0 : 1, $i['preco']]),
            'maior_preco' => $itens->sortByDesc('preco'),
            'avaliacao' => $itens->sortByDesc(fn ($i) => $i['avaliacao'] ?? 0),
            default => $itens,
        };

        return ['itens' => $itens->values(), 'contagem' => $contagem];
    }

    public function catalogo(string $categoria, string $cidade, ?string $busca = null): Collection
    {
        $cidade = trim($cidade);
        $busca = $busca ? trim($busca) : null;

        $itens = match ($categoria) {
            'hospedagem' => $this->itensDeAluguel(CrossSellViagemService::CATEGORIAS_HOSPEDAGEM, 'hospedagem', '/noite', $cidade, $busca),
            'transporte' => $this->itensDeAluguel(CrossSellViagemService::CATEGORIAS_VEICULO, 'transporte', '/dia', $cidade, $busca),
            'passeios' => $this->servicos($cidade, $busca),
            'produtos' => $this->produtos($cidade, $busca),
            // Busca geral: tudo o que existe no destino, numa lista só.
            'tudo' => $this->itensDeAluguel(CrossSellViagemService::CATEGORIAS_HOSPEDAGEM, 'hospedagem', '/noite', $cidade, $busca, 15)
                ->concat($this->servicos($cidade, $busca, 20))
                ->concat($this->itensDeAluguel(CrossSellViagemService::CATEGORIAS_VEICULO, 'transporte', '/dia', $cidade, $busca, 15))
                ->concat($this->produtos($cidade, $busca, 15)),
            default => collect(),
        };

        return $this->comCuponsERelampagos($itens)
            ->sortBy(fn ($i) => [$i['nivel'], $i['relampago'] ? 0 : 1, -($i['avaliacao'] ?? 0)])
            ->values();
    }

    private function temSelo(array $item, string $filtro): bool
    {
        return match ($filtro) {
            'premium' => $item['premium'] || $item['so_premium'],
            'promocao' => $item['promocao'] !== null,
            'cupom' => $item['cupom'] !== null,
            'relampago' => $item['relampago'] !== null,
            default => true,
        };
    }

    private function itensDeAluguel(array $categorias, string $tipo, string $unidade, string $cidade, ?string $busca, int $limite = 40): Collection
    {
        return ItemAluguel::catalogo()
            ->whereIn('categoria', $categorias)
            ->where('ativo', true)
            ->where('cidade', 'ilike', '%' . $cidade . '%')
            ->when($busca, fn ($q) => $q->where(fn ($w) => $w->where('nome', 'ilike', "%{$busca}%")->orWhere('categoria', 'ilike', "%{$busca}%")->orWhere('bairro', 'ilike', "%{$busca}%")->orWhere('descricao', 'ilike', "%{$busca}%")))
            ->limit($limite)
            ->get()
            ->map(function (ItemAluguel $i) use ($tipo, $unidade) {
                $cheio = (float) ($i->valor_diaria ?: $i->valor ?: 0);
                $preco = $this->precos->comPromocao($cheio, (bool) $i->tem_promocao, $i->tipo_desconto, $i->valor_desconto);
                $nivel = $this->destaque->nivelDeDestaque((int) $i->estabelecimento_id, 'usuario');

                return $this->item([
                    'chave' => "aluguel-{$i->id}",
                    'tipo' => $tipo,
                    'titulo' => $i->nome,
                    'subtitulo' => trim(str_replace('_', ' ', (string) $i->categoria) . ($i->bairro ? " · {$i->bairro}" : '')),
                    'foto' => $this->primeiraFoto($i->fotos),
                    'preco' => $preco,
                    'preco_cheio' => $cheio,
                    'unidade' => $unidade,
                    'avaliacao' => $i->avaliacao_media ? round((float) $i->avaliacao_media, 1) : null,
                    'item_aluguel_id' => $i->id,
                    'dono_id' => (int) $i->estabelecimento_id,
                    'endereco' => trim(implode(', ', array_filter([$i->endereco, $i->numero, $i->bairro]))),
                    'latitude' => $i->latitude, 'longitude' => $i->longitude,
                    'nivel' => $nivel,
                    'so_premium' => (bool) $i->somente_premium,
                ]);
            });
    }

    private function servicos(string $cidade, ?string $busca, int $limite = 40): Collection
    {
        return Servico::with('estabelecimento:id,nome,cidade,bairro,rua,numero,latitude,longitude,ramo_atuacao')
            ->where('ativo', true)
            ->whereHas('estabelecimento', fn ($q) => $q->where('ativo', true)->where('cidade', 'ilike', '%' . $cidade . '%'))
            ->when($busca, fn ($q) => $q->where(fn ($w) => $w->where('nome', 'ilike', "%{$busca}%")
                ->orWhere('tipo_servico', 'ilike', "%{$busca}%")
                ->orWhereHas('estabelecimento', fn ($e) => $e->where('nome', 'ilike', "%{$busca}%")->orWhere('ramo_atuacao', 'ilike', "%{$busca}%"))))
            ->limit($limite)
            ->get()
            ->map(function (Servico $s) {
                $local = $s->estabelecimento;
                $ehPasseio = preg_match('/passeio|tour|turis|trilha|mergulho|barco|buggy|ingresso|atra/i', $s->nome . ' ' . $s->tipo_servico . ' ' . $local?->ramo_atuacao);
                $cheio = (float) $s->valor;

                return $this->item([
                    'chave' => "servico-{$s->id}",
                    'tipo' => $ehPasseio ? 'atracao' : 'servico',
                    'titulo' => $s->nome,
                    'subtitulo' => trim(($local?->nome ?? '') . ($s->duracao_minutos ? " · {$s->duracao_minutos} min" : '')),
                    'foto' => $this->primeiraFoto($s->fotos),
                    'preco' => $this->precos->comPromocao($cheio, (bool) $s->tem_promocao, $s->tipo_desconto, $s->valor_desconto),
                    'preco_cheio' => $cheio,
                    'unidade' => '/pessoa',
                    'avaliacao' => $s->avaliacao_media ? round((float) $s->avaliacao_media, 1) : null,
                    'servico_id' => $s->id,
                    'estabelecimento_id' => $local?->id,
                    'endereco' => trim(implode(', ', array_filter([$local?->rua, $local?->numero, $local?->bairro]))),
                    'latitude' => $local?->latitude, 'longitude' => $local?->longitude,
                    'nivel' => $local ? $this->destaque->nivelDeDestaque((int) $local->id) : 3,
                    'so_premium' => (bool) $s->somente_premium,
                ]);
            });
    }

    private function produtos(string $cidade, ?string $busca, int $limite = 40): Collection
    {
        return ProdutoEntrega::query()
            ->where('ativo', true)
            ->where('estoque_disponivel', '>', 0)
            ->where('endereco_cidade', 'ilike', '%' . $cidade . '%')
            ->when($busca, fn ($q) => $q->where(fn ($w) => $w->where('nome', 'ilike', "%{$busca}%")->orWhere('categoria', 'ilike', "%{$busca}%")->orWhere('marca', 'ilike', "%{$busca}%")))
            ->limit($limite)
            ->get()
            ->map(fn (ProdutoEntrega $p) => $this->item([
                'chave' => "produto-{$p->id}",
                'tipo' => 'produto',
                'titulo' => $p->nome,
                'subtitulo' => trim(($p->categoria ?? 'Produto') . ($p->aceita_entrega ? ' · entrega' : '') . ($p->aceita_retirada ? ' · retirada' : '')),
                'foto' => $this->primeiraFoto($p->fotos),
                'preco' => (float) ($p->tem_promocao && $p->valor_promocional && (float) $p->valor_promocional < (float) $p->valor ? $p->valor_promocional : $p->valor),
                'preco_cheio' => (float) $p->valor,
                'unidade' => 'un.',
                'avaliacao' => null,
                'produto_id' => $p->id,
                'estabelecimento_id' => $p->estabelecimento_id,
                'endereco' => trim(implode(', ', array_filter([$p->endereco_rua, $p->endereco_numero, $p->endereco_bairro]))),
                'latitude' => $p->endereco_latitude, 'longitude' => $p->endereco_longitude,
                'nivel' => $this->destaque->nivelDeDestaque((int) $p->usuario_id, 'usuario'),
                'so_premium' => false,
            ]));
    }

    /** Formato comum de um item do catálogo, com a promoção já calculada. */
    private function item(array $dados): array
    {
        $cheio = (float) ($dados['preco_cheio'] ?? 0);
        $preco = (float) $dados['preco'];
        $temPromocao = $cheio > 0 && $preco < $cheio;

        return $dados + [
            'premium' => $dados['nivel'] === 0,
            'promocao' => $temPromocao ? ['de' => $cheio, 'percentual' => (int) round((1 - $preco / $cheio) * 100)] : null,
            'cupom' => null,
            'relampago' => null,
            'servico_id' => null, 'item_aluguel_id' => null, 'produto_id' => null, 'estabelecimento_id' => null,
        ];
    }

    /** Em duas consultas: o melhor cupom vigente e a oferta relâmpago ativa de cada item. */
    private function comCuponsERelampagos(Collection $itens): Collection
    {
        if ($itens->isEmpty()) {
            return $itens;
        }

        $servicos = $itens->pluck('servico_id')->filter()->unique()->values()->all();
        $alugueis = $itens->pluck('item_aluguel_id')->filter()->unique()->values()->all();
        $locais = $itens->where('servico_id', '!=', null)->pluck('estabelecimento_id')->filter()->unique()->values()->all();

        $cupons = Cupom::query()
            ->where('ativo', true)
            ->where(fn ($q) => $q->whereNull('data_validade')->orWhere('data_validade', '>', now()))
            ->where(function ($q) use ($servicos, $alugueis, $locais) {
                $q->whereIn('servico_id', $servicos ?: [0])
                    ->orWhereIn('item_aluguel_id', $alugueis ?: [0])
                    ->orWhere(fn ($l) => $l->whereNull('servico_id')->whereNull('item_aluguel_id')->whereIn('estabelecimento_id', $locais ?: [0]));
            })
            ->get(['id', 'codigo', 'titulo', 'tipo_desconto', 'valor_desconto', 'apenas_plus', 'pontos_custo', 'servico_id', 'item_aluguel_id', 'estabelecimento_id']);

        $relampagos = FlashDeal::query()
            ->where('status', 'ativo')
            ->where('expira_em', '>', now())
            ->whereColumn('usados', '<', 'quantidade')
            ->where(fn ($q) => $q->where(fn ($s) => $s->where('alvo_tipo', 'servico')->whereIn('alvo_id', $servicos ?: [0]))
                ->orWhere(fn ($a) => $a->where('alvo_tipo', 'item_aluguel')->whereIn('alvo_id', $alugueis ?: [0])))
            ->get(['alvo_tipo', 'alvo_id', 'percentual', 'expira_em', 'quantidade', 'usados']);

        return $itens->map(function (array $item) use ($cupons, $relampagos) {
            $doItem = $cupons->filter(fn (Cupom $c) => ($item['servico_id'] && $c->servico_id === $item['servico_id'])
                || ($item['item_aluguel_id'] && $c->item_aluguel_id === $item['item_aluguel_id'])
                || ($item['servico_id'] && !$c->servico_id && !$c->item_aluguel_id && $c->estabelecimento_id === $item['estabelecimento_id']));
            $melhor = $doItem->sortByDesc(fn (Cupom $c) => $c->tipo_desconto === 'percentual'
                ? $item['preco'] * (float) $c->valor_desconto / 100
                : (float) $c->valor_desconto)->first();

            if ($melhor) {
                $valor = (float) $melhor->valor_desconto;
                $item['cupom'] = [
                    'codigo' => $melhor->codigo,
                    'titulo' => $melhor->titulo,
                    'rotulo' => $melhor->tipo_desconto === 'percentual'
                        ? rtrim(rtrim(number_format($valor, 2, ',', ''), '0'), ',') . '% OFF'
                        : 'R$ ' . number_format($valor, 2, ',', '.') . ' OFF',
                    'apenas_plus' => (bool) $melhor->apenas_plus,
                    'pontos' => (int) $melhor->pontos_custo,
                ];
            }

            $deal = $relampagos->first(fn ($d) => ($d->alvo_tipo === 'servico' && (int) $d->alvo_id === (int) $item['servico_id'])
                || ($d->alvo_tipo === 'item_aluguel' && (int) $d->alvo_id === (int) $item['item_aluguel_id']));
            if ($deal) {
                $item['relampago'] = [
                    'percentual' => (int) $deal->percentual,
                    'expira_em' => $deal->expira_em->toIso8601String(),
                    'restantes' => max(0, (int) $deal->quantidade - (int) $deal->usados),
                ];
            }

            unset($item['dono_id']);

            return $item;
        });
    }

    private function primeiraFoto($fotos): ?string
    {
        $lista = is_array($fotos) ? $fotos : (json_decode((string) $fotos, true) ?: []);
        $foto = $lista[0] ?? null;
        if (!is_string($foto) || $foto === '') {
            return null;
        }

        return str_starts_with($foto, 'http') ? $foto : '/storage/' . ltrim($foto, '/');
    }
}
