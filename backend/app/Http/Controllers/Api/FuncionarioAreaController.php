<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agendamento;
use App\Models\Funcionario;
use App\Models\Pagamento;
use App\Models\User;
use App\Models\Estabelecimento;
use App\Services\PagamentoService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Carbon\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class FuncionarioAreaController extends Controller
{
    /* =========================================================================
       👉 CONSTRUÇÃO DO DASHBOARD (VISÃO DO FUNCIONÁRIO)
       ========================================================================= */
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

        // Obtém o cliente que já está "Na Cadeira" (Status Confirmado)
        $emAtendimento = Agendamento::with(['usuario', 'servico', 'estabelecimento'])
            ->whereIn('funcionario_id', $funcionarioIds)
            ->whereDate('data_agendamento', $hoje)
            ->where('status', 'confirmado')
            ->first();

        // Busca quem delegou (finalizado_por / criado_por se houver) e os que estão aguardando
        $filaEspera = Agendamento::with(['usuario', 'servico', 'delegador']) 
            ->whereIn('funcionario_id', $funcionarioIds)
            ->whereDate('data_agendamento', $hoje)
            ->whereIn('status', ['pendente', 'atrasado'])
            ->orderByRaw("CASE WHEN status = 'pendente' THEN 1 WHEN status = 'atrasado' THEN 2 ELSE 3 END")
            ->orderBy('hora_agendamento', 'asc')
            ->get();

        $proximo = $filaEspera->first();

        $esperaPorServico = $filaEspera->groupBy(function($item) {
            return $item->servico->nome ?? 'Outros';
        })->map->count();

        // Calculo de Produção Diária deste profissional
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

    /* =========================================================================
       👉 AÇÕES DE FILA (PAUSA, CHAMAR, ADIAR, PULAR)
       ========================================================================= */
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
            return back()->withErrors(['error' => '⚠️ Finalize o atendimento atual na cadeira antes de chamar o próximo cliente.']);
        }

        $agendamento = Agendamento::with(['usuario', 'estabelecimento', 'servico'])
            ->where('id', $id)
            ->whereIn('funcionario_id', $funcionarioIds)
            ->firstOrFail();

        $agendamento->update([
            'status' => 'confirmado',
            'adiado_ate' => null 
        ]);

        // E-mail de Aviso de Chamada
        if ($agendamento->usuario && $agendamento->usuario->email) {
            $local = $agendamento->estabelecimento->nome ?? 'o estabelecimento';
            $mensagem = "Olá {$agendamento->usuario->name}!\n\nChegou a sua vez!\nDirija-se à cadeira do profissional designado em {$local} para iniciar seu atendimento.\nLembre-se de apresentar seu PIN de segurança no final.\n\nEquipe Lokyva.";
            Mail::raw($mensagem, function ($msg) use ($agendamento) {
                $msg->to($agendamento->usuario->email)->subject('Sua vez chegou! - Lokyva');
            });
        }

        return back()->with('success', 'Cliente chamado! O cliente foi notificado.');
    }

    public function pularCliente($id)
    {
        $agendamento = Agendamento::with(['usuario'])->where('id', $id)
            ->whereIn('funcionario_id', Funcionario::where('usuario_id', Auth::id())->pluck('id'))
            ->firstOrFail();

        // 1. INTELIGÊNCIA: Busca o ÚLTIMO cliente pendente de hoje neste funcionário
        $ultimoAgendamento = Agendamento::where('funcionario_id', $agendamento->funcionario_id)
            ->whereDate('data_agendamento', $agendamento->data_agendamento)
            ->whereIn('status', ['pendente', 'atrasado'])
            ->where('id', '!=', $agendamento->id)
            ->orderBy('hora_agendamento', 'desc')
            ->first();

        // 2. Calcula o novo horário para o fim da fila
        if ($ultimoAgendamento) {
            $novaHora = Carbon::parse($ultimoAgendamento->hora_agendamento)->addMinutes(15)->format('H:i:s');
        } else {
            $novaHora = now()->addMinutes(15)->format('H:i:s');
        }

        $agendamento->update([
            'hora_agendamento' => $novaHora,
            'status' => 'atrasado',
            'vezes_adiado' => 0
        ]);

        // E-mail de Punição Suave (Perdeu a Vez)
        if ($agendamento->usuario && $agendamento->usuario->email) {
            $horaStr = substr($novaHora, 0, 5);
            $mensagem = "Olá {$agendamento->usuario->name},\n\nVocê não compareceu quando chamado. Para que não perca seu atendimento, realocamos você para o final da fila.\nSeu novo horário previsto é às {$horaStr}.\n\nAcompanhe no app.\n\nEquipe Lokyva.";
            Mail::raw($mensagem, function ($msg) use ($agendamento) {
                $msg->to($agendamento->usuario->email)->subject('Você foi movido para o fim da fila - Lokyva');
            });
        }

        return back()->with('error', "Cliente ausente movido para o final da fila (Hora: " . substr($novaHora, 0, 5) . ").");
    }

    /* =========================================================================
       👉 SEGURANÇA E FINALIZAÇÃO DE CAIXA / PONTUAÇÃO
       ========================================================================= */
    private function temPermissaoDeCaixa($agendamento)
    {
        $user = Auth::user();
        
        if (isset($user->papel) && strtolower(trim($user->papel)) === 'admin') {
            return true;
        }

        if ($agendamento->funcionario_id) {
            $isAtendente = Funcionario::where('usuario_id', $user->id)
                ->where('id', $agendamento->funcionario_id)
                ->exists();
            if ($isAtendente) return true;
        }

        return DB::table('estabelecimento_usuario')
            ->where('usuario_id', $user->id)
            ->where('estabelecimento_id', $agendamento->estabelecimento_id)
            ->whereIn('tipo', ['admin', 'socio', 'gerente']) 
            ->exists();
    }
public function finalizarComCodigo(Request $request, $id)
    {
        $request->validate([
            'codigo_pin' => 'required|string|size:4',
            'desconto' => 'nullable|numeric|min:0',
            'forma_pagamento' => 'required|string|in:pix,dinheiro,cartao_credito,cartao_debito,online',
        ]);

        $agendamento = Agendamento::findOrFail($id);

        if ((string)$agendamento->codigo_verificacao !== (string)$request->codigo_pin) {
            return back()->withErrors(['error' => 'PIN inválido! Verifique os dígitos do app do cliente.']);
        }

        try {
            DB::beginTransaction();

            $valorOriginal = floatval($agendamento->valor_final ?? $agendamento->valor_original ?? $agendamento->servico->valor ?? 0);
            $desconto = floatval($request->desconto ?? 0);
            
            if ($desconto > $valorOriginal) {
                throw new \Exception('O desconto não pode ser maior que o valor do serviço.');
            }

            $valorFinal = $valorOriginal - $desconto;
            $taxaMarketplace = $valorFinal * 0.12; 
            $estabelecimento = Estabelecimento::find($agendamento->estabelecimento_id);

            // Processamento do Pagamento (Registrando Físico ou Confirmando Online)
            if ($request->forma_pagamento === 'online') {
                $pagamento = DB::table('pagamentos')->where('agendamento_id', $agendamento->id)->first();
                if (!$pagamento || $pagamento->status !== 'pago') {
                    throw new \Exception('O pagamento online não foi aprovado pelo Asaas ainda.');
                }
            } else {
                if ($estabelecimento) {
                    $estabelecimento->increment('saldo_devedor', $taxaMarketplace);
                }
                
                DB::table('pagamentos')->updateOrInsert(
                    ['agendamento_id' => $agendamento->id],
                    [
                        'usuario_id' => $agendamento->usuario_id,
                        'estabelecimento_id' => $agendamento->estabelecimento_id,
                        'metodo_pagamento' => $request->forma_pagamento,
                        'valor' => $valorOriginal,
                        'taxa' => $taxaMarketplace,
                        'valor_liquido' => $valorFinal - $taxaMarketplace,
                        'valor_total' => $valorFinal,
                        'taxa_plataforma' => $taxaMarketplace,
                        'status' => 'pago',
                        'data_pagamento' => now(),
                        'updated_at' => now(),
                    ]
                );
            }

            // Entrega dos Pontos (1000 Pontos = 10 reais => R$1 = 100 Pontos)
            $pontosGanhos = floor($valorFinal * 100);
            $clienteId = $agendamento->usuario_id;
            $cliente = User::find($clienteId);

            if ($pontosGanhos > 0 && $cliente) {
                DB::table('historico_pontos')->insert([
                    'usuario_id'         => $clienteId,
                    'estabelecimento_id' => $agendamento->estabelecimento_id,
                    'agendamento_id'     => $agendamento->id,
                    'tipo'               => 'ganho',
                    'descricao'          => 'Serviço Concluído na Loja',
                    'quantidade'         => $pontosGanhos,
                    'created_at'         => now()
                ]);

                // Correção do banco para os pontos (INSERT OU UPDATE SEGURO)
                $registroPontos = DB::table('pontos_usuario_estabelecimento')
                    ->where('usuario_id', $clienteId)
                    ->where('estabelecimento_id', $agendamento->estabelecimento_id)
                    ->first();

                if ($registroPontos) {
                    DB::table('pontos_usuario_estabelecimento')
                        ->where('id', $registroPontos->id)
                        ->increment('total_pontos', $pontosGanhos, ['updated_at' => now()]);
                } else {
                    DB::table('pontos_usuario_estabelecimento')->insert([
                        'usuario_id' => $clienteId,
                        'estabelecimento_id' => $agendamento->estabelecimento_id,
                        'total_pontos' => $pontosGanhos,
                        'created_at' => now(),
                        'updated_at' => now()
                    ]);
                }

                $cliente->increment('pontos_saldo', $pontosGanhos);
                $cliente->increment('numero_servicos');
            }

            if ($estabelecimento) {
                $estabelecimento->increment('numero_servicos');
            }

            // Atualização do Agendamento usando 'finalizado' (Corrigindo o check violation)
            $agendamento->update([
                'status' => 'finalizado', 
                'foi_realizado' => true,
                'hora_finalizacao' => now()->format('H:i:s'),
                'finalizado_por' => Auth::id(),
                'status_pagamento' => $request->forma_pagamento === 'online' ? 'pago_online' : 'pago_presencial',
                'valor_final' => $valorFinal,
                'adiado_ate' => null,
                'taxa_plataforma' => $taxaMarketplace
            ]);

            DB::commit();
            return back()->with('success', 'Finalizado com Sucesso! ' . $pontosGanhos . ' pontos transferidos ao cliente.');

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("Erro no PIN / Finalização #{$id}: " . $e->getMessage());
            return back()->withErrors(['error' => 'Falha interna: ' . $e->getMessage()]);
        }
    }
    
    /* =========================================================================
       👉 CANCELAMENTO SEGURO COM INTEGRAÇÃO DE ASAAS E ESTORNO
       ========================================================================= */
    public function cancelarEstornar($id)
    {
        $agendamento = Agendamento::findOrFail($id);

        if (!$this->temPermissaoDeCaixa($agendamento)) {
            abort(403, 'Você não tem permissão para estornar/cancelar este atendimento.');
        }

        if (in_array($agendamento->status, ['cancelado', 'concluido', 'finalizado'])) {
            return back()->withErrors(['error' => 'O status atual não permite o cancelamento.']);
        }

        $horaMarcada = Carbon::parse($agendamento->data_agendamento . ' ' . $agendamento->hora_agendamento);
        $horaLimiteCancelamento = $horaMarcada->copy()->addMinutes(30);
        
        $isGerenciaLocal = DB::table('estabelecimento_usuario')
            ->where('usuario_id', Auth::id())
            ->where('estabelecimento_id', $agendamento->estabelecimento_id)
            ->whereIn('tipo', ['admin', 'socio', 'gerente'])
            ->exists();

        $isGlobalAdmin = isset(Auth::user()->papel) && strtolower(trim(Auth::user()->papel)) === 'admin';

        if (!$isGlobalAdmin && !$isGerenciaLocal && Carbon::now()->lessThan($horaLimiteCancelamento)) {
            return back()->withErrors(['error' => '❌ Só é permitido cancelar por ausência após 30 minutos de atraso (A partir das ' . $horaLimiteCancelamento->format('H:i') . ').']);
        }

        try {
            DB::beginTransaction();

            $pagamento = DB::table('pagamentos')->where('agendamento_id', $agendamento->id)->first();
            $mensagem = 'Atendimento cancelado com sucesso.';

            if ($pagamento && in_array($pagamento->status, ['pago', 'pago_online'])) {
                
                // Em cenário real aqui iria a chamada Http para o Asaas realizar o Refund
                
                DB::table('pagamentos')->where('id', $pagamento->id)->update([
                    'status' => 'estornado',
                    'status_estorno' => 'pendente',
                    'valor_estornado' => $pagamento->valor_total,
                    'data_estorno' => now()
                ]);

                $agendamento->update(['status' => 'cancelado', 'status_pagamento' => 'estornado', 'codigo_verificacao' => null]);
                $mensagem = 'Cancelado! O valor foi direcionado para estorno na fatura do cliente.';
            } else {
                $agendamento->update(['status' => 'cancelado', 'status_pagamento' => 'cancelado', 'codigo_verificacao' => null]);
            }

            DB::commit();
            return back()->with('success', $mensagem);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("Erro Cancelamento Atendente #{$id}: " . $e->getMessage());
            return back()->withErrors(['error' => 'Erro sistêmico ao cancelar a reserva. Tente novamente.']);
        }
    }
}