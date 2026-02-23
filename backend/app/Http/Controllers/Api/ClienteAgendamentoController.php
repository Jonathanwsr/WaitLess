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

    public function __construct(MercadoPagoService $mpService)
    {
        $this->mpService = $mpService;
    }

    public function show(Estabelecimento $estabelecimento)
    {
        if (!$estabelecimento->ativo) {
            abort(404, 'Este estabelecimento está temporariamente fechado para agendamentos.');
        }

        $servicos = $estabelecimento->servicos()->where('ativo', true)->get();

        return Inertia::render('Agendamentos/Agendar', [
            'estabelecimento' => $estabelecimento->only(['id', 'nome', 'foto_perfil', 'bairro', 'cidade', 'estado', 'telefone']),
            'servicos' => $servicos
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
        if ($dataHoraAgendada->isPast()) {
            return back()->withErrors(['hora_agendamento' => 'Não é possível agendar um horário que já passou!']);
        }

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

            $codigoPin = $isPresencial ? str_pad(mt_rand(0, 9999), 4, '0', STR_PAD_LEFT) : null;

            $agendamento = Agendamento::create([
                'estabelecimento_id' => $estabelecimento->id,
                'usuario_id'         => Auth::id(),
                'servico_id'         => $servico->id,
                'funcionario_id'     => $funcionarioId,
                'data_agendamento'   => $validated['data_agendamento'],
                'hora_agendamento'   => $validated['hora_agendamento'],
                'status'             => $isPresencial ? 'pendente' : 'aguardando_pagamento', 
                'status_pagamento'   => $isPresencial ? 'presencial' : 'pendente',
                'valor_final'        => $servico->valor,
                'codigo_verificacao' => $codigoPin,
            ]);

            $pagamento = Pagamento::create([
                'usuario_id'         => Auth::id(),
                'estabelecimento_id' => $estabelecimento->id,
                'agendamento_id'     => $agendamento->id,
                'gateway_pagamento'  => $isPresencial ? null : 'mercadopago',
                'valor'              => $servico->valor,
                'taxa'               => 0, 
                'valor_liquido'      => $servico->valor,
                'status'             => 'pendente',
                'metodo_pagamento'   => $isPresencial ? 'presencial' : 'online', 
            ]);

            $preference = null;
            // 👉 CORREÇÃO AQUI: Só chama o Mercado Pago se a escolha for pagar AGORA
            if ($formaEscolhida === 'online_agora') {
                $preference = $this->mpService->criarCheckout($agendamento, $servico);
                if (!isset($preference['init_point'])) {
                    throw new Exception('A API do Mercado Pago não devolveu o link de pagamento.');
                }
                $pagamento->update(['id_transacao_gateway' => $preference['id']]);
            }

            DB::commit();

          
            if ($formaEscolhida === 'online_agora') {
            
                return Inertia::location($preference['init_point']);
            } 
            elseif ($formaEscolhida === 'online_depois') {
              
                return redirect()->route('dashboard')->with('warning', 'Sua vaga está reservada! Finalize o pagamento online pelo painel antes que o prazo expire.');
            } 
            else { 
              
                return redirect()->route('dashboard')->with('success', 'Agendamento confirmado! O pagamento será realizado no local. Seu PIN já está disponível.');
            }

        } catch (Exception $e) {
            DB::rollBack(); 
            throw $e;
        }
    }

    public function callbackMercadoPago(Request $request)
    {
        $statusMP = $request->query('status'); 
        $agendamentoId = $request->query('external_reference');
        $agendamento = Agendamento::find($agendamentoId);

        if (!$agendamento) return redirect()->route('dashboard')->with('warning', 'Agendamento não localizado.');

        if ($statusMP === 'approved') {
            if ($agendamento->status_pagamento !== 'pago') {
                $codigoPin = str_pad(mt_rand(0, 9999), 4, '0', STR_PAD_LEFT);
                DB::transaction(function () use ($agendamento, $request, $codigoPin) {
                    $pagamento = Pagamento::where('agendamento_id', $agendamento->id)->first();
                    $agendamento->update([
                        'status' => 'pendente', 
                        'status_pagamento' => 'pago',
                        'pagamento_id' => $pagamento ? $pagamento->id : null,
                        'codigo_verificacao' => $codigoPin,
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
        elseif (in_array($statusMP, ['pending', 'in_process'])) {
            return redirect()->route('dashboard')->with('warning', 'Estamos processando seu pagamento. Assim que confirmado, avisaremos!');
        } else {
            return redirect()->route('dashboard')->with('warning', 'O pagamento não foi concluído. Você pode tentar novamente pelo painel.');
        }
    }

     // FUNÇÃO FINAL: Com redirecionamento e mensagens amigáveis em caso de erro
    public function pagarNovamente($id)
    {
        try {
            $agendamento = Agendamento::find($id);
            
            if (!$agendamento) {
                return back()->with('error', 'Agendamento não encontrado.');
            }

            if ($agendamento->usuario_id != Auth::id()) {
                return back()->with('error', 'Você não tem permissão para acessar este pagamento.');
            }

            if ($agendamento->status_pagamento === 'pago') {
                return back()->with('success', 'Este agendamento já está pago!');
            }

            if ($agendamento->status === 'cancelado') {
                return back()->with('error', 'Este agendamento já foi cancelado.');
            }

            $dataHoraAgendamento = Carbon::parse($agendamento->data_agendamento . ' ' . $agendamento->hora_agendamento);
            $dataHoraCriacao = $agendamento->created_at ?: now();
            
            $horasDiferenca = $dataHoraCriacao->diffInHours($dataHoraAgendamento);
            $limitePagamento = $horasDiferenca > 2 ? $dataHoraAgendamento->copy()->subHours(2) : $dataHoraAgendamento;

            if (now()->isAfter($limitePagamento)) {
                $agendamento->update(['status' => 'cancelado', 'status_pagamento' => 'cancelado']);
                return back()->with('error', 'O tempo limite expirou. Agendamento cancelado.');
            }

            $servico = $agendamento->servico;
            if (!$servico) {
                return back()->with('error', 'Erro: O serviço atrelado não existe mais.');
            }

            $preference = $this->mpService->criarCheckout($agendamento, $servico);
            
            if (!isset($preference['init_point'])) {
               
                return back()->with('error', 'Serviço de pagamento indisponível no momento. Tente novamente mais tarde.');
            }

            Pagamento::where('agendamento_id', $agendamento->id)->update(['id_transacao_gateway' => $preference['id']]);
            
            return Inertia::location($preference['init_point']);

        } catch (Exception $e) {
           
            return back()->with('error', 'Não foi possível gerar o pagamento no momento. Tente novamente mais tarde.');
        }
    }
    
}