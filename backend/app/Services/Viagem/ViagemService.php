<?php

namespace App\Services\Viagem;

use App\Events\ViagemMensagemEnviada;
use App\Models\Agendamento;
use App\Models\Aluguel;
use App\Models\User;
use App\Models\Viagem;
use App\Models\ViagemItem;
use App\Models\ViagemMensagem;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use InvalidArgumentException;

/** Persistência e leitura da viagem: criação com roteiro, painel do grupo, reservas compartilhadas e chat. */
class ViagemService
{
    private const STATUS_RESERVA_CANCELADA = ['cancelado', 'estornado'];
    private const STATUS_RESERVA_CONFIRMADA = ['confirmado', 'pago', 'finalizado', 'success', 'sucesso'];

    private const CAMPOS_ITEM = [
        'dia', 'data_fim', 'ordem', 'hora_inicio', 'hora_fim', 'tipo', 'titulo', 'descricao', 'endereco',
        'latitude', 'longitude', 'estabelecimento_id', 'servico_id', 'item_aluguel_id', 'custo_estimado',
        'deslocamento_min', 'distancia_km', 'destaque_premium', 'score',
    ];

    public function __construct(private DivisaoGastosService $gastos) {}

    // ------------------------------------------------------------- criação

    public function criar(User $criador, array $dados, array $itens): Viagem
    {
        return DB::transaction(function () use ($criador, $dados, $itens) {
            $inicio = \Carbon\Carbon::parse($dados['data_inicio']);
            $fim = \Carbon\Carbon::parse($dados['data_fim']);

            $viagem = Viagem::create([
                'criador_id' => $criador->id,
                'titulo' => $dados['titulo'] ?: 'Viagem para ' . $dados['cidade'],
                'destino' => $dados['cidade'] . (!empty($dados['estado']) ? ', ' . $dados['estado'] : ''),
                'cidade' => $dados['cidade'],
                'estado' => $dados['estado'] ?? null,
                'data_inicio' => $inicio,
                'data_fim' => $fim,
                'total_dias' => (int) $inicio->diffInDays($fim) + 1,
                'quantidade_pessoas' => $dados['pessoas'],
                'orcamento_limite' => $dados['orcamento'] ?? null,
                'preferencias' => $dados['preferencias'] ?? [],
                'codigo_convite' => strtoupper(Str::random(10)),
                'gastos_planejados' => [],
                'status' => 'planejando',
            ]);

            $viagem->membros()->attach($criador->id, ['funcao' => 'criador', 'presenca' => 'confirmado']);
            $this->salvarItens($viagem, $itens, $criador->id);
            $this->avisarGrupo($viagem, "{$criador->name} criou a viagem. Convide o pessoal e confirmem presença!");

            return $viagem;
        });
    }

    /** Só aceita os campos conhecidos e força os tipos — o roteiro pode ter sido editado no navegador. */
    public function salvarItens(Viagem $viagem, array $itens, int $autorId): void
    {
        foreach (array_values($itens) as $i => $item) {
            $limpo = array_intersect_key($item, array_flip(self::CAMPOS_ITEM));
            $limpo['titulo'] = Str::limit((string) ($limpo['titulo'] ?? 'Item'), 250, '');
            $limpo['tipo'] = in_array($limpo['tipo'] ?? '', ['hospedagem', 'transporte', 'servico', 'atracao', 'livre', 'personalizado'], true) ? $limpo['tipo'] : 'personalizado';
            $limpo['custo_estimado'] = max((float) ($limpo['custo_estimado'] ?? 0), 0);
            $limpo['ordem'] = $limpo['ordem'] ?? $i;
            $limpo['destaque_premium'] = (bool) ($limpo['destaque_premium'] ?? false);

            ViagemItem::create($limpo + [
                'viagem_id' => $viagem->id,
                'criado_por_id' => $autorId,
                'origem' => ($item['origem'] ?? 'auto') === 'manual' ? 'manual' : 'auto',
                'status' => 'sugerido',
            ]);
        }
    }

    // ------------------------------------------------------------- painel

    /** Tudo que a tela da viagem precisa, já filtrado para quem está vendo. */
    public function painel(Viagem $viagem, User $user): array
    {
        $viagem->load(['membros:id,name,email', 'criador:id,name']);
        $nomes = $viagem->membros->pluck('name', 'id')->all() + [$viagem->criador_id => $viagem->criador?->name];

        $itens = $viagem->itens()->with(['presencas', 'agendamento.servico:id,nome', 'aluguel', 'reservadoPor:id,name'])->get();

        $despesas = $viagem->despesas()->with(['partes', 'pagador:id,name', 'item:id,titulo'])->limit(100)->get();
        $calculo = $this->gastos->saldos($viagem->fresh());
        $acertos = $this->gastos->acertos($calculo['saldos']);

        $souEditor = $viagem->podeEditar($user->id);

        return [
            'viagem' => [
                'id' => $viagem->id,
                'titulo' => $viagem->titulo,
                'destino' => $viagem->destino,
                'cidade' => $viagem->cidade,
                'estado' => $viagem->estado,
                'data_inicio' => $viagem->data_inicio?->toDateString(),
                'data_fim' => $viagem->data_fim?->toDateString(),
                'total_dias' => $viagem->total_dias,
                'quantidade_pessoas' => $viagem->quantidade_pessoas,
                'orcamento_limite' => $viagem->orcamento_limite !== null ? (float) $viagem->orcamento_limite : null,
                'status' => $viagem->status,
                'codigo_convite' => $souEditor ? $viagem->codigo_convite : null,
                'sou_criador' => $viagem->criador_id === $user->id,
                'posso_editar' => $souEditor,
            ],
            'membros' => $viagem->membros->map(fn ($m) => [
                'id' => $m->id, 'nome' => $m->name, 'email' => $m->email,
                'funcao' => $m->pivot->funcao, 'presenca' => $m->pivot->presenca,
            ])->values(),
            'itens' => $itens->map(fn (ViagemItem $i) => $this->itemParaTela($i, $user->id, $nomes))->values(),
            'custos' => [
                'estimado' => round((float) $itens->where('status', '!=', 'cancelado')->sum('custo_estimado'), 2),
                'gasto_real' => round((float) $despesas->sum('valor'), 2),
            ],
            'despesas' => $despesas->map(fn ($d) => [
                'id' => $d->id, 'descricao' => $d->descricao, 'valor' => $d->valor,
                'data' => $d->data_despesa?->toDateString(), 'categoria' => $d->categoria,
                'pagador_id' => $d->pagador_id, 'pagador' => $d->pagador?->name,
                'item' => $d->item?->titulo, 'viagem_item_id' => $d->viagem_item_id,
                'partes' => $d->partes->map(fn ($p) => ['usuario_id' => $p->usuario_id, 'nome' => $nomes[$p->usuario_id] ?? '—', 'valor' => $p->valor])->values(),
                'pode_apagar' => $d->criado_por_id === $user->id || $viagem->criador_id === $user->id,
            ])->values(),
            'saldos' => collect($calculo['saldos'])->map(fn ($s, $uid) => [
                'usuario_id' => $uid, 'nome' => $nomes[$uid] ?? '—',
                'pago' => $calculo['pago'][$uid] / 100, 'devido' => $calculo['devido'][$uid] / 100, 'saldo' => $s / 100,
            ])->values(),
            'acertos' => collect($acertos)->map(fn ($a) => $a + ['de_nome' => $nomes[$a['de']] ?? '—', 'para_nome' => $nomes[$a['para']] ?? '—'])->values(),
            'pagamentos' => $viagem->pagamentos()->latest()->limit(30)->get()->map(fn ($p) => [
                'id' => $p->id, 'de_nome' => $nomes[$p->de_id] ?? '—', 'para_nome' => $nomes[$p->para_id] ?? '—',
                'valor' => $p->valor, 'observacao' => $p->observacao, 'criado_em' => optional($p->created_at)->toIso8601String(),
            ])->values(),
            'mensagens' => $viagem->mensagens()->with('autor:id,name')->latest('id')->limit(60)->get()->reverse()->map->paraTela()->values(),
            'minhas_reservas' => $this->reservasCompartilhaveis($viagem, $user),
            'eu' => ['id' => $user->id, 'nome' => $user->name],
        ];
    }

    private function itemParaTela(ViagemItem $i, int $meuId, array $nomes): array
    {
        $reserva = null;
        if ($i->agendamento) {
            $reserva = [
                'tipo' => 'agendamento', 'id' => $i->agendamento->id, 'status' => $i->agendamento->status,
                'quando' => trim($i->agendamento->data_agendamento . ' ' . $i->agendamento->hora_agendamento),
                'valor' => (float) $i->agendamento->valor_final,
            ];
        } elseif ($i->aluguel) {
            $reserva = [
                'tipo' => 'aluguel', 'id' => $i->aluguel->id, 'status' => $i->aluguel->status,
                'codigo' => $i->aluguel->codigo_reserva, 'valor' => (float) $i->aluguel->valor_total,
                'quando' => trim($i->aluguel->data_inicio . ' → ' . $i->aluguel->data_fim),
            ];
        }
        if ($reserva) {
            $reserva['por'] = $i->reservadoPor?->name;
            $reserva['confirmada'] = in_array($reserva['status'], self::STATUS_RESERVA_CONFIRMADA, true);
            $reserva['cancelada'] = in_array($reserva['status'], self::STATUS_RESERVA_CANCELADA, true);
        }

        return [
            'id' => $i->id,
            'dia' => $i->dia?->toDateString(), 'data_fim' => $i->data_fim?->toDateString(),
            'ordem' => $i->ordem,
            'hora_inicio' => $i->hora_inicio ? substr($i->hora_inicio, 0, 5) : null,
            'hora_fim' => $i->hora_fim ? substr($i->hora_fim, 0, 5) : null,
            'tipo' => $i->tipo, 'titulo' => $i->titulo, 'descricao' => $i->descricao, 'endereco' => $i->endereco,
            'latitude' => $i->latitude, 'longitude' => $i->longitude,
            'custo_estimado' => $i->custo_estimado,
            'deslocamento_min' => $i->deslocamento_min, 'distancia_km' => $i->distancia_km,
            'destaque_premium' => $i->destaque_premium,
            'status' => $reserva ? ($reserva['cancelada'] ? 'sugerido' : ($reserva['confirmada'] ? 'confirmado' : 'reservado')) : $i->status,
            'origem' => $i->origem,
            'servico_id' => $i->servico_id, 'item_aluguel_id' => $i->item_aluguel_id, 'estabelecimento_id' => $i->estabelecimento_id,
            'reserva' => $reserva,
            'presencas' => $i->presencas->map(fn ($p) => ['usuario_id' => $p->usuario_id, 'nome' => $nomes[$p->usuario_id] ?? '—', 'status' => $p->status])->values(),
            'minha_presenca' => optional($i->presencas->firstWhere('usuario_id', $meuId))->status,
        ];
    }

    // ------------------------------------------------------------- reservas do grupo

    /** Reservas do próprio usuário, na cidade e nas datas da viagem, que ainda não estão no roteiro. */
    public function reservasCompartilhaveis(Viagem $viagem, User $user): array
    {
        $ja = ViagemItem::where('viagem_id', $viagem->id);
        $agJa = (clone $ja)->whereNotNull('agendamento_id')->pluck('agendamento_id')->all();
        $alJa = (clone $ja)->whereNotNull('aluguel_id')->pluck('aluguel_id')->all();
        $cidade = Str::of((string) $viagem->cidade)->ascii()->lower()->value();
        $inicio = $viagem->data_inicio?->toDateString();
        $fim = $viagem->data_fim?->toDateString();

        $ags = Agendamento::with(['servico:id,nome', 'estabelecimento:id,nome,cidade'])
            ->where('usuario_id', $user->id)
            ->whereBetween('data_agendamento', [$inicio, $fim])
            ->whereNotIn('status', self::STATUS_RESERVA_CANCELADA)
            ->whereNotIn('id', $agJa ?: [0])->get()
            ->filter(fn ($a) => $cidade === '' || Str::of((string) $a->estabelecimento?->cidade)->ascii()->lower()->value() === $cidade)
            ->map(fn ($a) => [
                'tipo' => 'agendamento', 'id' => $a->id, 'titulo' => $a->servico?->nome ?? 'Serviço',
                'local' => $a->estabelecimento?->nome, 'quando' => trim("{$a->data_agendamento} {$a->hora_agendamento}"),
                'valor' => (float) $a->valor_final, 'status' => $a->status,
            ]);

        $als = Aluguel::with('item:id,nome,cidade')
            ->where('locatario_id', $user->id)
            ->where('data_inicio', '<=', $fim)->where('data_fim', '>=', $inicio)
            ->whereNotIn('status', self::STATUS_RESERVA_CANCELADA)
            ->whereNotIn('id', $alJa ?: [0])->get()
            ->filter(fn ($a) => $cidade === '' || Str::of((string) $a->item?->cidade)->ascii()->lower()->value() === $cidade)
            ->map(fn ($a) => [
                'tipo' => 'aluguel', 'id' => $a->id, 'titulo' => $a->item?->nome ?? 'Locação',
                'local' => $a->item?->cidade, 'quando' => "{$a->data_inicio} → {$a->data_fim}",
                'valor' => (float) $a->valor_total, 'status' => $a->status,
            ]);

        return $ags->concat($als)->values()->all();
    }

    /** Coloca uma reserva do próprio usuário na agenda do grupo (vincula ao item igual do roteiro ou cria um novo). */
    public function compartilharReserva(Viagem $viagem, User $user, string $tipo, int $id): ViagemItem
    {
        if ($tipo === 'agendamento') {
            $r = Agendamento::with('servico:id,nome', 'estabelecimento:id,nome,cidade,rua,numero,bairro,latitude,longitude')->where('usuario_id', $user->id)->find($id);
            $catalogo = ['servico_id' => $r?->servico_id];
            $dia = $r?->data_agendamento;
            $hora = $r?->hora_agendamento;
            $titulo = $r?->servico?->nome ?? 'Serviço';
            $valor = (float) $r?->valor_final;
            $tipoItem = 'servico';
            $extra = $r ? ['estabelecimento_id' => $r->estabelecimento_id, 'latitude' => $r->estabelecimento?->latitude, 'longitude' => $r->estabelecimento?->longitude,
                'endereco' => collect([$r->estabelecimento?->rua, $r->estabelecimento?->numero, $r->estabelecimento?->bairro])->filter()->implode(', ') ?: null] : [];
            $coluna = 'agendamento_id';
        } else {
            $r = Aluguel::with('item')->where('locatario_id', $user->id)->find($id);
            $catalogo = ['item_aluguel_id' => $r?->item_aluguel_id];
            $dia = $r?->data_inicio;
            $hora = null;
            $titulo = $r?->item?->nome ?? 'Locação';
            $valor = (float) $r?->valor_total;
            $cat = $r?->item?->categoria;
            $tipoItem = in_array($cat, RoteiroInteligenteService::HOSPEDAGEM, true) ? 'hospedagem' : (in_array($cat, RoteiroInteligenteService::VEICULOS, true) ? 'transporte' : 'atracao');
            $extra = $r ? ['latitude' => $r->item?->latitude, 'longitude' => $r->item?->longitude, 'endereco' => $r->item?->enderecoCompleto] : [];
            $coluna = 'aluguel_id';
        }

        if (!$r) {
            throw new InvalidArgumentException('Reserva não encontrada.');
        }
        if (in_array($r->status, self::STATUS_RESERVA_CANCELADA, true)) {
            throw new InvalidArgumentException('Essa reserva foi cancelada e não pode ser compartilhada.');
        }

        return DB::transaction(function () use ($viagem, $user, $r, $catalogo, $coluna, $dia, $hora, $titulo, $valor, $tipoItem, $extra) {
            $item = ViagemItem::where('viagem_id', $viagem->id)->whereNull('agendamento_id')->whereNull('aluguel_id')
                ->where('status', 'sugerido')
                ->when(current($catalogo), fn ($q, $v) => $q->where(key($catalogo), $v), fn ($q) => $q->whereRaw('1 = 0'))
                ->orderBy('dia')->first();

            if (!$item) {
                $item = ViagemItem::create([
                    'viagem_id' => $viagem->id, 'dia' => $dia, 'ordem' => 99, 'hora_inicio' => $hora,
                    'tipo' => $tipoItem, 'titulo' => $titulo, 'custo_estimado' => $valor,
                    'criado_por_id' => $user->id, 'origem' => 'manual',
                ] + $catalogo + $extra);
            }

            $item->update([$coluna => $r->id, 'status' => 'reservado', 'reservado_por_id' => $user->id, 'custo_estimado' => $valor ?: $item->custo_estimado]);
            $this->avisarGrupo($viagem, "{$user->name} compartilhou a reserva de \"{$item->titulo}\" com o grupo.");

            return $item;
        });
    }

    // ------------------------------------------------------------- chat

    public function avisarGrupo(Viagem $viagem, string $texto): ViagemMensagem
    {
        return $this->publicar(ViagemMensagem::create(['viagem_id' => $viagem->id, 'tipo' => 'sistema', 'conteudo' => $texto]));
    }

    public function enviarMensagem(Viagem $viagem, User $user, string $texto): ViagemMensagem
    {
        return $this->publicar(ViagemMensagem::create([
            'viagem_id' => $viagem->id, 'usuario_id' => $user->id, 'tipo' => 'texto', 'conteudo' => trim($texto),
        ]));
    }

    /** O chat funciona mesmo sem o servidor de websockets: a tela também consulta a cada poucos segundos. */
    private function publicar(ViagemMensagem $m): ViagemMensagem
    {
        try {
            broadcast(new ViagemMensagemEnviada($m->load('autor:id,name')))->toOthers();
        } catch (\Throwable $e) {
            Log::debug('Viagem: broadcast indisponível, chat segue por consulta. ' . $e->getMessage());
        }

        return $m;
    }
}
