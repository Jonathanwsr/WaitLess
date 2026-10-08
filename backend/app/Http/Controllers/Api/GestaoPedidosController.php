<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agendamento;
use App\Models\Estabelecimento;
use App\Models\PedidoEntrega;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

/**
 * Painel de pedidos para sócio e gerente: todo pedido solicitado nos seus locais (produtos para
 * entrega e reservas), com a situação atual e quem está atendendo. Funcionário não vê este painel.
 */
class GestaoPedidosController extends Controller
{
    private const PAPEIS_GESTAO = ['admin', 'socio', 'proprietario', 'gerente'];

    private const STATUS_PRODUTO = [
        'pendente_pagamento' => 'Aguardando pagamento',
        'aguardando_confirmacao' => 'A entregar',
        'pago' => 'Pago · a entregar',
        'concluido' => 'Concluído',
        'cancelado' => 'Cancelado',
        'estornado' => 'Estornado',
    ];

    private const STATUS_RESERVA = [
        'pendente' => 'Pendente',
        'confirmado' => 'Confirmada',
        'finalizado' => 'Finalizada',
        'cancelado' => 'Cancelada',
    ];

    public function index(Request $request)
    {
        $user = $request->user();
        $estabelecimentosIds = $this->estabelecimentosDeGestao($user);
        abort_if($estabelecimentosIds->isEmpty(), 403, 'Este painel é para sócios e gerentes de um local.');

        $filtroLocal = $request->integer('estabelecimento_id') ?: null;
        if ($filtroLocal) {
            $estabelecimentosIds = $estabelecimentosIds->filter(fn ($id) => (int) $id === $filtroLocal)->values();
            abort_if($estabelecimentosIds->isEmpty(), 403, 'Este local não é seu.');
        }

        $pedidos = $this->produtos($estabelecimentosIds)
            ->concat($this->reservas($estabelecimentosIds))
            ->sortByDesc('criado_em')
            ->values();

        $dados = [
            'pedidos' => $pedidos,
            'estabelecimentos' => Estabelecimento::whereIn('id', $this->estabelecimentosDeGestao($user))->orderBy('nome')->get(['id', 'nome']),
            'filtroEstabelecimento' => $filtroLocal,
            'resumo' => [
                'em_aberto' => $pedidos->whereIn('status', ['pendente_pagamento', 'aguardando_confirmacao', 'pago', 'pendente', 'confirmado'])->count(),
                'concluidos' => $pedidos->whereIn('status', ['concluido', 'finalizado'])->count(),
                'cancelados' => $pedidos->whereIn('status', ['cancelado', 'estornado'])->count(),
            ],
            'statusProduto' => self::STATUS_PRODUTO,
            'statusReserva' => self::STATUS_RESERVA,
        ];

        if ($request->wantsJson()) {
            return response()->json($dados);
        }

        return Inertia::render('Gestao/Pedidos', $dados);
    }

    /** Locais em que o usuário gerencia (admin vê todos). */
    private function estabelecimentosDeGestao($user)
    {
        if (strtolower((string) $user->papel) === 'admin') {
            return Estabelecimento::pluck('id');
        }

        return DB::table('estabelecimento_usuario')
            ->where('usuario_id', $user->id)
            ->whereIn('tipo', self::PAPEIS_GESTAO)
            ->pluck('estabelecimento_id');
    }

    private function produtos($estabelecimentosIds)
    {
        return PedidoEntrega::with(['produto:id,nome', 'cliente:id,name', 'funcionario:id,nome', 'entregador:id,name', 'estabelecimento:id,nome'])
            ->whereIn('estabelecimento_id', $estabelecimentosIds)
            ->orderByDesc('created_at')
            ->limit(300)
            ->get()
            ->map(fn (PedidoEntrega $p) => [
                'tipo' => 'produto',
                'id' => $p->id,
                'codigo' => $p->codigo_pedido,
                'titulo' => $p->produto?->nome ?? 'Produto removido',
                'quantidade' => $p->quantidade,
                'cliente' => $p->cliente?->name,
                'local' => $p->estabelecimento?->nome,
                'status' => $p->status,
                'status_rotulo' => self::STATUS_PRODUTO[$p->status] ?? $p->status,
                'valor' => (float) $p->valor_total,
                'quem_atende' => $p->entregador?->name ?: $p->funcionario?->nome,
                'detalhe' => $p->modo_recebimento === 'entrega' ? 'Entrega' : 'Retirada',
                'criado_em' => $p->created_at?->toIso8601String(),
            ]);
    }

    private function reservas($estabelecimentosIds)
    {
        return Agendamento::with(['servico:id,nome', 'usuario:id,name', 'funcionario:id,nome', 'estabelecimento:id,nome'])
            ->whereIn('estabelecimento_id', $estabelecimentosIds)
            ->where('data_agendamento', '>=', now('America/Sao_Paulo')->subDays(30)->toDateString())
            ->orderByDesc('data_agendamento')
            ->limit(300)
            ->get()
            ->map(fn (Agendamento $a) => [
                'tipo' => 'reserva',
                'id' => $a->id,
                'codigo' => '#' . $a->id,
                'titulo' => $a->servico?->nome ?? 'Atendimento',
                'quantidade' => 1,
                'cliente' => $a->usuario?->name,
                'local' => $a->estabelecimento?->nome,
                'status' => $a->status,
                'status_rotulo' => self::STATUS_RESERVA[$a->status] ?? $a->status,
                'valor' => (float) $a->valor_final,
                'quem_atende' => $a->funcionario?->nome,
                'detalhe' => substr((string) $a->hora_agendamento, 0, 5) . ' · ' . \Carbon\Carbon::parse($a->data_agendamento)->format('d/m/Y'),
                'criado_em' => \Carbon\Carbon::parse($a->data_agendamento . ' ' . $a->hora_agendamento, 'America/Sao_Paulo')->toIso8601String(),
            ]);
    }
}
