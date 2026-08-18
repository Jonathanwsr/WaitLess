<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agendamento;
use App\Models\Funcionario;
use App\Models\Pagamento;
use App\Services\PagamentoService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Carbon\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

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

        $emAtendimento = Agendamento::with(['usuario', 'servico'])
            ->whereIn('funcionario_id', $funcionarioIds)
            ->whereDate('data_agendamento', $hoje)
            ->where('status', 'confirmado')
            ->first();

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

        $ganhosHoje = Agendamento::whereIn('funcionario_id', $funcionarioIds)
            ->whereDate('data_agendamento', $hoje)
            ->whereIn('status', ['concluido', 'finalizado'])
            ->sum('valor_final');

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

    /**
     * 👉 FUNÇÃO AUXILIAR DE SEGURANÇA ATUALIZADA
     * Verifica se quem clicou tem poder para finalizar ou estornar, lendo a tabela estabelecimento_usuario
     */
    private function temPermissaoDeCaixa($agendamento)
    {
        $user = Auth::user();
        
        // 1. Admin global do sistema
        if (isset($user->papel) && strtolower(trim($user->papel)) === 'admin') {
            return true;
        }

        // 2. Se o agendamento tem um funcionário específico e é o usuário logado
        if ($agendamento->funcionario_id) {
            $isAtendente = Funcionario::where('usuario_id', $user->id)
                ->where('id', $agendamento->funcionario_id)
                ->exists();
                
            if ($isAtendente) return true;
        }

        // 3. Se não houver funcionário (ex: reserva geral) OU se for o dono/gerente do local
        // Verifica na tabela pivot estabelecimento_usuario
        $permissaoLocal = DB::table('estabelecimento_usuario')
            ->where('usuario_id', $user->id)
            ->where('estabelecimento_id', $agendamento->estabelecimento_id)
            ->whereIn('tipo', ['admin', 'socio', 'gerente']) // Somente cargos de chefia
            ->exists();

        return $permissaoLocal;
    }

    /**
     * 👉 MÉTODO MANTIDO: Finalização por PIN (Libera a Custódia e dá Pontos)
     */
    public function finalizarComPin(Request $request, $id, PagamentoService $pagamentoService)
    {
        $request->validate([
            'codigo_pin' => 'required|string|size:4'
        ]);

        $agendamento = Agendamento::with('pagamento')->findOrFail($id);

        if (!$this->temPermissaoDeCaixa($agendamento)) {
            abort(403, 'Você não tem permissão para finalizar este atendimento.');
        }

        if ((string)$agendamento->codigo_verificacao !== (string)$request->codigo_pin) {
            return back()->withErrors(['error' => 'PIN inválido! Peça ao cliente para verificar o código correto no app.']);
        }

        try {
            DB::beginTransaction();

            // 1. Liberação da Custódia Financeira no Asaas
            if (in_array($agendamento->status_pagamento, ['pago', 'pago_online']) && $agendamento->pagamento) {
                $pagamento = $agendamento->pagamento;

                if ($pagamento->id_transacao_gateway) {
                    $pagamentoService->liberarCustodiaAsaas($pagamento->id_transacao_gateway);
                    
                    // Atualiza o extrato do lojista (o status retido vira liberado)
                    DB::table('extrato_providers')
                        ->where('codigo_transacao', $pagamento->id_transacao_gateway)
                        ->update(['status' => 'liberado', 'data_liberacao' => now()]);
                }
            }

            // 2. Entrega dos Pontos de Fidelidade
            $pontosGanhos = floor($agendamento->valor_final);
            $clienteId = $agendamento->usuario_id;

            if ($pontosGanhos > 0 && $clienteId) {
                DB::table('historico_pontos')->insert([
                    'usuario_id'         => $clienteId,
                    'estabelecimento_id' => $agendamento->estabelecimento_id,
                    'agendamento_id'     => $agendamento->id,
                    'tipo'               => 'ganho',
                    'descricao'          => 'Pontos recebidos por serviço finalizado',
                    'quantidade'         => $pontosGanhos,
                    'created_at'         => now()
                ]);

                DB::table('pontos_usuario_estabelecimento')->updateOrInsert(
                    ['usuario_id' => $clienteId, 'estabelecimento_id' => $agendamento->estabelecimento_id],
                    ['total_pontos' => DB::raw("total_pontos + {$pontosGanhos}"), 'updated_at' => now(), 'created_at' => now()]
                );
            }

            $agendamento->update([
                'status' => 'concluido',
                'hora_finalizacao' => now()->format('H:i'),
                'finalizado_por' => Auth::id() // Salva quem finalizou (o dono, gerente ou funcionario)
            ]);

            DB::commit();
            return back()->with('success', 'Atendimento concluído com sucesso! O valor foi liberado e os pontos enviados ao cliente.');

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("Erro ao finalizar PIN do agendamento #{$id}: " . $e->getMessage());
            return back()->withErrors(['error' => 'Falha interna ao se comunicar com o banco. Tente novamente.']);
        }
    }

    /**
     * 👉 ATUALIZADO: Cancelamento com Integração Asaas (Estorno Real e Dedutivo)
     */
    public function cancelarEstornar($id, PagamentoService $pagamentoService)
    {
        $agendamento = Agendamento::with(['pagamento', 'estabelecimento'])->findOrFail($id);

        if (!$this->temPermissaoDeCaixa($agendamento)) {
            abort(403, 'Você não tem permissão para estornar/cancelar este atendimento.');
        }

        // Regra de negócios de tempo
        $horaMarcada = Carbon::parse($agendamento->data_agendamento . ' ' . $agendamento->hora_agendamento);
        $horaLimiteCancelamento = $horaMarcada->copy()->addMinutes(30);
        
        // Verifica se é admin global ou gerente/socio/admin do local para burlar a regra de 30 minutos
        $isGerenciaLocal = DB::table('estabelecimento_usuario')
            ->where('usuario_id', Auth::id())
            ->where('estabelecimento_id', $agendamento->estabelecimento_id)
            ->whereIn('tipo', ['admin', 'socio', 'gerente'])
            ->exists();

        $isGlobalAdmin = isset(Auth::user()->papel) && strtolower(trim(Auth::user()->papel)) === 'admin';

        if (!$isGlobalAdmin && !$isGerenciaLocal && Carbon::now()->lessThan($horaLimiteCancelamento)) {
            return back()->withErrors(['error' => '❌ Só é permitido cancelar por no-show após 30 minutos de atraso (A partir das ' . $horaLimiteCancelamento->format('H:i') . ').']);
        }

        try {
            DB::beginTransaction();

            if (in_array($agendamento->status_pagamento, ['pago', 'pago_online']) && $agendamento->pagamento) {
                $pagamento = $agendamento->pagamento;

                if ($pagamento->id_transacao_gateway) {
                    // Comunicação com o gateway para desfazer o split e estornar o cliente
                    $pagamentoService->estornarPagamento($pagamento->id_transacao_gateway);
                }

                $pagamento->update(['status' => 'estornado']);
                $agendamento->update(['status' => 'cancelado', 'status_pagamento' => 'estornado']);

                // Identifica a carteira para deduzir o saldo do lojista
                $provider = DB::table('providers')
                    ->join('estabelecimento_usuario', 'providers.user_id', '=', 'estabelecimento_usuario.usuario_id')
                    ->where('estabelecimento_usuario.estabelecimento_id', $agendamento->estabelecimento_id)
                    ->select('providers.id')
                    ->first();

                if ($provider) {
                    DB::table('providers')->where('id', $provider->id)->decrement('saldo', $pagamento->valor_liquido);

                    DB::table('extrato_providers')->insert([
                        'provider_id'      => $provider->id,
                        'usuario_id'       => $pagamento->usuario_id,
                        'origem_type'      => 'App\Models\Agendamento',
                        'origem_id'        => $agendamento->id,
                        'tipo'             => 'estorno',
                        'valor_bruto'      => $pagamento->valor,
                        'taxa_plataforma'  => $pagamento->taxa,
                        'valor_liquido'    => $pagamento->valor_liquido * -1,
                        'descricao'        => 'Estorno processado pelo lojista/atendente',
                        'status'           => 'estornado',
                        'codigo_transacao' => $pagamento->id_transacao_gateway,
                        'metodo_pagamento' => $pagamento->metodo_pagamento === 'cartao' ? 'cartao_credito' : $pagamento->metodo_pagamento,
                        'created_at'       => now()
                    ]);
                }
                
                $mensagem = 'Atendimento cancelado! O estorno foi acionado no gateway financeiro.';
            } else {
                $agendamento->update(['status' => 'cancelado', 'status_pagamento' => 'cancelado']);
                $mensagem = 'Atendimento cancelado com sucesso.';
            }

            DB::commit();
            return back()->with('success', $mensagem);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("Erro ao cancelar/estornar agendamento #{$id}: " . $e->getMessage());
            return back()->withErrors(['error' => 'Falha ao processar o estorno no Asaas. Tente novamente.']);
        }
    }
}