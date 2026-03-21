<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agendamento;
use App\Models\Funcionario;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Carbon\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;

class FuncionarioAreaController extends Controller
{
    public function index(Request $request)
    {
        $user = Auth::user();
        
        $funcionarios = Funcionario::with('estabelecimento')
            ->where('usuario_id', $user->id)
            ->get();

        if ($funcionarios->isEmpty()) {
            abort(403, 'Acesso restrito. Você não possui um perfil de profissional associado.');
        }

        $funcionarioIds = $funcionarios->pluck('id');
        $hoje = Carbon::today()->toDateString();

        // 1. Quem está na cadeira AGORA? (Sempre de HOJE)
        $emAtendimento = Agendamento::with(['usuario', 'servico'])
            ->whereIn('funcionario_id', $funcionarioIds)
            ->whereDate('data_agendamento', $hoje)
            ->where('status', 'confirmado')
            ->first();

        // 2. Fila de Espera Rigorosa (Sempre de HOJE)
        $filaEspera = Agendamento::with(['usuario', 'servico'])
            ->whereIn('funcionario_id', $funcionarioIds)
            ->whereDate('data_agendamento', $hoje)
            ->whereIn('status', ['pendente', 'atrasado'])
            ->orderByRaw("CASE WHEN status = 'pendente' THEN 1 WHEN status = 'atrasado' THEN 2 ELSE 3 END")
            ->orderBy('hora_agendamento', 'asc')
            ->get();

        $proximo = $filaEspera->first();

        $esperaPorServico = $filaEspera->groupBy(function($item) {
            return $item->servico->nome;
        })->map->count();

        // 3. Ganhos de Hoje (Dashboard Card)
        $ganhosHoje = Agendamento::whereIn('funcionario_id', $funcionarioIds)
            ->whereDate('data_agendamento', $hoje)
            ->whereIn('status', ['concluido', 'finalizado'])
            ->sum('valor_final');

        // 👉 4. HISTÓRICO RESTAURADO (Com Filtros: Hoje, Mês, Ano, Todos)
        $periodo = $request->get('periodo', 'hoje');
        
        $queryHistorico = Agendamento::with(['usuario', 'servico', 'estabelecimento'])
            ->whereIn('funcionario_id', $funcionarioIds);

        if ($periodo === 'hoje') {
            $queryHistorico->whereDate('data_agendamento', Carbon::today());
        } elseif ($periodo === 'mes') {
            $queryHistorico->whereMonth('data_agendamento', Carbon::now()->month)
                           ->whereYear('data_agendamento', Carbon::now()->year);
        } elseif ($periodo === 'ano') {
            $queryHistorico->whereYear('data_agendamento', Carbon::now()->year);
        }
        // Se for 'todos', não aplica filtro de data

        // Ordena do mais recente para o mais antigo e pagina (15 por tela)
        $historico = $queryHistorico->orderBy('data_agendamento', 'desc')
            ->orderBy('hora_agendamento', 'desc')
            ->paginate(15)->withQueryString();

        return Inertia::render('Funcionario/Dashboard', [
            'funcionarios' => $funcionarios,
            'emAtendimento' => $emAtendimento,
            'proximo' => $proximo,
            'filaEspera' => $filaEspera,
            'esperaPorServico' => $esperaPorServico,
            'historico' => $historico,
            'ganhosHoje' => $ganhosHoje,
            'filtros' => $request->all(),
            'now' => Carbon::now()->toDateTimeString()
        ]);
    }

    public function togglePausa(Request $request, $id)
    {
        $funcionario = Funcionario::where('usuario_id', Auth::id())->findOrFail($id);
        $funcionario->update(['ativo' => !$funcionario->ativo]);
        
        $mensagem = $funcionario->ativo 
            ? '🔋 Você está Online na loja ' . ($funcionario->estabelecimento->nome ?? '') . '!' 
            : '☕ Pausa ativada em ' . ($funcionario->estabelecimento->nome ?? '') . '.';

        return back()->with('success', $mensagem);
    }

    public function chamarProximo($id)
    {
        $funcionarioIds = Funcionario::where('usuario_id', Auth::id())->pluck('id');

        $atendendo = Agendamento::whereIn('funcionario_id', $funcionarioIds)
            ->whereDate('data_agendamento', Carbon::today())
            ->where('status', 'confirmado')
            ->exists();

        if ($atendendo) {
            return back()->withErrors(['error' => '⚠️ Você não pode chamar o próximo enquanto não finalizar o atendimento atual!']);
        }

        $agendamento = Agendamento::where('id', $id)
            ->whereIn('funcionario_id', $funcionarioIds)
            ->firstOrFail();

        $agendamento->update(['status' => 'confirmado']);
        return back()->with('success', 'Cliente chamado para a cadeira!');
    }

    public function pularCliente($id)
    {
        $agendamento = Agendamento::where('id', $id)
            ->whereIn('funcionario_id', Funcionario::where('usuario_id', Auth::id())->pluck('id'))
            ->firstOrFail();

        $agendamento->update(['status' => 'atrasado']);
        return back()->with('success', 'Cliente pulado. Ele foi movido para o fim da fila de prioridade.');
    }

    public function cancelarEstornar($id)
    {
        $agendamento = Agendamento::with('pagamento')->where('id', $id)
            ->whereIn('funcionario_id', Funcionario::where('usuario_id', Auth::id())->pluck('id'))
            ->firstOrFail();

        $horaMarcada = Carbon::parse($agendamento->data_agendamento . ' ' . $agendamento->hora_agendamento);
        $horaLimiteCancelamento = $horaMarcada->copy()->addMinutes(30);

        if (Carbon::now()->lessThan($horaLimiteCancelamento)) {
            return back()->withErrors(['error' => '❌ Bloqueado! Só pode cancelar o serviço após 30 minutos de atraso do cliente (A partir das ' . $horaLimiteCancelamento->format('H:i') . ').']);
        }

        if ($agendamento->status_pagamento === 'pago_online') {
            $agendamento->update(['status' => 'cancelado', 'status_pagamento' => 'estornado']);
            $mensagem = 'Atendimento cancelado por atraso. Estorno automático processado no Mercado Pago!';
        } else {
            $agendamento->update(['status' => 'cancelado']);
            $mensagem = 'Atendimento cancelado por atraso superior a 30 minutos.';
        }

        return back()->with('success', $mensagem);
    }
}