<?php

namespace App\Http\Controllers\Api\Mobile;


use App\Http\Controllers\Controller;
use App\Models\Estabelecimento; // Certifique-se de vincular ao Model correto do Usuário/Estabelecimento
use App\Models\Agendamento;
use App\Models\Pagamento;
use App\Models\User;
use App\Services\MercadoPagoService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Carbon\Carbon;
use Exception;

class ClienteAgendamentoMobileController extends Controller
{
    protected $mpService;
    protected $taxaApp = 0.10; // Taxa de 10% do aplicativo para intermediações online

    public function __construct(MercadoPagoService $mpService)
    {
        $this->mpService = $mpService;
    }

    // ==========================================
    // 🔍 PARTE 1: BUSCAS E LISTAGENS (GET)
    // ==========================================

    /**
     * Exibe os dados do estabelecimento e seus serviços disponíveis para agendamento convencional.
     */
    public function obterDadosAgendamento($estabelecimentoId)
    {
        $estabelecimento = User::where('id', $estabelecimentoId)->first();

        if (!$estabelecimento) {
            return response()->json(['error' => 'Estabelecimento não localizado.'], 404);
        }

        // Busca serviços ativos vinculados ao salão/estabelecimento
        $servicos = DB::table('servicos')
            ->where('estabelecimento_id', $estabelecimento->id)
            ->where('ativo', true)
            ->get();

        return response()->json([
            'estabelecimento' => [
                'id' => $estabelecimento->id,
                'nome' => $estabelecimento->name ?? $estabelecimento->nome,
                'foto_perfil' => $estabelecimento->foto_perfil ?? null,
                'bairro' => $estabelecimento->bairro ?? null,
                'cidade' => $estabelecimento->cidade ?? null,
                'estado' => $estabelecimento->estado ?? null,
                'telefone' => $estabelecimento->telefone ?? null,
            ],
            'servicos' => $servicos
        ]);
    }

    /**
     * Exibe os detalhes de um item específico de aluguel e as regras calculadas para a reserva.
     */
    public function obterDadosReserva($itemId)
    {
        $item = DB::table('itens_aluguel')
            ->where('id', $itemId)
            ->where('ativo', true)
            ->where('disponivel', true)
            ->first();

        if (!$item) {
            return response()->json(['error' => 'Item de reserva indisponível ou não localizado.'], 404);
        }

        return response()->json([
            'item' => $item
        ]);
    }

    // ==========================================
    // 📅 PARTE 2: AGENDAMENTO DE SERVIÇOS (STORE)
    // ==========================================

    public function agendarServico(Request $request, $estabelecimentoId)
    {
        $validated = $request->validate([
            'servico_id'       => 'required|exists:servicos,id',
            'data_agendamento' => 'required|date|after_or_equal:today',
            'hora_agendamento' => 'required|string',
            'forma_pagamento'  => 'required|string|in:online_agora,online_depois,presencial',
        ]);

        $estabelecimento = User::findOrFail($estabelecimentoId);

        $dataHoraAgendada = Carbon::parse($validated['data_agendamento'] . ' ' . $validated['hora_agendamento']);
        if ($dataHoraAgendada->isPast()) {
            return response()->json(['error' => 'Não é possível agendar em um horário que já passou!'], 422);
        }

        $servico = DB::table('servicos')->where('estabelecimento_id', $estabelecimento->id)->where('id', $validated['servico_id'])->first();
        if (!$servico) {
            return response()->json(['error' => 'Serviço não pertence a este estabelecimento.'], 404);
        }

        $configuracoes = is_string($servico->configuracoes) ? json_decode($servico->configuracoes, true) : ((array) $servico->configuracoes ?? []);
        $funcionarioId = $configuracoes['funcionario_padrao'] ?? null;
        $tipoPagamentoServico = $configuracoes['tipo_pagamento'] ?? 'hibrido';

        if ($validated['forma_pagamento'] === 'presencial' && $tipoPagamentoServico === 'online') {
            return response()->json(['error' => 'Este serviço aceita apenas pagamento online.'], 422);
        }

        try {
            DB::beginTransaction();

            $formaEscolhida = $validated['forma_pagamento'];
            $isPresencial = ($formaEscolhida === 'presencial');

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
                'status'             => $isPresencial ? 'pendente' : 'aguardando_pagamento',
                'status_pagamento'   => $isPresencial ? 'presencial' : 'pendente',
                'valor_final'        => $valorTotal,
                'codigo_verificacao' => $codigoPin,
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

                if (!isset($preference['init_point'])) {
                    throw new Exception('A API de pagamento falhou em gerar o link.');
                }
                $pagamento->update(['id_transacao_gateway' => $preference['id']]);
            }

            DB::commit();

            return response()->json([
                'message' => 'Agendamento registrado com sucesso!',
                'tipo' => 'servico',
                'forma_pagamento' => $formaEscolhida,
                'agendamento_id' => $agendamento->id,
                'codigo_verificacao' => $codigoPin,
                'payment_url' => $preference ? $preference['init_point'] : null
            ], 201);

        } catch (Exception $e) {
            DB::rollBack();
            return response()->json(['error' => 'Falha interna ao processar agendamento: ' . $e->getMessage()], 500);
        }
    }

    // ==========================================
    // 🚗 PARTE 3: RESERVA / ALUGUEL DE ITENS (STORE)
    // ==========================================

    public function reservarItem(Request $request, $itemId)
    {
        $validated = $request->validate([
            'tipo_periodo'        => 'required|in:diaria,semanal,mensal',
            'quantidade_periodos' => 'required|integer|min:1',
            'data_inicio'         => 'required|date|after_or_equal:today',
            'forma_pagamento'     => 'required|string',

            // Endereços opcionais coletados dinamicamente com base nas tabelas enviadas
            'cep_retirada'         => 'nullable|string|max:10',
            'rua_retirada'         => 'nullable|string|max:255',
            'numero_retirada'      => 'nullable|string|max:20',
            'complemento_retirada' => 'nullable|string|max:255',
            'bairro_retirada'      => 'nullable|string|max:255',
            'cidade_retirada'      => 'nullable|string|max:255',
            'estado_retirada'      => 'nullable|string|max:2',

            'cep_entrega'          => 'nullable|string|max:10',
            'rua_entrega'          => 'nullable|string|max:255',
            'numero_entrega'       => 'nullable|string|max:20',
            'complemento_entrega'  => 'nullable|string|max:255',
            'bairro_entrega'       => 'nullable|string|max:255',
            'cidade_entrega'       => 'nullable|string|max:255',
            'estado_entrega'       => 'nullable|string|max:2',
        ]);

        $item = DB::table('itens_aluguel')->where('id', $itemId)->where('ativo', true)->first();
        if (!$item || !$item->disponivel) {
            return response()->json(['error' => 'Este item não está disponível para locação.'], 422);
        }

        // Calcula dinamicamente as datas finais da locação
        $dataInicio = Carbon::parse($validated['data_inicio']);
        $dataFim = $dataInicio->copy();

        if ($validated['tipo_periodo'] === 'diaria') {
            $dataFim->addDays($validated['quantidade_periodos']);
            $valorUnitario = $item->valor_diaria;
        } elseif ($validated['tipo_periodo'] === 'semanal') {
            $dataFim->addWeeks($validated['quantidade_periodos']);
            $valorUnitario = $item->valor_semanal ?? ($item->valor_diaria * 7);
        } else {
            $dataFim->addMonths($validated['quantidade_periodos']);
            $valorUnitario = $item->valor_mensal ?? ($item->valor_diaria * 30);
        }

        if (!$valorUnitario) {
            return response()->json(['error' => 'A precificação para esta modalidade de período não foi configurada.'], 422);
        }

        try {
            DB::beginTransaction();

            $valorBruto = $valorUnitario * $validated['quantidade_periodos'];
            $valorCaucao = $item->valor_caucao ?? 0.00;
            $taxaServico = round($valorBruto * $this->taxaApp, 2);
            $valorTotalFinal = $valorBruto + $valorCaucao + $taxaServico;

            // Insere diretamente na tabela estruturada de alugueis fornecida
            $aluguelId = DB::table('alugueis')->insertGetId([
                'codigo_reserva'      => 'RES-' . strtoupper(Str::random(8)),
                'numero_contracto'    => null,
                'estabelecimento_id'  => $item->estabelecimento_id,
                'item_aluguel_id'     => $item->id,
                'servico_id'          => $item->servico_id,
                'proprietario_id'     => $item->estabelecimento_id, // Vincula o dono do item
                'locatario_id'        => Auth::id(), // Cliente logado
                'tipo_periodo'        => $validated['tipo_periodo'],
                'quantidade_periodos' => $validated['quantidade_periodos'],
                'data_inicio'         => $dataInicio,
                'data_fim'            => $dataFim,
                'quantidade'          => 1,
                'valor_unitario'      => $valorUnitario,
                'valor_caucao'        => $valorCaucao,
                'taxa_servico'        => $taxaServico,
                'valor_total'         => $valorTotalFinal,
                'forma_pagamento'     => $validated['forma_pagamento'],
                'status'              => 'pendente',
                'created_at'          => now(),
                'updated_at'          => now(),

                // Endereço de Retirada Expandido
                'cep_retirada'         => $validated['cep_retirada'] ?? null,
                'rua_retirada'         => $validated['rua_retirada'] ?? null,
                'numero_retirada'      => $validated['numero_retirada'] ?? null,
                'complemento_retirada' => $validated['complemento_retirada'] ?? null,
                'bairro_retirada'      => $validated['bairro_retirada'] ?? null,
                'cidade_retirada'      => $validated['cidade_retirada'] ?? null,
                'estado_retirada'      => $validated['estado_retirada'] ?? null,

                // Endereço de Entrega/Devolução Expandido
                'cep_entrega'          => $validated['cep_entrega'] ?? null,
                'rua_entrega'          => $validated['rua_entrega'] ?? null,
                'numero_entrega'       => $validated['numero_entrega'] ?? null,
                'complemento_entrega'  => $validated['complemento_entrega'] ?? null,
                'bairro_entrega'       => $validated['bairro_entrega'] ?? null,
                'cidade_entrega'       => $validated['cidade_entrega'] ?? null,
                'estado_entrega'       => $validated['estado_entrega'] ?? null,
            ]);

            DB::commit();

            return response()->json([
                'message' => 'Reserva efetuada com sucesso e aguardando triagem!',
                'tipo' => 'reserva_aluguel',
                'aluguel_id' => $aluguelId,
                'valor_total' => $valorTotalFinal,
                'data_entrega_prevista' => $dataInicio->toDateTimeString(),
                'data_devolucao_prevista' => $dataFim->toDateTimeString()
            ], 201);

        } catch (Exception $e) {
            DB::rollBack();
            return response()->json(['error' => 'Falha interna ao criar reserva: ' . $e->getMessage()], 500);
        }
    }

    // ==========================================
    // 💳 PARTE 4: RETORNOS EXTERNOS DO GATEWAY
    // ==========================================

    public function callbackMercadoPago(Request $request)
    {
        $statusMP = $request->query('status');
        $agendamento = Agendamento::find($request->query('external_reference'));

        if (!$agendamento) {
            return response()->json(['error' => 'Agendamento externo não localizado.'], 404);
        }

        if ($statusMP === 'approved') {
            if ($agendamento->status_pagamento !== 'pago_online') {
                DB::transaction(function () use ($agendamento, $request) {
                    $pagamento = Pagamento::where('agendamento_id', $agendamento->id)->first();
                    $agendamento->update([
                        'status' => 'pendente',
                        'status_pagamento' => 'pago_online',
                        'pagamento_id' => $pagamento ? $pagamento->id : null,
                        'codigo_verificacao' => (string) mt_rand(1000, 9999),
                    ]);
                    if ($pagamento) {
                        $pagamento->update([
                            'status' => 'pago',
                            'id_transacao_gateway' => $request->payment_id,
                            'metodo_pagamento' => $request->payment_type ?? 'online',
                            'data_pagamento' => now(),
                        ]);
                    }
                ]);
            }
            return response()->json(['success' => 'Pagamento capturado e aprovado!', 'pin_liberado' => true]);
        }

        return response()->json(['status' => $statusMP, 'message' => 'O status do pagamento mudou ou falhou.']);
    }
}
