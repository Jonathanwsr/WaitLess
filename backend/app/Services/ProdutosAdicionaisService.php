<?php

namespace App\Services;

use App\Models\Agendamento;
use App\Models\Aluguel;
use App\Models\Estabelecimento;
use App\Models\ItemAluguel;
use App\Models\Produto;
use App\Models\Servico;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Produtos adicionais oferecidos junto com um serviço ou uma reserva (de qualquer tipo).
 *
 * Onde o produto aparece (definido pelo sócio):
 *  - "loja":    venda avulsa, não aparece como adicional (atrelado_reservas = false);
 *  - "local":   em todos os serviços e reservas do local (atrelado, sem serviço/reserva específicos);
 *  - "servico": só no serviço escolhido (servico_id);
 *  - "reserva": só na reserva escolhida (aluguel_id = id do item de reserva).
 *
 * O cliente escolhe na hora de agendar/reservar; o valor entra no total cobrado, o estoque baixa
 * e o adicional fica registrado na reserva (itens_aluguel, categoria "produto_extra").
 */
class ProdutosAdicionaisService
{
    public const MODOS = ['loja', 'local', 'servico', 'reserva'];
    public const MAX_POR_ITEM = 10;

    // ---------------------------------------------------------------- lado do sócio

    /** Modo de um produto já cadastrado (para a tela de edição). */
    public static function modoDe(Produto $p): string
    {
        return match (true) {
            !$p->atrelado_reservas => 'loja',
            (bool) $p->servico_id => 'servico',
            (bool) $p->aluguel_id => 'reserva',
            default => 'local',
        };
    }

    /**
     * Converte a escolha da tela ("onde aparece") nos campos do produto, conferindo que o serviço
     * e a reserva são do mesmo local/dono. Aceita o formato antigo (atrelado_reservas + ids).
     */
    public function normalizarVinculo(array $dados, int $estabelecimentoId, User $user): array
    {
        $modo = $dados['vinculo_modo'] ?? null;
        if (!in_array($modo, self::MODOS, true)) {
            $atrelado = filter_var($dados['atrelado_reservas'] ?? false, FILTER_VALIDATE_BOOLEAN) || !empty($dados['servico_id']) || !empty($dados['aluguel_id']);
            $modo = !$atrelado ? 'loja' : (!empty($dados['servico_id']) ? 'servico' : (!empty($dados['aluguel_id']) ? 'reserva' : 'local'));
        }

        $servicoId = null;
        $reservaId = null;
        if ($modo === 'servico') {
            $servicoId = (int) ($dados['servico_id'] ?? 0);
            if (!$servicoId || !Servico::where('id', $servicoId)->where('estabelecimento_id', $estabelecimentoId)->exists()) {
                throw ValidationException::withMessages(['servico_id' => 'Escolha um serviço deste local.']);
            }
        }
        if ($modo === 'reserva') {
            $reservaId = (int) ($dados['aluguel_id'] ?? 0);
            if (!$reservaId || !$this->reservasDoSocio($user, $estabelecimentoId)->contains('id', $reservaId)) {
                throw ValidationException::withMessages(['aluguel_id' => 'Escolha uma reserva deste local.']);
            }
        }

        return [
            'atrelado_reservas' => $modo !== 'loja',
            'servico_id' => $servicoId,
            'aluguel_id' => $reservaId,
        ];
    }

    /** Reservas (de qualquer tipo) que o sócio pode usar como vínculo: as do local e as avulsas dele. */
    public function reservasDoSocio(User $user, ?int $estabelecimentoId = null): Collection
    {
        $locais = DB::table('estabelecimento_usuario')->where('usuario_id', $user->id)->pluck('estabelecimento_id');
        if ($estabelecimentoId) {
            $locais = $locais->filter(fn ($id) => (int) $id === $estabelecimentoId)->values();
        }

        return ItemAluguel::catalogo()
            ->where(fn ($q) => $q->whereIn('local_id', $locais)->orWhere(fn ($a) => $a->whereNull('local_id')->where('estabelecimento_id', $user->id)))
            ->orderBy('nome')
            ->get(['id', 'nome', 'categoria', 'local_id', 'estabelecimento_id'])
            ->map(fn ($i) => [
                'id' => $i->id,
                'nome' => $i->nome,
                'categoria' => $i->categoria,
                'categoria_rotulo' => \App\Support\Categorias::rotuloReserva($i->categoria),
                'estabelecimento_id' => $i->local_id,
                'avulsa' => !$i->local_id,
            ]);
    }

    // ---------------------------------------------------------------- lado do cliente

    /**
     * Adicionais que o cliente pode escolher para um serviço ou uma reserva.
     * Reserva avulsa (sem local) só mostra os produtos ligados a ela.
     */
    public function disponiveis(?int $servicoId = null, ?int $itemId = null, ?User $user = null): Collection
    {
        $servico = $servicoId ? Servico::find($servicoId) : null;
        $item = $itemId ? ItemAluguel::find($itemId) : null;
        $localId = $servico?->estabelecimento_id ?? $item?->local_id;
        if (!$servico && !$item) {
            return collect();
        }

        $query = Produto::query()
            ->where('atrelado_reservas', true)
            ->where('estoque_disponivel', '>', 0)
            ->where(function ($q) use ($servico, $item, $localId) {
                if ($localId) {
                    $q->orWhere(fn ($l) => $l->where('estabelecimento_id', $localId)->whereNull('servico_id')->whereNull('aluguel_id'));
                }
                if ($servico) {
                    $q->orWhere(fn ($s) => $s->where('servico_id', $servico->id)->where('estabelecimento_id', $servico->estabelecimento_id));
                }
                if ($item) {
                    $q->orWhere('aluguel_id', $item->id);
                }
            });

        if (!$user || !$user->isPremium()) {
            $query->where('somente_premium', false);
        }

        return $query->orderByRaw('CASE WHEN servico_id IS NOT NULL OR aluguel_id IS NOT NULL THEN 0 ELSE 1 END')
            ->orderByDesc('is_promocao')
            ->orderBy('nome')
            ->get()
            ->map(fn (Produto $p) => $this->paraCliente($p, $servico, $item));
    }

    public function paraCliente(Produto $p, ?Servico $servico = null, ?ItemAluguel $item = null): array
    {
        $vinculo = $p->servico_id ? 'servico' : ($p->aluguel_id ? 'reserva' : 'local');
        $fotos = Produto::decodeFotos($p->fotos);
        $foto = $fotos[0] ?? null;
        if ($foto && !str_starts_with($foto, 'http') && !str_starts_with($foto, '/')) {
            $foto = '/storage/' . $foto;
        }

        return [
            'id' => $p->id,
            'nome' => $p->nome,
            'descricao' => $p->descricao,
            'categoria' => $p->categoria,
            'detalhes' => collect([$p->tamanho ? "Tam. {$p->tamanho}" : null, $p->cor])->filter()->implode(' · ') ?: null,
            'foto' => $foto,
            'valor' => (float) $p->valor_final,
            'valor_normal' => (float) $p->valor_normal,
            'em_promocao' => (bool) $p->is_promocao && (float) $p->valor_final < (float) $p->valor_normal,
            'estoque' => (int) $p->estoque_disponivel,
            'ultimas_unidades' => (int) $p->estoque_disponivel <= 3,
            'somente_premium' => (bool) $p->somente_premium,
            'vinculo' => $vinculo,
            'vinculo_texto' => match ($vinculo) {
                'servico' => 'Feito para ' . ($servico?->nome ?? 'este serviço'),
                'reserva' => 'Feito para ' . ($item?->nome ?? 'esta reserva'),
                default => 'Disponível em todo o local',
            },
            'maximo' => min(self::MAX_POR_ITEM, (int) $p->estoque_disponivel),
        ];
    }

    /** Aceita "3,5,5", [3,5,5] ou [{id:3, quantidade:2}] e devolve [produto_id => quantidade]. */
    public static function normalizarPedido(mixed $entrada): array
    {
        if (is_string($entrada)) {
            $entrada = array_filter(explode(',', $entrada), fn ($v) => trim($v) !== '');
        }
        $pedido = [];
        foreach ((array) $entrada as $linha) {
            [$id, $qtd] = is_array($linha) ? [(int) ($linha['id'] ?? 0), (int) ($linha['quantidade'] ?? 1)] : [(int) $linha, 1];
            if ($id > 0 && $qtd > 0) {
                $pedido[$id] = ($pedido[$id] ?? 0) + $qtd;
            }
        }

        return $pedido;
    }

    /**
     * Confere a escolha do cliente (só adicionais oferecidos para aquele serviço/reserva, com estoque)
     * e calcula o total. Lança ValidationException com mensagem clara.
     *
     * @return array{itens: array<int, array{produto_id:int, nome:string, quantidade:int, valor:float}>, total: float}
     */
    public function orcar(array $pedido, ?int $servicoId, ?int $itemId, ?User $user): array
    {
        if (!$pedido) {
            return ['itens' => [], 'total' => 0.0];
        }
        $ofertados = $this->disponiveis($servicoId, $itemId, $user)->keyBy('id');
        $itens = [];
        foreach ($pedido as $id => $qtd) {
            $p = $ofertados->get($id);
            if (!$p) {
                throw ValidationException::withMessages(['extras' => 'Um dos adicionais escolhidos não está mais disponível. Revise a lista e tente de novo.']);
            }
            if ($qtd > $p['maximo']) {
                throw ValidationException::withMessages(['extras' => "Só restam {$p['estoque']} unidade(s) de \"{$p['nome']}\"."]);
            }
            $itens[] = ['produto_id' => $id, 'nome' => $p['nome'], 'quantidade' => $qtd, 'valor' => $p['valor']];
        }

        return ['itens' => $itens, 'total' => round(array_sum(array_map(fn ($i) => $i['valor'] * $i['quantidade'], $itens)), 2)];
    }

    /** Baixa o estoque (travando a linha) e registra os adicionais na reserva. Chamar dentro da transação. */
    public function registrar(array $orcamento, Agendamento|Aluguel $reserva, User $user): void
    {
        foreach ($orcamento['itens'] as $linha) {
            $produto = Produto::whereKey($linha['produto_id'])->lockForUpdate()->firstOrFail();
            if ($produto->estoque_disponivel < $linha['quantidade']) {
                throw ValidationException::withMessages(['extras' => "O adicional \"{$produto->nome}\" acabou de esgotar. Remova-o e tente de novo."]);
            }
            $produto->decrement('estoque_disponivel', $linha['quantidade']);
            $produto->increment('quantidade_vendida', $linha['quantidade']);

            DB::table('itens_aluguel')->insert([
                'nome' => $produto->nome,
                'categoria' => 'produto_extra',
                'descricao' => $produto->descricao,
                'quantidade' => $linha['quantidade'],
                'valor_diaria' => $linha['valor'],
                'produto_id' => $produto->id,
                'usuario_id' => $user->id,
                // itens_aluguel.estabelecimento_id guarda o dono (users.id).
                'estabelecimento_id' => $produto->usuario_id,
                'servico_id' => $reserva instanceof Agendamento ? $reserva->servico_id : null,
                'agendamento_id' => $reserva instanceof Agendamento ? $reserva->id : null,
                'aluguel_id' => $reserva instanceof Aluguel ? $reserva->id : null,
                'ativo' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    /** Desfaz os adicionais de uma reserva que não chegou a ser criada de vez (devolve o estoque). */
    public function estornar(Agendamento|Aluguel $reserva): void
    {
        $coluna = $reserva instanceof Aluguel ? 'aluguel_id' : 'agendamento_id';
        foreach (DB::table('itens_aluguel')->where($coluna, $reserva->id)->whereNotNull('produto_id')->get(['id', 'produto_id', 'quantidade']) as $linha) {
            Produto::whereKey($linha->produto_id)->increment('estoque_disponivel', (int) $linha->quantidade);
            Produto::whereKey($linha->produto_id)->where('quantidade_vendida', '>=', (int) $linha->quantidade)->decrement('quantidade_vendida', (int) $linha->quantidade);
            DB::table('itens_aluguel')->where('id', $linha->id)->delete();
        }
    }

    /** Adicionais já comprados numa reserva (telas de detalhe do cliente e do sócio). */
    public function daReserva(Agendamento|Aluguel $reserva): array
    {
        return DB::table('itens_aluguel')
            ->where($reserva instanceof Aluguel ? 'aluguel_id' : 'agendamento_id', $reserva->id)
            ->get(['nome', 'quantidade', 'valor_diaria'])
            ->map(fn ($i) => ['nome' => $i->nome, 'quantidade' => (int) $i->quantidade, 'valor' => (float) $i->valor_diaria])
            ->values()
            ->all();
    }
}
