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
        ]);

        $servico = $estabelecimento->servicos()->findOrFail($validated['servico_id']);

        $funcionarioId = null;
        if (is_array($servico->configuracoes) && isset($servico->configuracoes['funcionario_padrao'])) {
            $funcionarioId = $servico->configuracoes['funcionario_padrao'];
        }

        try {
            DB::beginTransaction();

            // 1. Cria o Agendamento
            $agendamento = Agendamento::create([
                'estabelecimento_id' => $estabelecimento->id,
                'usuario_id'         => Auth::id(),
                'servico_id'         => $servico->id,
                'funcionario_id'     => $funcionarioId,
                'data_agendamento'   => $validated['data_agendamento'],
                'hora_agendamento'   => $validated['hora_agendamento'],
                'status'             => 'aguardando_pagamento', 
                'status_pagamento'   => 'pendente',
                'valor_final'        => $servico->valor,
                'codigo_verificacao' => null,
            ]);

            // 2. Cria o Pagamento
            $pagamento = Pagamento::create([
                'usuario_id'         => Auth::id(),
                'estabelecimento_id' => $estabelecimento->id,
                'agendamento_id'     => $agendamento->id,
                'gateway_pagamento'  => 'mercadopago',
                'valor'              => $servico->valor,
                'taxa'               => 0, 
                'valor_liquido'      => $servico->valor,
                'status'             => 'pendente',
                'metodo_pagamento'   => 'online', 
            ]);

            // 3. CHAMA O MERCADO PAGO E GERA O LINK
            $preference = $this->mpService->criarCheckout($agendamento, $servico);

            if (!isset($preference['init_point'])) {
                throw new Exception('A API do Mercado Pago não devolveu o link de pagamento.');
            }

            $pagamento->update(['id_transacao_gateway' => $preference['id']]);

            DB::commit();

            // 4. INERTIA REDIRECIONA PARA O MERCADO PAGO (Isso resolve o erro!)
            return Inertia::location($preference['init_point']);

        } catch (Exception $e) {
            DB::rollBack(); 
            // VAMOS FORÇAR O ERRO A APARECER NA TELA CASO AINDA DÊ PROBLEMA:
            throw $e;
        }
    }

    public function pagamentoSucesso(Request $request, Agendamento $agendamento)
    {
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

    public function pagamentoFalha(Request $request, Agendamento $agendamento)
    {
        if ($agendamento->status === 'aguardando_pagamento') {
            DB::transaction(function () use ($agendamento) {
                Pagamento::where('agendamento_id', $agendamento->id)->update(['status' => 'cancelado']);
                $agendamento->delete();
            });
        }

        return redirect()->route('dashboard')->withErrors(['pagamento' => 'O pagamento não foi concluído. Agendamento cancelado.']);
    }
}