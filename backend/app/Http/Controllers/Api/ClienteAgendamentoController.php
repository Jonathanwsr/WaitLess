<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Estabelecimento;
use App\Models\Agendamento;
use App\Models\Pagamento; 
use App\Services\PagamentoService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB; 
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;
use Inertia\Inertia;
use Exception;

class ClienteAgendamentoController extends Controller
{
    protected $pagamentoService;
    
    // Taxa da plataforma WaitLess definida como 12% conforme regras de negócio
    protected $taxaApp = 0.12; 

    public function __construct(PagamentoService $pagamentoService)
    {
        $this->pagamentoService = $pagamentoService;
    }

    public function show(Estabelecimento $estabelecimento)
    {
        if (!$estabelecimento->ativo) abort(404, 'Este estabelecimento está fechado.');
        return Inertia::render('Agendamentos/Agendar', [
            'estabelecimento' => $estabelecimento->only(['id', 'nome', 'foto_perfil', 'bairro', 'cidade', 'estado', 'telefone']),
            'servicos' => $estabelecimento->servicos()->where('ativo', true)->get()
        ]);
    }

    public function store(Request $request, Estabelecimento $estabelecimento)
    {
        $validated = $request->validate([
            'servico_id'       => 'required|exists:servicos,id',
            'data_agendamento' => 'required|date|after_or_equal:today',
            'hora_agendamento' => 'required|string',
            'forma_pagamento'  => 'required|string|in:online_agora,online_depois,presencial',
            'metodo_pagamento' => 'nullable|required_if:forma_pagamento,online_agora|string|in:pix,cartao,boleto',
            'parcelas'         => 'nullable|integer|min:1|max:12'
        ]);

        $dataHoraAgendada = Carbon::parse($validated['data_agendamento'] . ' ' . $validated['hora_agendamento']);
        if ($dataHoraAgendada->isPast()) return back()->withErrors(['hora_agendamento' => 'Não é possível agendar no passado!']);

        $servico = $estabelecimento->servicos()->findOrFail($validated['servico_id']);
        
        $configuracoes = is_string($servico->configuracoes) ? json_decode($servico->configuracoes, true) : ($servico->configuracoes ?? []);
        $funcionarioId = $configuracoes['funcionario_padrao'] ?? null;
        $tipoPagamentoServico = $configuracoes['tipo_pagamento'] ?? 'hibrido';

        if ($validated['forma_pagamento'] === 'presencial' && $tipoPagamentoServico === 'online') {
            return back()->withErrors(['forma_pagamento' => 'Este serviço aceita apenas pagamento online.']);
        }

        try {
            DB::beginTransaction();

            $formaEscolhida = $validated['forma_pagamento'];
            $isPresencial = ($formaEscolhida === 'presencial');
            
            // Gera o PIN automaticamente se for pagamento presencial no local
            $codigoPin = $isPresencial ? (string) mt_rand(1000, 9999) : null;

            $valorTotal = $servico->valor;

            $agendamento = Agendamento::create([
                'estabelecimento_id' => $estabelecimento->id,
                'usuario_id'         => Auth::id(),
                'servico_id'         => $servico->id,
                'funcionario_id'     => $funcionarioId,
                'data_agendamento'   => $validated['data_agendamento'],
                'hora_agendamento'   => $validated['hora_agendamento'],
                'status'             => $isPresencial ? 'pendente' : 'aguardando_pagamento', 
                'status_pagamento'   => $isPresencial ? 'presencial' : 'pendente',
                'valor_final'        => $valorTotal,
                'codigo_verificacao' => $codigoPin,
            ]);

            // Se for pagamento presencial, criamos o registro local de pagamento
            if ($isPresencial) {
                Pagamento::create([
                    'usuario_id'         => Auth::id(),
                    'estabelecimento_id' => $estabelecimento->id,
                    'agendamento_id'     => $agendamento->id,
                    'gateway_pagamento'  => null,
                    'valor'              => $valorTotal,
                    'taxa'               => round($valorTotal * $this->taxaApp, 2),      
                    'valor_liquido'      => $valorTotal - round($valorTotal * $this->taxaApp, 2), 
                    'status'             => 'pendente',
                    'metodo_pagamento'   => 'presencial', 
                ]);
            }

            $cobrancaAsaas = null;
            if ($formaEscolhida === 'online_agora') {
                $user = Auth::user();
                
                // Dispara a chamada para o gateway de pagamento do Asaas utilizando o service centralizado
                $cobrancaAsaas = $this->pagamentoService->criarCobrancaAsaas(
                    $agendamento,
                    $validated['metodo_pagamento'],
                    $user->asaas_customer_id,
                    $validated['parcelas'] ?? 1
                );
            }

            DB::commit();

            if ($formaEscolhida === 'online_agora' && !empty($cobrancaAsaas['invoice_url'])) {
                // Redireciona o usuário externamente para a página de faturamento seguro do Asaas (PIX, Cartão ou Boleto)
                return Inertia::location($cobrancaAsaas['invoice_url']);
            }
            
            if ($formaEscolhida === 'online_depois') {
                return redirect()->route('dashboard')->with('warning', 'Vaga reservada! Pague online pelo painel antes do prazo expirar.');
            }

            return redirect()->route('dashboard')->with('success', 'Agendamento confirmado! O seu PIN de segurança foi gerado para pagamento no local.');

        } catch (Exception $e) {
            DB::rollBack(); 
            Log::error("Erro no processamento do agendamento: " . $e->getMessage());
            return back()->withErrors(['error' => 'Falha ao processar o agendamento no gateway Asaas. Tente novamente.']);
        }
    }

    public function pagarNovamente($id, Request $request)
    {
        $request->validate([
            'metodo_pagamento' => 'required|string|in:pix,cartao,boleto',
            'parcelas'         => 'nullable|integer|min:1|max:12'
        ]);

        try {
            $agendamento = Agendamento::with(['servico', 'estabelecimento'])->find($id);
            if (!$agendamento) return back()->with('error', 'Agendamento não encontrado.');
            if ($agendamento->usuario_id != Auth::id()) return back()->with('error', 'Acesso negado.');
            if ($agendamento->status_pagamento === 'pago') return back()->with('success', 'Já está pago!');
            if ($agendamento->status === 'cancelado') return back()->with('error', 'Já foi cancelado.');

            $dataAgendamento = Carbon::parse($agendamento->data_agendamento . ' ' . $agendamento->hora_agendamento);
            $limite = ($agendamento->created_at ?: now())->diffInHours($dataAgendamento) > 2 ? $dataAgendamento->copy()->subHours(2) : $dataAgendamento;

            if (now()->isAfter($limite)) {
                $agendamento->update(['status' => 'cancelado', 'status_pagamento' => 'cancelado']);
                return back()->with('error', 'Tempo limite expirado. Agendamento cancelado.');
            }

            if (!$agendamento->servico) return back()->with('error', 'Serviço inexistente.');

            $user = Auth::user();
            
            // Removemos duplicados antigos se existirem na tabela local antes de disparar uma nova tentativa
            Pagamento::where('agendamento_id', $agendamento->id)->where('status', 'pendente')->delete();

            $cobrancaAsaas = $this->pagamentoService->criarCobrancaAsaas(
                $agendamento,
                $request->metodo_pagamento,
                $user->asaas_customer_id,
                $request->parcelas ?? 1
            );

            if (empty($cobrancaAsaas['invoice_url'])) {
                return back()->with('error', 'Serviço de faturamento indisponível no momento.');
            }
            
            return Inertia::location($cobrancaAsaas['invoice_url']);

        } catch (Exception $e) {
            Log::error("Erro ao tentar pagar novamente agendamento #{$id}: " . $e->getMessage());
            return back()->with('error', 'Erro temporário ao gerar link de pagamento. Tente novamente.');
        }
    }

    public function cancelar($id)
    {
        try {
            $agendamento = Agendamento::with('estabelecimento')->find($id);
            
            if (!$agendamento) return back()->with('error', 'Agendamento não encontrado.');
            if ($agendamento->usuario_id != Auth::id()) return back()->with('error', 'Você não tem permissão para cancelar este agendamento.');
            if ($agendamento->status === 'cancelado') return back()->with('warning', 'Este agendamento já se encontra cancelado.');

            $pagamento = Pagamento::where('agendamento_id', $agendamento->id)->first();

            // Se foi pago no app via gateway Asaas, realiza o estorno automatizado da transação
            if (($agendamento->status_pagamento === 'pago' || $agendamento->status_pagamento === 'pago_online') && $pagamento && $pagamento->id_transacao_gateway) {
                
                try {
                    // Executa a devolução financeira direto na API do Asaas
                    $this->pagamentoService->estornarPagamento($pagamento->id_transacao_gateway);
                } catch (Exception $e) {
                    return back()->with('error', 'Falha ao processar o estorno no Asaas. O cancelamento foi abortado por segurança.');
                }

                $pagamento->update(['status' => 'estornado']);
                $agendamento->update(['status' => 'cancelado', 'status_pagamento' => 'estornado']);
                
                return back()->with('success', 'Agendamento cancelado! O valor foi estornado e será devolvido à sua conta.');
            }

            // Se foi pagamento no local ou pendente sem transação efetivada
            $agendamento->update(['status' => 'cancelado', 'status_pagamento' => 'cancelado']);
            if ($pagamento && $pagamento->status !== 'pago') {
                $pagamento->update(['status' => 'cancelado']);
            }

            return back()->with('success', 'Agendamento cancelado com sucesso. A sua vaga foi libertada.');

        } catch (Exception $e) {
            Log::error("Erro ao cancelar o agendamento #{$id}: " . $e->getMessage());
            return back()->with('error', 'Ocorreu um erro ao tentar cancelar. Tente novamente.');
        }
    }
}