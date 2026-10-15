<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agendamento;
use App\Models\Aluguel;
use App\Models\Estabelecimento;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Histórico em PDF para sócio e gerente: todos os serviços (agendamentos) e reservas (locações)
 * de um dia ou de um mês, com cliente, código, situação (concluídos, cancelados, pendentes...),
 * valores, quem atendeu e reembolsos.
 */
class HistoricoAtendimentosController extends Controller
{
    private const FUSO = 'America/Sao_Paulo';
    private const PAPEIS_GESTAO = ['admin', 'socio', 'proprietario', 'gerente'];

    private const STATUS_SERVICO = [
        'pendente' => 'Pendente', 'confirmado' => 'Confirmado', 'finalizado' => 'Concluído', 'cancelado' => 'Cancelado',
    ];

    private const STATUS_RESERVA = [
        'pendente' => 'Pendente', 'aguardando_pagamento' => 'Aguardando pagamento', 'aguardando_assinatura' => 'Aguardando contrato',
        'confirmado' => 'Confirmada', 'em_andamento' => 'Em andamento', 'finalizado' => 'Concluída', 'cancelado' => 'Cancelada',
    ];

    public function pdf(Request $request)
    {
        // Um mês cheio pode ter centenas de linhas e várias páginas: o gerador de PDF precisa de mais
        // memória e tempo que uma requisição comum (vale só para esta requisição).
        @ini_set('memory_limit', '512M');
        @set_time_limit(120);

        $dados = $this->montar($request);
        $nome = 'Historico_' . $dados['periodo']['arquivo'] . '.pdf';

        return Pdf::loadView('pdfs.historico_atendimentos', $dados)->setPaper('a4', 'landscape')->download($nome);
    }

    /** Mesmos dados em JSON (útil para pré-visualizar a contagem antes de baixar). */
    public function resumo(Request $request)
    {
        $dados = $this->montar($request);

        return response()->json(['periodo' => $dados['periodo'], 'resumo' => $dados['resumo']]);
    }

    private function montar(Request $request): array
    {
        $validated = $request->validate([
            'periodo' => 'required|in:dia,mes',
            'data' => 'required_if:periodo,dia|nullable|date',
            'mes' => 'required_if:periodo,mes|nullable|date_format:Y-m',
            'estabelecimento_id' => 'nullable|integer',
        ]);

        $user = $request->user();
        $locais = $this->locaisDeGestao($user);
        abort_if($locais->isEmpty(), 403, 'O histórico é para sócios e gerentes de um local.');

        if (!empty($validated['estabelecimento_id'])) {
            abort_unless($locais->contains((int) $validated['estabelecimento_id']), 403, 'Este local não é seu.');
            $locais = collect([(int) $validated['estabelecimento_id']]);
        }

        [$inicio, $fim, $rotulo, $arquivo] = $this->intervalo($validated);

        $servicos = Agendamento::with(['usuario:id,name,email,mobile_phone', 'servico:id,nome', 'funcionario:id,nome', 'estabelecimento:id,nome'])
            ->whereIn('estabelecimento_id', $locais)
            ->whereBetween('data_agendamento', [$inicio->toDateString(), $fim->toDateString()])
            ->orderBy('data_agendamento')->orderBy('hora_agendamento')
            ->get()
            ->map(fn (Agendamento $a) => [
                'id' => $a->id,
                'data' => Carbon::parse($a->data_agendamento)->format('d/m/Y'),
                'hora' => substr((string) $a->hora_agendamento, 0, 5),
                'cliente' => $a->usuario?->name ?? '—',
                'contato' => $a->usuario?->mobile_phone ?: ($a->usuario?->email ?? ''),
                'servico' => $a->servico?->nome ?? 'Serviço',
                'local' => $a->estabelecimento?->nome,
                'profissional' => $a->funcionario?->nome ?? '—',
                'status' => $a->status,
                'status_rotulo' => self::STATUS_SERVICO[$a->status] ?? ucfirst((string) $a->status),
                'pagamento' => $this->rotuloPagamento($a->status_pagamento),
                'valor' => (float) $a->valor_final,
                'descontos' => (float) $a->valor_desconto_pontos + (float) $a->valor_desconto_cupom,
            ]);

        // Locações: itens_aluguel/alugueis.estabelecimento_id guardam o users.id do dono.
        $donos = DB::table('estabelecimento_usuario')
            ->whereIn('estabelecimento_id', $locais)
            ->whereIn('tipo', ['socio', 'proprietario'])
            ->pluck('usuario_id')
            ->push($user->id)
            ->unique();

        $reservas = Aluguel::with(['locatario:id,name,email,mobile_phone', 'item:id,nome', 'funcionario:id,nome'])
            ->where(fn ($q) => $q->whereIn('proprietario_id', $donos)->orWhereIn('estabelecimento_id', $donos))
            ->whereBetween('data_inicio', [$inicio->toDateString(), $fim->toDateString()])
            ->orderBy('data_inicio')
            ->get()
            ->map(fn (Aluguel $r) => [
                'id' => $r->id,
                'codigo' => $r->codigo_reserva,
                'inicio' => Carbon::parse($r->data_inicio)->format('d/m/Y'),
                'fim' => Carbon::parse($r->data_fim)->format('d/m/Y'),
                'cliente' => $r->locatario?->name ?? '—',
                'contato' => $r->locatario?->mobile_phone ?: ($r->locatario?->email ?? ''),
                'item' => $r->item?->nome ?? 'Item',
                'responsavel' => $r->funcionario?->nome ?? '—',
                'status' => $r->status,
                'status_rotulo' => self::STATUS_RESERVA[$r->status] ?? ucfirst((string) $r->status),
                'pagamento' => $r->forma_pagamento === 'presencial' ? 'No local' : 'Online',
                'valor' => (float) $r->valor_total,
                'caucao' => (float) $r->valor_caucao,
                'reembolsado' => $r->valor_reembolsado !== null ? (float) $r->valor_reembolsado : null,
            ]);

        $somar = fn ($lista, array $status) => round((float) $lista->whereIn('status', $status)->sum('valor'), 2);

        return [
            'periodo' => ['rotulo' => $rotulo, 'arquivo' => $arquivo, 'inicio' => $inicio->toDateString(), 'fim' => $fim->toDateString()],
            'locais' => Estabelecimento::whereIn('id', $locais)->orderBy('nome')->pluck('nome'),
            'responsavel' => $user->name,
            'emitidoEm' => now(self::FUSO),
            'servicos' => $servicos,
            'reservas' => $reservas,
            'resumo' => [
                'servicos_total' => $servicos->count(),
                'servicos_concluidos' => $servicos->where('status', 'finalizado')->count(),
                'servicos_cancelados' => $servicos->where('status', 'cancelado')->count(),
                'servicos_abertos' => $servicos->whereIn('status', ['pendente', 'confirmado'])->count(),
                'servicos_faturado' => $somar($servicos, ['finalizado']),
                'reservas_total' => $reservas->count(),
                'reservas_concluidas' => $reservas->where('status', 'finalizado')->count(),
                'reservas_canceladas' => $reservas->where('status', 'cancelado')->count(),
                'reservas_abertas' => $reservas->whereNotIn('status', ['finalizado', 'cancelado'])->count(),
                'reservas_faturado' => $somar($reservas, ['finalizado', 'em_andamento', 'confirmado']),
                'reservas_reembolsado' => round((float) $reservas->sum(fn ($r) => $r['reembolsado'] ?? 0), 2),
            ],
        ];
    }

    /** @return array{0: Carbon, 1: Carbon, 2: string, 3: string} início, fim, rótulo e parte do nome do arquivo */
    private function intervalo(array $v): array
    {
        if ($v['periodo'] === 'dia') {
            $dia = Carbon::parse($v['data'], self::FUSO)->startOfDay();

            return [$dia, $dia->copy()->endOfDay(), 'Dia ' . $dia->format('d/m/Y'), $dia->format('Y-m-d')];
        }

        $mes = Carbon::createFromFormat('Y-m', $v['mes'], self::FUSO)->startOfMonth();

        return [$mes, $mes->copy()->endOfMonth(), 'Mês ' . $mes->locale('pt_BR')->translatedFormat('F \d\e Y'), $mes->format('Y-m')];
    }

    private function locaisDeGestao($user)
    {
        if (strtolower((string) $user->papel) === 'admin') {
            return Estabelecimento::pluck('id');
        }

        return DB::table('estabelecimento_usuario')
            ->where('usuario_id', $user->id)
            ->whereIn('tipo', self::PAPEIS_GESTAO)
            ->pluck('estabelecimento_id')
            ->map(fn ($id) => (int) $id);
    }

    private function rotuloPagamento(?string $status): string
    {
        return match ($status) {
            'pago', 'pago_online', 'pago_presencial', 'concluido' => 'Pago',
            'aguardando_pagamento', 'pendente' => 'Aguardando',
            'presencial', 'local' => 'No local',
            'estornado' => 'Estornado',
            'cancelado' => 'Cancelado',
            default => $status ? ucfirst(str_replace('_', ' ', $status)) : '—',
        };
    }
}
