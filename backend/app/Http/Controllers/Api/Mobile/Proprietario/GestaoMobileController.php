<?php

namespace App\Http\Controllers\Api\Mobile\Proprietario;

use App\Http\Controllers\Controller;
use App\Models\Agendamento;
use App\Models\Avaliacao;
use App\Models\Estorno;
use App\Models\ExtratoProvider;
use App\Models\Provider;
use App\Services\Agendamento\VagasServicoService;
use App\Services\EstornoService;
use App\Services\PrecificacaoService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Telas de gestão do sócio/gerente no app (financeiro, estornos, avaliações e
 * clientes) — equivalentes mobile das páginas web que o proprietário já tem.
 * Sempre restringe ao que pertence aos estabelecimentos vinculados ao usuário.
 */
class GestaoMobileController extends Controller
{
    private const PAPEIS_GESTAO = ['admin', 'socio', 'proprietario', 'gerente'];

    public function __construct(private EstornoService $estornoService)
    {
    }

    private function estabelecimentosIds(Request $request)
    {
        return DB::table('estabelecimento_usuario')
            ->where('usuario_id', $request->user()->id)
            ->pluck('estabelecimento_id');
    }

    private function bloquearSeNaoForGestor(Request $request)
    {
        if (!in_array($request->user()->papel, self::PAPEIS_GESTAO)) {
            return response()->json(['error' => 'Acesso restrito à gestão do estabelecimento.'], 403);
        }
        return null;
    }

    // ------------------------------------------------------------------
    // FINANCEIRO
    // ------------------------------------------------------------------
    public function financeiro(Request $request)
    {
        if ($bloqueio = $this->bloquearSeNaoForGestor($request)) return $bloqueio;

        $user = $request->user();
        $estIds = $this->estabelecimentosIds($request);

        $providerIds = DB::table('providers')
            ->join('estabelecimento_usuario', 'providers.user_id', '=', 'estabelecimento_usuario.usuario_id')
            ->whereIn('estabelecimento_usuario.estabelecimento_id', $estIds)
            ->pluck('providers.id')
            ->unique()
            ->values();

        $dias = in_array((int) $request->query('dias'), [7, 30, 90], true) ? (int) $request->query('dias') : 30;
        $base = ExtratoProvider::whereIn('provider_id', $providerIds)
            ->where('created_at', '>=', now()->subDays($dias)->startOfDay());

        $receita = (float) (clone $base)->where('tipo', 'credito')->sum('valor_bruto');
        $taxas = (float) (clone $base)->where('tipo', 'credito')->sum('taxa_plataforma');
        $estornado = abs((float) (clone $base)->where('tipo', 'estorno')->sum('valor_liquido'));
        $repassado = abs((float) (clone $base)->where('tipo', 'repasse')->sum('valor_liquido'));
        $transacoes = (clone $base)->where('tipo', 'credito')->count();

        $movimentacoes = (clone $base)->latest()->limit(40)->get()->map(fn ($m) => [
            'id' => $m->id,
            'tipo' => $m->tipo,
            'descricao' => $m->descricao,
            'valor_bruto' => (float) $m->valor_bruto,
            'taxa_plataforma' => (float) $m->taxa_plataforma,
            'valor_liquido' => (float) $m->valor_liquido,
            'status' => $m->status,
            'metodo_pagamento' => $m->metodo_pagamento,
            'data' => optional($m->created_at)->toIso8601String(),
            'data_liberacao' => optional($m->data_liberacao)->toIso8601String(),
        ]);

        $carteira = Provider::where('user_id', $user->id)->first();

        // Saldo real da carteira + o que cai na conta no próximo repasse semanal (segunda-feira).
        $painel = null;
        if ($carteira) {
            try {
                $painel = app(\App\Services\Carteira\CarteiraService::class)->painel($user, $carteira);
            } catch (\Throwable $e) {
                $painel = null;
            }
        }

        return response()->json([
            'dias' => $dias,
            'carteira' => $carteira ? [
                'configurada' => true,
                'saldo' => (float) $carteira->saldo,
                'disponivel' => (float) $carteira->valor_disponivel,
                'retido' => (float) $carteira->valor_retido,
                'em_analise' => (float) $carteira->valor_em_analise,
                'estornado' => (float) $carteira->valor_estornado,
                'proxima_liberacao' => $carteira->data_proxima_liberacao,
                'tem_chave_pix' => !empty($carteira->pix_key),
                'saldo_carteira' => $painel['saldo_asaas'] ?? null,
                'a_receber_semana' => (float) ($painel['a_repassar'] ?? $carteira->saldo),
                'proximo_repasse' => $painel['proximo_repasse'] ?? null,
                'proximo_repasse_rotulo' => $painel['proximo_repasse_rotulo'] ?? null,
                // A conta de recebimento só existe depois de enviar os dados; até lá a carteira é só explicação.
                'conta_recebimento_ativa' => (bool) ($painel['tem_conta_asaas'] ?? false),
                'estornos_em_analise' => (int) ($painel['resumo']['estornos_em_analise'] ?? 0),
                'estornado_total' => (float) ($painel['resumo']['estornado_total'] ?? 0),
                'estornos_lista' => $painel['estornos'] ?? [],
            ] : ['configurada' => false, 'conta_recebimento_ativa' => false],
            'resumo' => [
                'receita_bruta' => $receita,
                'taxas_plataforma' => $taxas,
                'estornos' => $estornado,
                'repasses' => $repassado,
                'liquido' => $receita - $taxas - $estornado,
                'transacoes' => $transacoes,
                'ticket_medio' => $transacoes > 0 ? round($receita / $transacoes, 2) : 0,
            ],
            'movimentacoes' => $movimentacoes,
        ]);
    }

    // ------------------------------------------------------------------
    // ESTORNOS (visão do prestador)
    // ------------------------------------------------------------------
    public function estornos(Request $request)
    {
        if ($bloqueio = $this->bloquearSeNaoForGestor($request)) return $bloqueio;

        $lista = Estorno::with(['cliente:id,name'])
            ->where('prestador_id', $request->user()->id)
            ->latest()
            ->limit(60)
            ->get()
            ->map(fn ($e) => [
                'id' => $e->id,
                'codigo' => $e->codigo_estorno,
                'status' => $e->status,
                'categoria' => $e->categoria,
                'cliente' => $e->cliente?->name,
                'valor_pago' => (float) $e->valor_pago,
                'valor_estornado' => (float) $e->valor_estornado,
                'motivo' => $e->motivo,
                'descricao_cliente' => $e->descricao_cliente,
                'prazo_resposta' => optional($e->prazo_resposta)->toIso8601String(),
                'prestador_respondeu' => (bool) $e->prestador_respondeu,
                'pode_contestar' => !$e->prestador_respondeu
                    && in_array($e->status, ['PENDENTE', 'EM_ANALISE'], true)
                    && $e->prazo_resposta && now()->lessThan($e->prazo_resposta),
                'data' => optional($e->data_solicitacao)->toIso8601String(),
            ]);

        return response()->json([
            'resumo' => [
                'total' => $lista->count(),
                'pendentes' => $lista->whereIn('status', ['PENDENTE', 'EM_ANALISE'])->count(),
                'valor_estornado' => (float) $lista->where('status', 'ESTORNADO')->sum('valor_estornado'),
            ],
            'estornos' => $lista->values(),
        ]);
    }

    public function contestarEstorno(Request $request, $id)
    {
        if ($bloqueio = $this->bloquearSeNaoForGestor($request)) return $bloqueio;

        $request->validate([
            'descricao' => 'required|string|min:10|max:2000',
            'fotos' => 'nullable|array|max:4',
            'fotos.*' => 'image|mimes:jpg,jpeg,png,webp|max:3072',
        ], [
            'fotos.*.max' => 'Cada foto deve ter até 3MB.',
        ]);
        $estorno = Estorno::findOrFail($id);

        try {
            $this->estornoService->contestarEstorno($request->user(), $estorno, $request->only('descricao'), $request->file('fotos', []));
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 400);
        }

        return response()->json(['message' => 'Contestação enviada e em análise pela administração.']);
    }

    // ------------------------------------------------------------------
    // AVALIAÇÕES
    // ------------------------------------------------------------------
    public function avaliacoes(Request $request)
    {
        if ($bloqueio = $this->bloquearSeNaoForGestor($request)) return $bloqueio;

        $base = Avaliacao::whereIn('estabelecimento_id', $this->estabelecimentosIds($request))
            ->whereNull('justificativa_admin');

        $estrelas = [];
        foreach ([5, 4, 3, 2, 1] as $n) {
            $estrelas[(string) $n] = (clone $base)->where('nota', $n)->count();
        }

        $lista = (clone $base)
            ->with(['usuario:id,name,foto_perfil', 'estabelecimento:id,nome'])
            ->latest()
            ->limit(60)
            ->get()
            ->map(fn ($a) => [
                'id' => $a->id,
                'nota' => (int) $a->nota,
                'comentario' => $a->comentario,
                'autor' => $a->usuario?->name,
                'foto_autor' => $a->usuario?->foto_perfil,
                'local' => $a->estabelecimento?->nome,
                'resposta' => $a->resposta_anfitriao,
                'data_resposta' => optional($a->data_resposta)->toIso8601String(),
                'data' => optional($a->created_at)->toIso8601String(),
            ]);

        return response()->json([
            'resumo' => [
                'total' => (clone $base)->count(),
                'media' => round((float) (clone $base)->avg('nota'), 1),
                'sem_resposta' => (clone $base)->whereNull('resposta_anfitriao')->count(),
                'estrelas' => $estrelas,
            ],
            'avaliacoes' => $lista,
        ]);
    }

    public function responderAvaliacao(Request $request, $id)
    {
        if ($bloqueio = $this->bloquearSeNaoForGestor($request)) return $bloqueio;

        $request->validate(['resposta' => 'required|string|max:1500']);
        $avaliacao = Avaliacao::findOrFail($id);

        if (!$this->estabelecimentosIds($request)->contains($avaliacao->estabelecimento_id)
            && $request->user()->papel !== 'admin') {
            return response()->json(['error' => 'Você não pode responder por este estabelecimento.'], 403);
        }

        $avaliacao->update([
            'resposta_anfitriao' => strip_tags($request->resposta),
            'data_resposta' => now(),
        ]);

        return response()->json(['message' => 'Resposta publicada.']);
    }

    // ------------------------------------------------------------------
    // CLIENTES
    // ------------------------------------------------------------------
    public function clientes(Request $request)
    {
        if ($bloqueio = $this->bloquearSeNaoForGestor($request)) return $bloqueio;

        $busca = trim((string) $request->query('busca', ''));

        $clientes = DB::table('agendamentos')
            ->join('users', 'agendamentos.usuario_id', '=', 'users.id')
            ->whereIn('agendamentos.estabelecimento_id', $this->estabelecimentosIds($request))
            ->when($busca !== '', fn ($q) => $q->where('users.name', 'ilike', "%{$busca}%"))
            ->groupBy('users.id', 'users.name', 'users.email', 'users.foto_perfil', 'users.telefone')
            ->select(
                'users.id',
                'users.name as nome',
                'users.email',
                'users.foto_perfil',
                'users.telefone',
                DB::raw('COUNT(agendamentos.id) as total_visitas'),
                DB::raw('COALESCE(SUM(agendamentos.valor_final), 0) as total_gasto'),
                DB::raw('MAX(agendamentos.data_agendamento) as ultima_visita')
            )
            ->orderByDesc('total_visitas')
            ->limit(80)
            ->get()
            ->map(fn ($c) => [
                'id' => $c->id,
                'nome' => $c->nome,
                'email' => $c->email,
                'telefone' => $c->telefone,
                'foto_perfil' => $c->foto_perfil,
                'total_visitas' => (int) $c->total_visitas,
                'total_gasto' => (float) $c->total_gasto,
                'ultima_visita' => $c->ultima_visita,
            ]);

        return response()->json(['clientes' => $clientes]);
    }

    // ------------------------------------------------------------------
    // RESERVA MANUAL — o dono/gerente cria a reserva de um serviço para um cliente
    // (mesma regra de AgendamentoController::remarcarServico no web).
    // ------------------------------------------------------------------
    public function reservaManual(Request $request, VagasServicoService $vagasServico, PrecificacaoService $precificacao)
    {
        if ($bloqueio = $this->bloquearSeNaoForGestor($request)) return $bloqueio;

        $validated = $request->validate([
            'cliente_id' => 'required|exists:users,id',
            'estabelecimento_id' => 'required|exists:estabelecimentos,id',
            'servico_id' => 'required|exists:servicos,id',
            'data' => 'required|date|after_or_equal:today',
            'hora' => 'required|date_format:H:i',
            'pessoas' => 'nullable|integer|min:1',
            // Reserva feita pelo sócio em nome do cliente é SEMPRE presencial: qualquer outra forma é recusada.
            'forma_pagamento' => 'nullable|in:presencial',
            'metodo_pagamento' => 'nullable|in:presencial,local',
        ], [
            'forma_pagamento.in' => 'Reservas feitas pelo sócio aceitam apenas pagamento presencial.',
            'metodo_pagamento.in' => 'Reservas feitas pelo sócio aceitam apenas pagamento presencial.',
        ]);

        $estabelecimento = $request->user()->estabelecimentosGerenciados()
            ->where('estabelecimentos.id', $validated['estabelecimento_id'])->first();
        if (!$estabelecimento) {
            return response()->json(['error' => 'Você não gerencia este estabelecimento.'], 403);
        }

        $servico = $estabelecimento->servicos()->find($validated['servico_id']);
        if (!$servico) {
            return response()->json(['error' => 'Serviço não encontrado neste estabelecimento.'], 404);
        }

        if (Carbon::parse($validated['data'] . ' ' . $validated['hora'])->isPast()) {
            return response()->json(['error' => 'Não é possível agendar em um horário que já passou.'], 422);
        }

        try {
            $vagasServico->verificar($servico, $validated['data'], $validated['hora']);
            $calculo = $precificacao->servico($servico, (int) ($validated['pessoas'] ?? 1));
        } catch (ValidationException $e) {
            return response()->json(['error' => collect($e->errors())->flatten()->first(), 'esgotado' => true], 409);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        $agendamento = Agendamento::create([
            'usuario_id' => $validated['cliente_id'],
            'estabelecimento_id' => $estabelecimento->id,
            'servico_id' => $servico->id,
            'data_agendamento' => $validated['data'],
            'hora_agendamento' => $validated['hora'],
            'quantidade_pessoas' => $calculo['pessoas'],
            'valor_final' => $calculo['subtotal'],
            'status' => 'pendente',
            'status_pagamento' => 'presencial',
            'codigo_verificacao' => str_pad((string) mt_rand(1, 9999), 4, '0', STR_PAD_LEFT),
        ]);

        return response()->json([
            'message' => 'Reserva criada com sucesso!',
            'agendamento_id' => $agendamento->id,
            'valor_final' => (float) $calculo['subtotal'],
            'pessoas' => $calculo['pessoas'],
        ], 201);
    }

    // ------------------------------------------------------------------
    // VITRINE — o local do jeito que o cliente vê
    // ------------------------------------------------------------------
    public function vitrine(Request $request, \App\Services\VitrineService $vitrine)
    {
        if ($bloqueio = $this->bloquearSeNaoForGestor($request)) return $bloqueio;

        $dados = $vitrine->montar($request->user(), $request->filled('estabelecimento_id') ? (int) $request->query('estabelecimento_id') : null);

        return response()->json(['vitrine' => $dados]);
    }
}
