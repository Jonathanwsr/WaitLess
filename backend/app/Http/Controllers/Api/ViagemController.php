<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Estabelecimento;
use App\Models\User;
use App\Models\Viagem;
use App\Models\ViagemItem;
use App\Models\ViagemPagamento;
use App\Services\Viagem\DivisaoGastosService;
use App\Services\Viagem\RoteiroInteligenteService;
use App\Services\Viagem\ViagemService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;
use InvalidArgumentException;

/**
 * Roteiro inteligente (premium) + agenda compartilhada do grupo: itens do roteiro,
 * presença, reservas, gastos divididos e chat. Qualquer participante usa o grupo;
 * criar viagem com roteiro inteligente exige plano premium.
 */
class ViagemController extends Controller
{
    private const MSG_PREMIUM = 'O roteiro inteligente é exclusivo para assinantes Premium. Assine um plano para montar viagens completas.';

    public function __construct(
        private RoteiroInteligenteService $roteiro,
        private ViagemService $viagens,
        private DivisaoGastosService $gastos,
    ) {}

    // ------------------------------------------------------------- páginas

    public function index(Request $request)
    {
        $user = $request->user();

        return Inertia::render('Cliente/Viagens/Index', [
            'viagens' => $this->resumoViagens($user),
            'premium' => $user->isPremium(),
        ]);
    }

    /** Lista para o app mobile (mesmos dados da tela web). */
    public function lista(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json(['viagens' => $this->resumoViagens($user), 'premium' => $user->isPremium()]);
    }

    /** Dados do convite (link/código) sem entrar no grupo — o app mostra e pede confirmação. */
    public function conviteInfo(Request $request, string $codigo): JsonResponse
    {
        $v = Viagem::where('codigo_convite', strtoupper(trim($codigo)))->first();
        if (!$v) {
            return response()->json(['erro' => 'Código de convite não encontrado. Confira com quem te convidou.'], 404);
        }

        return response()->json([
            'viagem_id' => $v->id, 'titulo' => $v->titulo, 'destino' => $v->destino,
            'data_inicio' => $v->data_inicio?->toDateString(), 'data_fim' => $v->data_fim?->toDateString(),
            'criador' => $v->criador?->name, 'membros' => $v->membros()->count(),
            'ja_participa' => $v->temMembro($request->user()->id), 'codigo' => $v->codigo_convite,
        ]);
    }

    private function resumoViagens(User $user)
    {
        return Viagem::query()
            ->where(fn ($q) => $q->where('criador_id', $user->id)
                ->orWhereHas('membros', fn ($m) => $m->where('usuario_id', $user->id)->where('presenca', '!=', 'recusado')))
            ->withCount('itens')
            ->with('membros:id,name')
            ->orderBy('data_inicio')
            ->get()
            ->map(fn (Viagem $v) => [
                'id' => $v->id, 'titulo' => $v->titulo, 'destino' => $v->destino,
                'data_inicio' => $v->data_inicio?->toDateString(), 'data_fim' => $v->data_fim?->toDateString(),
                'pessoas' => $v->quantidade_pessoas, 'status' => $v->status, 'itens' => $v->itens_count,
                'membros' => $v->membros->pluck('name')->values(),
                'sou_criador' => $v->criador_id === $user->id,
                'minha_presenca' => optional($v->membros->firstWhere('id', $user->id))->pivot?->presenca,
            ])->values();
    }

    public function nova(Request $request)
    {
        return Inertia::render('Cliente/Viagens/Nova', [
            'premium' => $request->user()->isPremium(),
            'cidadeInicial' => (string) $request->query('cidade', ''),
        ]);
    }

    public function show(Request $request, int $viagem)
    {
        $v = $this->carregar($request, $viagem);

        return Inertia::render('Cliente/Viagens/Show', ['painelInicial' => $this->viagens->painel($v, $request->user())]);
    }

    public function painel(Request $request, int $viagem): JsonResponse
    {
        return response()->json($this->viagens->painel($this->carregar($request, $viagem), $request->user()));
    }

    // ------------------------------------------------------------- roteiro

    public function previa(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user->isPremium()) {
            return response()->json(['erro' => self::MSG_PREMIUM, 'premium_necessario' => true], 403);
        }

        $dados = $this->validarPedido($request);
        $dados = $this->resolverDestino($dados);
        if (empty($dados['cidade'])) {
            return response()->json(['erro' => 'Informe a cidade de destino ou permita usar sua localização.'], 422);
        }

        return response()->json($this->roteiro->gerar($dados));
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user->isPremium()) {
            return response()->json(['erro' => self::MSG_PREMIUM, 'premium_necessario' => true], 403);
        }

        $dados = $this->resolverDestino($this->validarPedido($request) + ['titulo' => Str::limit((string) $request->input('titulo'), 200, '')]);
        if (empty($dados['cidade'])) {
            return response()->json(['erro' => 'Informe a cidade de destino.'], 422);
        }

        $itens = $request->input('itens');
        if (!is_array($itens)) {
            $itens = $this->roteiro->gerar($dados)['itens'];
        }

        $viagem = $this->viagens->criar($user, $dados, $itens);

        return response()->json(['mensagem' => 'Viagem criada!', 'viagem_id' => $viagem->id, 'url' => route('viagens.show', $viagem->id)], 201);
    }

    /** Refaz os itens automáticos ainda não reservados, mantendo o que o grupo já reservou ou adicionou. */
    public function regenerar(Request $request, int $viagem): JsonResponse
    {
        $v = $this->carregar($request, $viagem, editar: true);
        if (!$request->user()->isPremium()) {
            return response()->json(['erro' => self::MSG_PREMIUM, 'premium_necessario' => true], 403);
        }

        $novo = $this->roteiro->gerar($this->resolverDestino([
            'cidade' => $v->cidade ?: $v->destino, 'estado' => $v->estado,
            'data_inicio' => $v->data_inicio->toDateString(), 'data_fim' => $v->data_fim->toDateString(),
            'orcamento' => $v->orcamento_limite !== null ? (float) $v->orcamento_limite : null,
            'pessoas' => $v->quantidade_pessoas, 'preferencias' => $v->preferencias ?? [],
        ]));

        DB::transaction(function () use ($v, $novo, $request) {
            $v->itens()->where('origem', 'auto')->where('status', 'sugerido')->whereNull('agendamento_id')->whereNull('aluguel_id')->delete();
            // Não recria hospedagem/veículo/serviço que o grupo já reservou.
            $reservados = $v->itens()->get(['servico_id', 'item_aluguel_id']);
            $itens = collect($novo['itens'])->reject(fn ($i) => $reservados->contains(fn ($r) => ($i['servico_id'] && $r->servico_id === $i['servico_id']) || ($i['item_aluguel_id'] && $r->item_aluguel_id === $i['item_aluguel_id'])))->all();
            $this->viagens->salvarItens($v, $itens, $request->user()->id);
            $this->viagens->avisarGrupo($v, "{$request->user()->name} atualizou o roteiro inteligente.");
        });

        return response()->json(['mensagem' => 'Roteiro atualizado.', 'avisos' => $novo['avisos']]);
    }

    // ------------------------------------------------------------- viagem

    public function update(Request $request, int $viagem): JsonResponse
    {
        $v = $this->carregar($request, $viagem, editar: true);
        $dados = $request->validate([
            'titulo' => 'sometimes|string|max:255',
            'orcamento_limite' => 'sometimes|nullable|numeric|min:0',
            'status' => 'sometimes|in:planejando,confirmada,concluida,cancelada',
        ]);
        $v->update($dados);

        return response()->json(['mensagem' => 'Viagem atualizada.']);
    }

    public function destroy(Request $request, int $viagem): JsonResponse
    {
        $v = $this->carregar($request, $viagem);
        abort_unless($v->criador_id === $request->user()->id, 403, 'Só quem criou a viagem pode excluí-la.');
        $v->delete();

        return response()->json(['mensagem' => 'Viagem excluída.']);
    }

    // ------------------------------------------------------------- membros e presença

    public function convidar(Request $request, int $viagem): JsonResponse
    {
        $v = $this->carregar($request, $viagem, editar: true);
        $email = $request->validate(['email' => 'required|email'])['email'];

        $convidado = User::where('email', $email)->first();
        if (!$convidado) {
            return response()->json(['erro' => 'Essa pessoa ainda não tem conta no Lokyva. Envie o link de convite do grupo para ela se cadastrar e entrar.'], 422);
        }
        if ($v->membros()->where('usuario_id', $convidado->id)->exists()) {
            return response()->json(['erro' => 'Essa pessoa já participa da viagem.'], 422);
        }

        $v->membros()->attach($convidado->id, ['funcao' => 'editor', 'presenca' => 'pendente']);
        $this->viagens->avisarGrupo($v, "{$request->user()->name} convidou {$convidado->name} para a viagem.");

        return response()->json(['mensagem' => "{$convidado->name} foi convidado(a)."]);
    }

    public function entrarPorCodigo(Request $request, string $codigo)
    {
        $v = Viagem::where('codigo_convite', strtoupper($codigo))->firstOrFail();

        return Inertia::render('Cliente/Viagens/Convite', [
            'viagem' => ['titulo' => $v->titulo, 'destino' => $v->destino, 'data_inicio' => $v->data_inicio?->toDateString(),
                'data_fim' => $v->data_fim?->toDateString(), 'criador' => $v->criador?->name, 'membros' => $v->membros()->count()],
            'codigo' => strtoupper($codigo),
            'jaParticipa' => $v->temMembro($request->user()->id),
            'viagemId' => $v->id,
        ]);
    }

    public function confirmarEntrada(Request $request, string $codigo): JsonResponse
    {
        $v = Viagem::where('codigo_convite', strtoupper($codigo))->firstOrFail();
        $user = $request->user();

        if (!$v->membros()->where('usuario_id', $user->id)->exists()) {
            $v->membros()->attach($user->id, ['funcao' => 'membro', 'presenca' => 'confirmado']);
            $this->viagens->avisarGrupo($v, "{$user->name} entrou no grupo pelo link de convite.");
        } elseif ($v->membros()->where('usuario_id', $user->id)->value('presenca') === 'recusado') {
            $v->membros()->updateExistingPivot($user->id, ['presenca' => 'confirmado']);
        }

        return response()->json(['url' => route('viagens.show', $v->id)]);
    }

    public function presencaViagem(Request $request, int $viagem): JsonResponse
    {
        $v = Viagem::findOrFail($viagem);
        $user = $request->user();
        $status = $request->validate(['status' => 'required|in:confirmado,recusado'])['status'];

        abort_unless($v->membros()->where('usuario_id', $user->id)->exists(), 403, 'Você não faz parte dessa viagem.');
        abort_if($v->criador_id === $user->id && $status === 'recusado', 422, 'Quem criou a viagem não pode recusá-la — exclua a viagem se desistiu.');

        $v->membros()->updateExistingPivot($user->id, ['presenca' => $status]);
        $this->viagens->avisarGrupo($v, $status === 'confirmado' ? "{$user->name} confirmou presença na viagem." : "{$user->name} não vai poder ir.");

        return response()->json(['mensagem' => $status === 'confirmado' ? 'Presença confirmada!' : 'Você saiu do grupo dessa viagem.']);
    }

    public function removerMembro(Request $request, int $viagem, int $usuario): JsonResponse
    {
        $v = $this->carregar($request, $viagem);
        abort_unless($v->criador_id === $request->user()->id, 403, 'Só quem criou a viagem pode remover participantes.');
        abort_if($usuario === $v->criador_id, 422, 'O criador não pode ser removido.');

        $temConta = $v->despesas()->where('pagador_id', $usuario)->exists()
            || DB::table('viagem_despesa_partes')->join('viagem_despesas', 'viagem_despesas.id', '=', 'viagem_despesa_partes.viagem_despesa_id')
                ->where('viagem_despesas.viagem_id', $v->id)->where('viagem_despesa_partes.usuario_id', $usuario)->exists();
        if ($temConta) {
            return response()->json(['erro' => 'Essa pessoa já tem gastos divididos na viagem. Acerte as contas antes de removê-la.'], 422);
        }

        $v->membros()->detach($usuario);

        return response()->json(['mensagem' => 'Participante removido.']);
    }

    public function presencaItem(Request $request, int $viagem, int $item): JsonResponse
    {
        $v = $this->carregar($request, $viagem);
        $i = ViagemItem::where('viagem_id', $v->id)->findOrFail($item);
        $status = $request->validate(['status' => 'required|in:confirmado,talvez,recusado'])['status'];

        $i->presencas()->updateOrCreate(['usuario_id' => $request->user()->id], ['status' => $status]);

        return response()->json(['mensagem' => 'Presença registrada.']);
    }

    // ------------------------------------------------------------- itens da agenda

    public function itemStore(Request $request, int $viagem): JsonResponse
    {
        $v = $this->carregar($request, $viagem, editar: true);
        $dados = $this->validarItem($request, $v);
        $this->viagens->salvarItens($v, [$dados + ['origem' => 'manual', 'ordem' => 50]], $request->user()->id);

        return response()->json(['mensagem' => 'Item adicionado à agenda.'], 201);
    }

    public function itemUpdate(Request $request, int $viagem, int $item): JsonResponse
    {
        $v = $this->carregar($request, $viagem, editar: true);
        $i = ViagemItem::where('viagem_id', $v->id)->findOrFail($item);
        $i->update($this->validarItem($request, $v, parcial: true));

        return response()->json(['mensagem' => 'Item atualizado.']);
    }

    public function itemDestroy(Request $request, int $viagem, int $item): JsonResponse
    {
        $v = $this->carregar($request, $viagem, editar: true);
        ViagemItem::where('viagem_id', $v->id)->findOrFail($item)->delete();

        return response()->json(['mensagem' => 'Item removido.']);
    }

    public function compartilharReserva(Request $request, int $viagem): JsonResponse
    {
        $v = $this->carregar($request, $viagem);
        $dados = $request->validate(['tipo' => 'required|in:agendamento,aluguel', 'id' => 'required|integer']);

        try {
            $item = $this->viagens->compartilharReserva($v, $request->user(), $dados['tipo'], (int) $dados['id']);
        } catch (InvalidArgumentException $e) {
            return response()->json(['erro' => $e->getMessage()], 422);
        }

        return response()->json(['mensagem' => 'Reserva compartilhada com o grupo.', 'item_id' => $item->id]);
    }

    // ------------------------------------------------------------- gastos

    public function despesaStore(Request $request, int $viagem): JsonResponse
    {
        $v = $this->carregar($request, $viagem);
        $dados = $request->validate([
            'descricao' => 'required|string|max:255',
            'valor' => 'required|numeric|min:0.01|max:10000000',
            'pagador_id' => 'nullable|integer',
            'data_despesa' => 'nullable|date',
            'categoria' => 'nullable|string|max:20',
            'viagem_item_id' => 'nullable|integer',
            'participantes' => 'nullable|array',
            'participantes.*' => 'integer',
            'partes' => 'nullable|array',
        ], [], ['descricao' => 'descrição', 'valor' => 'valor']);

        if (!empty($dados['viagem_item_id']) && !ViagemItem::where('viagem_id', $v->id)->where('id', $dados['viagem_item_id'])->exists()) {
            return response()->json(['erro' => 'Item da agenda não encontrado.'], 422);
        }

        try {
            $d = $this->gastos->registrar($v, $request->user(), $dados + ['pagador_id' => $dados['pagador_id'] ?? $request->user()->id]);
        } catch (InvalidArgumentException $e) {
            return response()->json(['erro' => $e->getMessage()], 422);
        }

        $this->viagens->avisarGrupo($v, "{$request->user()->name} lançou um gasto: {$d->descricao} (R$ " . number_format($d->valor, 2, ',', '.') . ').');

        return response()->json(['mensagem' => 'Gasto lançado e dividido.', 'id' => $d->id], 201);
    }

    public function despesaDestroy(Request $request, int $viagem, int $despesa): JsonResponse
    {
        $v = $this->carregar($request, $viagem);
        $d = $v->despesas()->findOrFail($despesa);
        abort_unless($d->criado_por_id === $request->user()->id || $v->criador_id === $request->user()->id, 403, 'Só quem lançou o gasto ou o criador da viagem pode apagá-lo.');
        $d->delete();

        return response()->json(['mensagem' => 'Gasto removido.']);
    }

    public function pagamentoStore(Request $request, int $viagem): JsonResponse
    {
        $v = $this->carregar($request, $viagem);
        $dados = $request->validate([
            'de_id' => 'required|integer', 'para_id' => 'required|integer|different:de_id',
            'valor' => 'required|numeric|min:0.01', 'observacao' => 'nullable|string|max:255',
        ]);

        $participantes = $this->gastos->participantes($v);
        if (!in_array((int) $dados['de_id'], $participantes, true) || !in_array((int) $dados['para_id'], $participantes, true)) {
            return response()->json(['erro' => 'O acerto precisa ser entre participantes da viagem.'], 422);
        }
        // Só quem paga ou quem recebe registra o acerto.
        $eu = $request->user()->id;
        if ($eu !== (int) $dados['de_id'] && $eu !== (int) $dados['para_id'] && $v->criador_id !== $eu) {
            return response()->json(['erro' => 'Só quem pagou, quem recebeu ou o criador da viagem pode registrar o acerto.'], 403);
        }

        ViagemPagamento::create($dados + ['viagem_id' => $v->id, 'criado_por_id' => $eu]);
        $this->viagens->avisarGrupo($v, 'Um acerto de R$ ' . number_format((float) $dados['valor'], 2, ',', '.') . ' foi registrado.');

        return response()->json(['mensagem' => 'Acerto registrado.'], 201);
    }

    // ------------------------------------------------------------- chat

    public function mensagens(Request $request, int $viagem): JsonResponse
    {
        $v = $this->carregar($request, $viagem);
        $apos = (int) $request->query('apos', 0);

        return response()->json($v->mensagens()->with('autor:id,name')->where('id', '>', $apos)->orderBy('id')->limit(100)->get()->map->paraTela()->values());
    }

    public function mensagemStore(Request $request, int $viagem): JsonResponse
    {
        $v = $this->carregar($request, $viagem);
        $texto = $request->validate(['conteudo' => 'required|string|max:2000'], ['conteudo.required' => 'Escreva uma mensagem.'])['conteudo'];

        return response()->json($this->viagens->enviarMensagem($v, $request->user(), $texto)->load('autor:id,name')->paraTela(), 201);
    }

    // ------------------------------------------------------------- utilidades

    /** Viagem que o usuário participa; com $editar exige permissão de edição. */
    private function carregar(Request $request, int $id, bool $editar = false): Viagem
    {
        $v = Viagem::findOrFail($id);
        $uid = $request->user()->id;

        abort_unless($v->temMembro($uid), 403, 'Você não faz parte dessa viagem.');
        abort_if($editar && !$v->podeEditar($uid), 403, 'Só quem criou ou edita a viagem pode fazer isso.');

        return $v;
    }

    private function validarPedido(Request $request): array
    {
        $d = $request->validate([
            'cidade' => 'nullable|string|max:120',
            'estado' => 'nullable|string|size:2',
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
            'data_inicio' => 'required|date|after_or_equal:today',
            'data_fim' => 'required|date|after_or_equal:data_inicio',
            'orcamento' => 'nullable|numeric|min:0',
            'pessoas' => 'required|integer|min:1|max:50',
            'preferencias' => 'nullable|array',
            'preferencias.ritmo' => 'nullable|in:leve,moderado,intenso',
            'preferencias.precisa_hospedagem' => 'nullable|boolean',
            'preferencias.precisa_veiculo' => 'nullable|boolean',
            'preferencias.interesses' => 'nullable|array|max:10',
            'preferencias.interesses.*' => 'string|max:40',
        ], [
            'data_inicio.after_or_equal' => 'A data de início não pode ser no passado.',
            'data_fim.after_or_equal' => 'A data de volta precisa ser depois da ida.',
        ]);

        if (\Carbon\Carbon::parse($d['data_inicio'])->diffInDays($d['data_fim']) > 30) {
            abort(response()->json(['erro' => 'O roteiro inteligente cobre viagens de até 31 dias.'], 422));
        }

        return $d;
    }

    /** Sem cidade digitada, usa a do estabelecimento mais próximo das coordenadas (localização do usuário). */
    private function resolverDestino(array $d): array
    {
        if (!empty($d['cidade']) || empty($d['latitude']) || empty($d['longitude'])) {
            return $d;
        }

        $perto = Estabelecimento::whereNotNull('latitude')->whereNotNull('longitude')->get(['cidade', 'estado', 'latitude', 'longitude'])
            ->map(fn ($e) => ['e' => $e, 'km' => $this->roteiro->distanciaKm((float) $d['latitude'], (float) $d['longitude'], (float) $e->latitude, (float) $e->longitude)])
            ->filter(fn ($x) => $x['km'] !== null && $x['km'] <= 80)->sortBy('km')->first();

        if ($perto) {
            $d['cidade'] = $perto['e']->cidade;
            $d['estado'] = $d['estado'] ?? $perto['e']->estado;
        }

        return $d;
    }

    private function validarItem(Request $request, Viagem $v, bool $parcial = false): array
    {
        $r = $parcial ? 'sometimes|' : '';

        return $request->validate([
            'titulo' => $r . 'required|string|max:250',
            'tipo' => $r . 'required|in:hospedagem,transporte,servico,atracao,livre,personalizado',
            'dia' => 'nullable|date|after_or_equal:' . $v->data_inicio->toDateString() . '|before_or_equal:' . $v->data_fim->toDateString(),
            'hora_inicio' => 'nullable|date_format:H:i',
            'hora_fim' => 'nullable|date_format:H:i',
            'descricao' => 'nullable|string|max:2000',
            'endereco' => 'nullable|string|max:255',
            'custo_estimado' => 'nullable|numeric|min:0',
        ], [
            'dia.after_or_equal' => 'Escolha um dia dentro do período da viagem.',
            'dia.before_or_equal' => 'Escolha um dia dentro do período da viagem.',
        ]);
    }
}
