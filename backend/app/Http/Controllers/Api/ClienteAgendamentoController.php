<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Estabelecimento;
use App\Models\Agendamento;
use App\Models\Pagamento; 
use App\Services\MercadoPagoService; 
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB; 
use Carbon\Carbon;
use Inertia\Inertia;
use Exception;

class ClienteAgendamentoController extends Controller
{
    protected $mpService;
    
    protected $taxaApp = 0.10; 

    public function __construct(MercadoPagoService $mpService)
    {
        $this->mpService = $mpService;
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
            
            // 👉 GERA O PIN AUTOMATICAMENTE SE FOR PRESENCIAL
            $codigoPin = $isPresencial ? (string) mt_rand(1000, 9999) : null;

            $valorTotal = $servico->valor;
            $valorTaxaApp = $isPresencial ? 0 : round($valorTotal * $this->taxaApp, 2); 
            $valorLiquidoSalao = $valorTotal - $valorTaxaApp;

            $agendamento = Agendamento::create([
                'estabelecimento_id' => $estabelecimento->id,
                'usuario_id'         => Auth::id(),
                'servico_id'         => $servico->id,
                'funcionario_id'     => $funcionarioId,
                'data_agendamento'   => $validated['data_agendamento'],
                'hora_agendamento'   => $validated['hora_agendamento'],
                // Fica "pendente" para entrar na fila da loja, mas o Frontend do cliente já o trata como confirmado
                'status'             => $isPresencial ? 'pendente' : 'aguardando_pagamento', 
                'status_pagamento'   => $isPresencial ? 'presencial' : 'pendente',
                'valor_final'        => $valorTotal,
                'codigo_verificacao' => $codigoPin, // 👉 Nome correto da coluna aplicado aqui!
            ]);

            $pagamento = Pagamento::create([
                'usuario_id'         => Auth::id(),
                'estabelecimento_id' => $estabelecimento->id,
                'agendamento_id'     => $agendamento->id,
                'gateway_pagamento'  => $isPresencial ? null : 'mercadopago',
                'valor'              => $valorTotal,
                'taxa'               => $valorTaxaApp,      
                'valor_liquido'      => $valorLiquidoSalao, 
                'status'             => 'pendente',
                'metodo_pagamento'   => $isPresencial ? 'presencial' : 'online', 
            ]);

            $preference = null;
            if ($formaEscolhida === 'online_agora') {
                $tokenSalao = $estabelecimento->token_mercadopago ?? null; 
                
                $preference = $this->mpService->criarCheckout($agendamento, $servico, $valorTaxaApp, $tokenSalao);
                
                if (!isset($preference['init_point'])) throw new Exception('API do Mercado Pago não devolveu o link.');
                $pagamento->update(['id_transacao_gateway' => $preference['id']]);
            }

            DB::commit();

            if ($formaEscolhida === 'online_agora') return Inertia::location($preference['init_point']);
            elseif ($formaEscolhida === 'online_depois') return redirect()->route('dashboard')->with('warning', 'Vaga reservada! Pague online pelo painel antes do prazo expirar.');
            else return redirect()->route('dashboard')->with('success', 'Agendamento confirmado! O seu PIN de segurança foi gerado para pagamento no local.');

        } catch (Exception $e) {
            DB::rollBack(); 
            throw $e;
        }
    }

    public function callbackMercadoPago(Request $request)
    {
        $statusMP = $request->query('status'); 
        $agendamento = Agendamento::find($request->query('external_reference'));

        if (!$agendamento) return redirect()->route('dashboard')->with('warning', 'Agendamento não localizado.');

        if ($statusMP === 'approved') {
            if ($agendamento->status_pagamento !== 'pago_online') {
                DB::transaction(function () use ($agendamento, $request) {
                    $pagamento = Pagamento::where('agendamento_id', $agendamento->id)->first();
                    $agendamento->update([
                        'status' => 'pendente', 
                        'status_pagamento' => 'pago_online',
                        'pagamento_id' => $pagamento ? $pagamento->id : null,
                        'codigo_verificacao' => (string) mt_rand(1000, 9999), // 👉 Nome correto da coluna aqui também!
                    ]);
                    if ($pagamento) {
                        $pagamento->update([
                            'status' => 'pago',
                            'id_transacao_gateway' => $request->payment_id,
                            'metodo_pagamento' => $request->payment_type ?? 'online',
                            'data_pagamento' => now(),
                        ]);
                    }
                });
            }
            return redirect()->route('dashboard')->with('success', 'Pagamento aprovado! O seu PIN de segurança foi gerado.');
        } 
        elseif (in_array($statusMP, ['pending', 'in_process'])) return redirect()->route('dashboard')->with('warning', 'Processando pagamento. Avisaremos assim que confirmar!');
        else return redirect()->route('dashboard')->with('error', 'O pagamento não foi concluído. Tente novamente.');
    }

    public function pagarNovamente($id)
    {
        try {
            $agendamento = Agendamento::with(['servico', 'estabelecimento'])->find($id);
            if (!$agendamento) return back()->with('error', 'Agendamento não encontrado.');
            if ($agendamento->usuario_id != Auth::id()) return back()->with('error', 'Acesso negado.');
            if ($agendamento->status_pagamento === 'pago_online') return back()->with('success', 'Já está pago!');
            if ($agendamento->status === 'cancelado') return back()->with('error', 'Já foi cancelado.');

            $dataAgendamento = Carbon::parse($agendamento->data_agendamento . ' ' . $agendamento->hora_agendamento);
            $limite = ($agendamento->created_at ?: now())->diffInHours($dataAgendamento) > 2 ? $dataAgendamento->copy()->subHours(2) : $dataAgendamento;

            if (now()->isAfter($limite)) {
                $agendamento->update(['status' => 'cancelado', 'status_pagamento' => 'cancelado']);
                return back()->with('error', 'Tempo limite expirado. Agendamento cancelado.');
            }

            if (!$agendamento->servico) return back()->with('error', 'Serviço inexistente.');

            $pagamento = Pagamento::where('agendamento_id', $agendamento->id)->first();
            $valorTaxaApp = $pagamento ? $pagamento->taxa : 0;
            $tokenSalao = $agendamento->estabelecimento->token_mercadopago ?? null;

            $preference = $this->mpService->criarCheckout($agendamento, $agendamento->servico, $valorTaxaApp, $tokenSalao);
            
            if (!isset($preference['init_point'])) return back()->with('error', 'Serviço indisponível no momento.');

            if ($pagamento) $pagamento->update(['id_transacao_gateway' => $preference['id']]);
            
            return Inertia::location($preference['init_point']);

        } catch (Exception $e) {
            return back()->with('error', 'Erro temporário ao gerar pagamento. Tente novamente.');
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

            // Se foi pago no app, tenta estornar
            if ($agendamento->status_pagamento === 'pago_online' && $pagamento && $pagamento->id_transacao_gateway) {
                
                $tokenSalao = $agendamento->estabelecimento->token_mercadopago ?? null;
                
                try {
                    $this->mpService->estornarPagamento($pagamento->id_transacao_gateway, $tokenSalao);
                } catch (Exception $e) {
                    return back()->with('error', 'Falha ao processar o estorno no Mercado Pago. O cancelamento foi abortado por segurança.');
                }

                $pagamento->update(['status' => 'estornado']);
                $agendamento->update(['status' => 'cancelado', 'status_pagamento' => 'estornado']);
                
                return back()->with('success', 'Agendamento cancelado! O valor foi estornado e será devolvido à sua conta.');
            }

            // Se foi pagamento no local ou pendente
            $agendamento->update(['status' => 'cancelado', 'status_pagamento' => 'cancelado']);
            if ($pagamento && $pagamento->status !== 'pago') {
                $pagamento->update(['status' => 'cancelado']);
            }

            return back()->with('success', 'Agendamento cancelado com sucesso. A sua vaga foi libertada.');

        } catch (Exception $e) {
            return back()->with('error', 'Ocorreu um erro ao tentar cancelar. Tente novamente.');
        }
    }
}