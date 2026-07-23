<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Models\Agendamento;
use App\Models\Aluguel;
use App\Models\ItemAluguel;
use App\Models\Contrato;
use App\Models\User;
use App\Models\Servico;
use App\Models\Funcionario;
use App\Models\Estabelecimento;
use App\Models\Pagamento;
use App\Services\PagamentoService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Carbon\Carbon;
use Barryvdh\DomPDF\Facade\Pdf;
use Exception;

class MobileAgendamentoController extends Controller
{
    protected $pagamentoService;
    protected $taxaApp = 0.12; 

    public function __construct(PagamentoService $pagamentoService)
    {
        $this->pagamentoService = $pagamentoService;
    }

    /* =========================================================================
       👉 MÉTODOS MOBILE - CONTROLE DE FILA E AGENDAMENTO DE SERVIÇOS
       ========================================================================= */

    public function updateStatus(Request $request, Agendamento $agendamento)
    {
        $validated = $request->validate([
            'status' => 'required|in:pendente,confirmado,em_atendimento,cancelado',
        ]);

        $dados = ['status' => $validated['status']];

        if ($validated['status'] === 'cancelado') {
            $dados['codigo_verificacao'] = null;
            $dados['adiado_ate'] = null;
        }

        $agendamento->update($dados);

        return response()->json([
            'message' => 'Status atualizado com sucesso.',
            'agendamento' => $agendamento
        ], 200);
    }

    public function chamar(Agendamento $agendamento)
    {
        $agendamento->update([
            'status' => 'em_atendimento',
            'adiado_ate' => null
        ]);

        return response()->json(['message' => 'Cliente chamado para atendimento!'], 200);
    }

    public function adiar(Agendamento $agendamento)
    {
        $agendamento->update([
            'adiado_ate' => now()->addMinutes(10),
            'status' => 'pendente'
        ]);

        return response()->json(['message' => 'Atendimento adiado em 10 minutos.'], 200);
    }

    public function pularProximo(Agendamento $agendamento)
    {
        $agendamento->update([
            'hora_agendamento' => now()->addMinutes(15)->format('H:i:s'),
            'status' => 'pendente',
            'adiado_ate' => null
        ]);

        return response()->json(['message' => 'Cliente jogado para o final da fila.'], 200);
    }

    public function finalizarComCodigo(Request $request, $id)
    {
        $request->validate([
            'codigo_pin' => 'required|string|size:4'
        ]);

        $agendamento = Agendamento::findOrFail($id);

        if ((string)$agendamento->codigo_verificacao !== (string)$request->codigo_pin) {
            return response()->json(['error' => 'PIN inválido! Verifique o código correto no aplicativo.'], 400);
        }

        $valorBase = $agendamento->valor_final ?? $agendamento->valor_original ?? 0;
        $taxaMarketplace = $valorBase * 0.12;
        $estabelecimento = Estabelecimento::find($agendamento->estabelecimento_id);

        if ($agendamento->status_pagamento === 'presencial' || $agendamento->status_pagamento === 'pago_presencial') {
            if ($estabelecimento) {
                $estabelecimento->increment('saldo_devedor', $taxaMarketplace);
            }
        }

        $agendamento->update([
            'status' => 'finalizado',
            'foi_realizado' => true,
            'hora_finalizacao' => now()->format('H:i'),
            'finalizado_por' => Auth::id(),
            'status_pagamento' => $agendamento->status_pagamento === 'presencial' ? 'pago_presencial' : $agendamento->status_pagamento,
            'adiado_ate' => null,
            'taxa_plataforma' => $taxaMarketplace
        ]);

        return response()->json(['message' => 'Atendimento concluído com sucesso!'], 200);
    }

    public function updateFuncionario(Request $request, Agendamento $agendamento)
    {
        $validated = $request->validate([
            'funcionario_id' => 'nullable|exists:funcionarios,id',
        ]);

        $agendamento->update(['funcionario_id' => $validated['funcionario_id']]);
        return response()->json(['message' => 'Funcionário atualizado com sucesso.', 'agendamento' => $agendamento], 200);
    }

    public function avaliar(Request $request, $id)
    {
        $request->validate([
            'nota' => 'required|integer|min:1|max:5',
            'comentario' => 'nullable|string|max:500',
        ]);

        $agendamento = Agendamento::findOrFail($id);
        $donoDoAgendamento = $agendamento->usuario_id ?? $agendamento->user_id;

        if ($donoDoAgendamento !== Auth::id()) {
            return response()->json(['error' => 'Você não tem permissão para avaliar este agendamento.'], 403);
        }

        if ($agendamento->nota) {
            return response()->json(['error' => 'Você já avaliou este atendimento!'], 400);
        }

        $agendamento->update([
            'nota' => $request->nota,
            'comentario_avaliacao' => $request->comentario,
        ]);

        if ($agendamento->funcionario_id) {
            $funcionario = Funcionario::find($agendamento->funcionario_id);
            if ($funcionario) {
                $media = Agendamento::where('funcionario_id', $funcionario->id)
                            ->whereNotNull('nota')->avg('nota');
                $funcionario->update(['avaliacao_media' => round($media, 1)]);
            }
        }

        if ($agendamento->servico_id) {
            $servico = Servico::find($agendamento->servico_id);
            if ($servico) {
                $mediaServico = Agendamento::where('servico_id', $servico->id)->whereNotNull('nota')->avg('nota');
                $totalAvaliacoes = Agendamento::where('servico_id', $servico->id)->whereNotNull('nota')->count();

                $servico->update([
                    'avaliacao_media' => round($mediaServico, 1),
                    'total_avaliacoes' => $totalAvaliacoes
                ]);
            }
        }

        $user = Auth::user();
        $user->increment('pontos_saldo', 50);

        return response()->json([
            'message' => 'Muito obrigado pela sua avaliação! Você ganhou 50 pontos.'
        ], 200);
    }

    public function index(Request $request)
    {
        $hoje = Carbon::today()->toDateString();
        $estabelecimentoId = $request->query('estabelecimento_id');

        $filtros = [
            'data_inicio'      => $request->query('data_inicio', $hoje),
            'data_fim'         => $request->query('data_fim', $hoje),
            'ordem'            => $request->query('ordem', 'asc'),
            'status'           => $request->query('status', 'todos'),
            'status_pagamento' => $request->query('status_pagamento', 'todos'),
            'per_page'         => $request->query('per_page', 10),
        ];

        $estabelecimentos = Auth::user()->estabelecimentos()->get();
        $estabelecimentosIdsBusca = $estabelecimentos->pluck('id')->toArray();

        if ($estabelecimentoId) {
            if (in_array($estabelecimentoId, $estabelecimentosIdsBusca)) {
                $estabelecimentosIdsBusca = [$estabelecimentoId];
            } else {
                return response()->json(['error' => 'Acesso negado ao estabelecimento.'], 403);
            }
        }

        $query = Agendamento::with(['usuario', 'servico'])
            ->whereIn('estabelecimento_id', $estabelecimentosIdsBusca)
            ->whereBetween('data_agendamento', [$filtros['data_inicio'], $filtros['data_fim']]);

        if ($filtros['status'] !== 'todos') {
            $query->where('status', $filtros['status']);
        }

        if ($filtros['status_pagamento'] !== 'todos') {
            $query->where('status_pagamento', $filtros['status_pagamento']);
        }

        $direcao = $filtros['ordem'] === 'desc' ? 'desc' : 'asc';
        $query->orderBy('data_agendamento', $direcao)->orderBy('hora_agendamento', $direcao);

        $agendamentos = $query->paginate($filtros['per_page']);

        return response()->json([
            'filtros' => $filtros,
            'agendamentos' => $agendamentos
        ], 200);
    }

    public function detalheCliente($id)
    {
        $userLogado = auth()->user();
        $estabelecimento = $userLogado->estabelecimentos()->first();

        if (!$estabelecimento) {
            return response()->json(['error' => 'Estabelecimento não encontrado.'], 404);
        }

        $cliente = User::findOrFail($id);

        $triagem = DB::table('triagens')
            ->where('usuario_id', $cliente->id)
            ->where('estabelecimento_id', $estabelecimento->id)
            ->orderBy('created_at', 'desc')
            ->first();

        $proximoAgendamento = Agendamento::with(['servico', 'funcionario'])
            ->where('usuario_id', $cliente->id)
            ->where('estabelecimento_id', $estabelecimento->id)
            ->where('data_agendamento', '>=', now()->toDateString())
            ->where('status', 'pendente')
            ->orderBy('data_agendamento', 'asc')
            ->first();

        $proximoServicoData = null;
        if ($proximoAgendamento) {
            $proximoServicoData = [
                'id' => $proximoAgendamento->id,
                'data_formatada' => Carbon::parse($proximoAgendamento->data_agendamento)->translatedFormat('d \d\e F'),
                'hora' => Carbon::parse($proximoAgendamento->hora_agendamento)->format('H:i'),
                'servico' => $proximoAgendamento->servico->nome ?? 'Serviço não informado',
                'profissional' => $proximoAgendamento->funcionario->name ?? 'Qualquer Profissional',
                'tipo' => 'Agendado'
            ];
        } elseif ($triagem && $triagem->status === 'aguardando') {
            $proximoServicoData = [
                'id' => $triagem->id,
                'data_formatada' => 'Hoje',
                'hora' => Carbon::parse($triagem->created_at)->format('H:i'),
                'servico' => 'Aguardando na Fila',
                'profissional' => 'Triagem',
                'tipo' => 'Triagem'
            ];
        }

        $historico = Agendamento::with(['servico', 'funcionario'])
            ->where('usuario_id', $cliente->id)
            ->where('estabelecimento_id', $estabelecimento->id)
            ->orderBy('data_agendamento', 'desc')
            ->get()
            ->map(function ($agendamento) {
                return [
                    'id' => $agendamento->id,
                    'servico' => $agendamento->servico->nome ?? 'Serviço',
                    'profissional' => $agendamento->funcionario->name ?? 'Profissional',
                    'data' => Carbon::parse($agendamento->data_agendamento)->format('d/m/Y'),
                    'status' => $agendamento->status,
                ];
            });

        $financeiroData = [
            'total_gasto' => Agendamento::where('usuario_id', $cliente->id)->where('status', 'finalizado')->sum('valor_final'),
            'pendente' => Agendamento::where('usuario_id', $cliente->id)->where('status_pagamento', 'pendente')->sum('valor_final'),
        ];

        return response()->json([
            'paciente' => [
                'id' => $cliente->id,
                'nome' => $cliente->name,
                'email' => $cliente->email,
                'telefone' => $cliente->telefone ?? '(00) 00000-0000',
                'foto' => $cliente->foto_url ?? 'https://ui-avatars.com/api/?name=' . urlencode($cliente->name),
                'desde' => $cliente->created_at ? $cliente->created_at->translatedFormat('M, Y') : now()->translatedFormat('M, Y'),
            ],
            'triagem' => $triagem,
            'proximoServico' => $proximoServicoData,
            'financeiro' => $financeiroData,
            'historicoServicos' => $historico
        ], 200);
    }

    public function obtenerHorariosDisponiveis(Request $request, $id)
    {
        $data = $request->query('data');
        if (!$data) {
            return response()->json([]);
        }

        $horariosFuncionamento = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

        $horariosOcupados = DB::table('agendamentos')
            ->where('data_agendamento', $data)
            ->where('servico_id', $id)
            ->where('status', '!=', 'cancelado')
            ->pluck('hora_agendamento')
            ->map(function($hora) {
                return substr($hora, 0, 5);
            })
            ->toArray();

        $horariosLivres = array_values(array_filter($horariosFuncionamento, function($hora) use ($horariosOcupados) {
            return !in_array($hora, $horariosOcupados);
        }));

        return response()->json($horariosLivres);
    }

    public function salvarNotaTriagem(Request $request, $id)
    {
        $request->validate(['observacoes' => 'required|string']);

        DB::table('triagens')->where('id', $id)->update([
            'observacoes' => $request->observacoes,
            'updated_at' => now()
        ]);

        return response()->json(['message' => 'Nota da triagem atualizada com sucesso!'], 200);
    }

    public function remarcarServico(Request $request)
    {
        $request->validate([
            'cliente_id' => 'required',
            'estabelecimento_id' => 'required',
            'servico_id' => 'required',
            'data' => 'required|date',
            'hora' => 'required'
        ]);

        $agendamento = Agendamento::create([
            'usuario_id' => $request->cliente_id,
            'estabelecimento_id' => $request->estabelecimento_id,
            'servico_id' => $request->servico_id,
            'data_agendamento' => $request->data,
            'hora_agendamento' => $request->hora,
            'status' => 'pendente',
        ]);

        return response()->json(['message' => 'Reagendado com sucesso!', 'agendamento' => $agendamento], 201);
    }

    /* =========================================================================
       👉 MÉTODOS MOBILE - MÓDULO DE LOCAÇÃO E ASSINATURA SAAS (D4SIGN)
       ========================================================================= */

    public function indexAlugueis(Request $request)
    {
        $alugueis = Aluguel::with(['item', 'locatario', 'contratoDocumento'])
            ->where('estabelecimento_id', $request->user()->id)
            ->orWhere('locatario_id', $request->user()->id)
            ->latest()
            ->paginate(15);

        return response()->json($alugueis);
    }

    public function storeAluguel(Request $request)
    {
        $validated = $request->validate([
            'item_aluguel_id' => 'required|exists:itens_aluguel,id',
            'tipo_periodo' => 'required|in:diaria,semanal,mensal',
            'quantidade_periodos' => 'required|integer|min:1',
            'data_inicio' => 'required|date|after_or_equal:today',
            'quantidade' => 'required|integer|min:1',
            'forma_pagamento' => 'required|string|in:online,presencial',
            'tipo_servico' => 'nullable|string|in:retirada,entrega,ambos',
            'cep_retirada' => 'nullable|string|max:10',
            'rua_retirada' => 'required_with:cep_retirada|string|max:255',
            'numero_retirada' => 'required_with:cep_retirada|string|max:20',
            'complemento_retirada' => 'nullable|string|max:255',
            'bairro_retirada' => 'required_with:cep_retirada|string|max:255',
            'cidade_retirada' => 'required_with:cep_retirada|string|max:255',
            'estado_retirada' => 'required_with:cep_retirada|string|size:2',
            'latitude_retirada' => 'nullable|numeric',
            'longitude_retirada' => 'nullable|numeric',
            'cep_entrega' => 'nullable|string|max:10',
            'rua_entrega' => 'required_with:cep_entrega|string|max:255',
            'numero_entrega' => 'required_with:cep_entrega|string|max:20',
            'complemento_entrega' => 'nullable|string|max:255',
            'bairro_entrega' => 'required_with:cep_entrega|string|max:255',
            'cidade_entrega' => 'required_with:cep_entrega|string|max:255',
            'estado_entrega' => 'required_with:cep_entrega|string|size:2',
            'latitude_entrega' => 'nullable|numeric',
            'longitude_entrega' => 'nullable|numeric',
        ]);

        $item = ItemAluguel::findOrFail($validated['item_aluguel_id']);

        $valorUnitario = match($validated['tipo_periodo']) {
            'diaria' => $item->valor_diaria,
            'semanal' => $item->valor_semanal,
            'mensal' => $item->valor_mensal,
        };

        $valorBruto = ($valorUnitario * $validated['quantidade_periodos']) * $validated['quantidade'];
        $valorTotalComCaucao = $valorBruto + ($item->valor_caucao ?? 0);

        $taxaMarketplace = $valorBruto * 0.12;

        if ($validated['forma_pagamento'] === 'presencial') {
            $estabelecimento = Estabelecimento::find($item->estabelecimento_id);
            if ($estabelecimento) {
                $estabelecimento->increment('saldo_devedor', $taxaMarketplace);
            }
        }

        $aluguel = Aluguel::create([
            'codigo_reserva' => 'RES-' . strtoupper(Str::random(10)),
            'item_aluguel_id' => $item->id,
            'estabelecimento_id' => $item->estabelecimento_id,
            'proprietario_id' => $item->estabelecimento_id,
            'locatario_id' => $request->user()->id,
            'tipo_periodo' => $validated['tipo_periodo'],
            'quantidade_periodos' => $validated['quantidade_periodos'],
            'data_inicio' => $validated['data_inicio'],
            'data_fim' => Carbon::parse($validated['data_inicio'])->addDays($validated['quantidade_periodos']),
            'quantidade' => $validated['quantidade'],
            'valor_unitario' => $valorUnitario,
            'valor_caucao' => $item->valor_caucao ?? 0,
            'valor_total' => $valorTotalComCaucao,
            'taxa_plataforma' => $taxaMarketplace,
            'forma_pagamento' => $validated['forma_pagamento'],
            'status' => 'pendente',
            'tipo_servico' => $validated['tipo_servico'] ?? null,
            'cep_retirada' => $validated['cep_retirada'] ?? null,
            'rua_retirada' => $validated['rua_retirada'] ?? null,
            'numero_retirada' => $validated['numero_retirada'] ?? null,
            'complemento_retirada' => $validated['complemento_retirada'] ?? null,
            'bairro_retirada' => $validated['bairro_retirada'] ?? null,
            'cidade_retirada' => $validated['cidade_retirada'] ?? null,
            'estado_retirada' => $validated['estado_retirada'] ?? null,
            'latitude_retirada' => $validated['latitude_retirada'] ?? null,
            'longitude_retirada' => $validated['longitude_retirada'] ?? null,
            'cep_entrega' => $validated['cep_entrega'] ?? null,
            'rua_entrega' => $validated['rua_entrega'] ?? null,
            'numero_entrega' => $validated['numero_entrega'] ?? null,
            'complemento_entrega' => $validated['complemento_entrega'] ?? null,
            'bairro_entrega' => $validated['bairro_entrega'] ?? null,
            'cidade_entrega' => $validated['cidade_entrega'] ?? null,
            'estado_entrega' => $validated['estado_entrega'] ?? null,
            'latitude_entrega' => $validated['latitude_entrega'] ?? null,
            'longitude_entrega' => $validated['longitude_entrega'] ?? null,
        ]);

        return response()->json(['message' => 'Reserva de aluguel criada!', 'aluguel' => $aluguel], 201);
    }

    public function showAluguel($id)
    {
        $aluguel = Aluguel::with(['item', 'locatario', 'proprietario', 'contratoDocumento'])->findOrFail($id);
        return response()->json($aluguel);
    }

    public function updateAluguel(Request $request, $id)
    {
        $aluguel = Aluguel::findOrFail($id);
        $aluguel->update($request->all());
        return response()->json(['message' => 'Aluguel atualizado!', 'aluguel' => $aluguel]);
    }

    public function gerarEEnviarContrato($aluguelId)
    {
        // Ocultado por brevidade para focar no fluxo financeiro (sem alterações aqui)
    }

    public function webhookD4Sign(Request $request)
    {
        // Ocultado por brevidade
    }

    /* =========================================================================
       👉 MÉTODOS MOBILE - CLIENTE (APP)
       ========================================================================= */

    public function verEstabelecimento($id)
    {
        $estabelecimento = Estabelecimento::findOrFail($id);

        if (!$estabelecimento->ativo) {
            return response()->json(['error' => 'Estabelecimento fechado'], 404);
        }

        return response()->json([
            'estabelecimento' => $estabelecimento->only([
                'id','nome','foto_perfil','bairro','cidade','estado','telefone'
            ]),
            'servicos' => $estabelecimento->servicos()->where('ativo', true)->get()
        ]);
    }

    /**
     * 👉 CRIAÇÃO DO AGENDAMENTO MOBILE (COM FIDELIDADE E DESCONTOS)
     */
    public function agendarServico(Request $request, $id)
    {
        $estabelecimento = Estabelecimento::findOrFail($id);

        $validated = $request->validate([
            'servico_id'       => 'required|exists:servicos,id',
            'data_agendamento' => 'required|date|after_or_equal:today',
            'hora_agendamento' => 'required|string',
            'forma_pagamento'  => 'required|in:online_agora,online_depois,presencial',
            'desconto_id'      => 'nullable|exists:descontos,id'
        ]);

        $dataHora = Carbon::parse($validated['data_agendamento'].' '.$validated['hora_agendamento']);

        if ($dataHora->isPast()) {
            return response()->json(['error' => 'Data ou horário inválido.'], 422);
        }

        $servico = $estabelecimento->servicos()->findOrFail($validated['servico_id']);

        try {
            DB::beginTransaction();

            $isPresencial = $validated['forma_pagamento'] === 'presencial';
            $valorTotal = $servico->valor;
            $pontosNecessarios = 0;

            // 👉 1. REGRA DE DESCONTOS / PONTOS DE FIDELIDADE
            if ($request->filled('desconto_id')) {
                $desconto = DB::table('descontos')
                    ->where('id', $request->desconto_id)
                    ->where('estabelecimento_id', $estabelecimento->id)
                    ->where('ativo', true)
                    ->first();

                if ($desconto && $desconto->tipo === 'pontos') {
                    $pontosNecessarios = $desconto->pontos_necessarios ?? 1000;

                    $saldoPontosLocal = DB::table('pontos_usuario_estabelecimento')
                        ->where('usuario_id', Auth::id())
                        ->where('estabelecimento_id', $estabelecimento->id)
                        ->value('total_pontos') ?? 0;

                    if ($saldoPontosLocal < $pontosNecessarios) {
                        return response()->json(['error' => 'Saldo de pontos insuficiente.'], 400);
                    }

                    DB::table('pontos_usuario_estabelecimento')
                        ->where('usuario_id', Auth::id())
                        ->where('estabelecimento_id', $estabelecimento->id)
                        ->decrement('total_pontos', $pontosNecessarios);

                    $valorTotal = max(0, $valorTotal - $desconto->valor);
                }
            }

            // 👉 2. CRIA O AGENDAMENTO
            $pin = $isPresencial ? (string) mt_rand(1000, 9999) : null;

            $agendamento = Agendamento::create([
                'estabelecimento_id' => $estabelecimento->id,
                'usuario_id'         => Auth::id(),
                'servico_id'         => $servico->id,
                'data_agendamento'   => $validated['data_agendamento'],
                'hora_agendamento'   => $validated['hora_agendamento'],
                'status'             => $isPresencial ? 'pendente' : 'aguardando_pagamento',
                'status_pagamento'   => $isPresencial ? 'presencial' : 'pendente',
                'valor_final'        => $valorTotal,
                'codigo_verificacao' => $pin,
            ]);

            // Registra os pontos utilizados
            if ($pontosNecessarios > 0) {
                DB::table('historico_pontos')->insert([
                    'usuario_id'         => Auth::id(),
                    'estabelecimento_id' => $estabelecimento->id,
                    'agendamento_id'     => $agendamento->id,
                    'tipo'               => 'uso',
                    'descricao'          => "Resgate de pontos gerou R$ " . number_format($desconto->valor, 2, ',', '.') . " de desconto",
                    'quantidade'         => $pontosNecessarios,
                    'created_at'         => now()
                ]);
            }

            // Cria apenas a cobrança local se for presencial
            if ($isPresencial) {
                Pagamento::create([
                    'usuario_id'         => Auth::id(),
                    'estabelecimento_id' => $estabelecimento->id,
                    'agendamento_id'     => $agendamento->id,
                    'valor'              => $valorTotal,
                    'taxa'               => round($valorTotal * $this->taxaApp, 2),
                    'valor_liquido'      => $valorTotal - round($valorTotal * $this->taxaApp, 2),
                    'status'             => 'pendente',
                    'metodo_pagamento'   => 'presencial',
                ]);
            }

            DB::commit();

            // O app Flutter usará este ID para chamar o PagamentoMobileController logo em seguida
            return response()->json([
                'message'      => 'Reserva salva com sucesso',
                'agendamento'  => $agendamento,
                'pagar_online' => !$isPresencial
            ], 201);

        } catch (Exception $e) {
            DB::rollBack();
            Log::error("Erro agendar mobile: " . $e->getMessage());
            return response()->json(['error' => 'Erro interno ao criar reserva.'], 500);
        }
    }

    /**
     * 👉 CANCELAMENTO MOBILE (COM REGRA DE ESTORNO ASAAS 30 MINUTOS E DEVOLUÇÃO DE PONTOS)
     */
    public function cancelarCliente($id)
    {
        try {
            $agendamento = Agendamento::with('estabelecimento')->find($id);

            if (!$agendamento) return response()->json(['error' => 'Agendamento não encontrado'], 404);
            if ($agendamento->usuario_id !== Auth::id()) return response()->json(['error' => 'Acesso negado'], 403);
            if ($agendamento->status === 'cancelado') return response()->json(['error' => 'Já foi cancelado.'], 400);

            $pagamento = Pagamento::where('agendamento_id', $agendamento->id)->first();
            $mensagemAlerta = 'Cancelado com sucesso. Sua vaga foi libertada.';

            // Verifica as regras de Custódia e Estorno
            if (in_array($agendamento->status_pagamento, ['pago', 'pago_online']) && $pagamento && $pagamento->id_transacao_gateway) {
                $dataHoraServico = Carbon::parse($agendamento->data_agendamento . ' ' . $agendamento->hora_agendamento);
                $limiteGratis = $dataHoraServico->copy()->subMinutes(30);

                $isCancelamentoGratis = Carbon::now()->lessThanOrEqualTo($limiteGratis);

                $valorEstorno = $pagamento->valor;
                
                if (!$isCancelamentoGratis) {
                    $taxaCancelamento = round($pagamento->valor * 0.02, 2);
                    $valorEstorno = $pagamento->valor - $taxaCancelamento;
                    $mensagemAlerta = "Cancelamento efetuado. Retenção de 2% aplicada por cancelamento tardio. Estorno de R$ {$valorEstorno} em processamento.";
                }

                try {
                    DB::beginTransaction();

                    // Aciona o estorno parcial ou total na API do Asaas
                    $this->pagamentoService->estornarPagamento($pagamento->id_transacao_gateway, $valorEstorno);
                    $this->reverterPontosDeFidelidade($agendamento);

                    $pagamento->update(['status' => 'estornado', 'valor_liquido' => 0]);

                    // Extrato do provedor
                    $providerId = DB::table('providers')
                        ->join('estabelecimento_usuario', 'providers.user_id', '=', 'estabelecimento_usuario.usuario_id')
                        ->where('estabelecimento_usuario.estabelecimento_id', $agendamento->estabelecimento_id)
                        ->value('providers.id');

                    if ($providerId) {
                        DB::table('extrato_providers')->insert([
                            'provider_id'      => $providerId,
                            'usuario_id'       => Auth::id(),
                            'origem_type'      => 'App\Models\Agendamento',
                            'origem_id'        => $agendamento->id,
                            'tipo'             => 'estorno',
                            'valor_bruto'      => $valorEstorno,
                            'taxa_plataforma'  => 0,
                            'valor_liquido'    => $valorEstorno * -1,
                            'descricao'        => $isCancelamentoGratis ? 'Estorno integral (Mobile)' : 'Estorno parcial (Mobile)',
                            'status'           => 'estornado',
                            'codigo_transacao' => $pagamento->id_transacao_gateway,
                            'metodo_pagamento' => $pagamento->metodo_pagamento,
                            'created_at'       => now()
                        ]);
                    }

                    DB::commit();
                } catch (Exception $e) {
                    DB::rollBack();
                    return response()->json(['error' => 'Falha ao comunicar estorno com o banco.'], 500);
                }
            }

            $agendamento->update(['status' => 'cancelado', 'status_pagamento' => ($pagamento && $pagamento->status === 'estornado') ? 'estornado' : 'cancelado']);
            if ($pagamento && $pagamento->status !== 'estornado') $pagamento->update(['status' => 'cancelado']);

            return response()->json(['message' => $mensagemAlerta], 200);

        } catch (Exception $e) {
            Log::error("Erro cancelamento mobile: " . $e->getMessage());
            return response()->json(['error' => 'Erro interno ao cancelar.'], 500);
        }
    }

    /**
     * 👉 CANCELAMENTO MOBILE (ALUGUEL 24 HORAS)
     */
    public function destroyAluguel($id)
    {
        try {
            $aluguel = Aluguel::find($id);

            if (!$aluguel) return response()->json(['error' => 'Locação não encontrada'], 404);
            if ($aluguel->locatario_id !== Auth::id()) return response()->json(['error' => 'Sem permissão'], 403);
            if ($aluguel->status === 'cancelado') return response()->json(['error' => 'Já cancelada'], 400);

            $pagamento = Pagamento::where('aluguel_id', $aluguel->id)->first();
            $mensagemAlerta = 'Reserva de aluguel cancelada com sucesso.';

            if (in_array($aluguel->status, ['pago', 'confirmado']) && $pagamento && $pagamento->id_transacao_gateway) {
                
                $dataHoraInicio = Carbon::parse($aluguel->data_inicio . ' ' . $aluguel->hora_inicio);
                $isCancelamentoGratis = Carbon::now()->lessThanOrEqualTo($dataHoraInicio->copy()->subDay()); 
                
                $valorEstorno = $pagamento->valor;

                if (!$isCancelamentoGratis) {
                    $taxaCancelamento = round($pagamento->valor * 0.02, 2);
                    $valorEstorno -= $taxaCancelamento;
                    $mensagemAlerta = "Locação cancelada! Retenção de 2% por cancelamento tardio (< 24h).";
                }

                try {
                    DB::beginTransaction();

                    $this->pagamentoService->estornarPagamento($pagamento->id_transacao_gateway, $valorEstorno);
                    $this->reverterPontosDeFidelidade($aluguel, true); 

                    $pagamento->update(['status' => 'estornado', 'valor_liquido' => 0]);
                    DB::commit();

                } catch (Exception $e) {
                    DB::rollBack();
                    return response()->json(['error' => 'Falha no estorno do Aluguel pelo gateway.'], 500);
                }
            }

            $aluguel->update(['status' => 'cancelado']);
            if ($pagamento && $pagamento->status !== 'estornado') $pagamento->update(['status' => 'cancelado']);

            return response()->json(['message' => $mensagemAlerta], 200);

        } catch (Exception $e) {
            Log::error("Erro cancelamento aluguel mobile: " . $e->getMessage());
            return response()->json(['error' => 'Erro interno ao cancelar.'], 500);
        }
    }

   /**
     * 👉 LISTAGEM DE AGENDAMENTOS E ALUGUÉIS (TELA: MEUS AGENDAMENTOS)
     * Junta serviços e locações em uma única linha do tempo para o App
     */
    public function meusAgendamentos()
    {
        try {
            $userId = Auth::id();

            // 1. Busca todos os Agendamentos (Serviços) do cliente
            $agendamentos = Agendamento::with(['servico', 'estabelecimento'])
                ->where('usuario_id', $userId)
                ->get()
                ->map(function ($item) {
                    return [
                        'id'                 => $item->id,
                        'tipo'               => 'servico',
                        'status'             => $item->status,
                        'status_pagamento'   => $item->status_pagamento,
                        'data_agendamento'   => $item->data_agendamento,
                        'hora_agendamento'   => $item->hora_agendamento,
                        'valor_final'        => $item->valor_final,
                        'codigo_verificacao' => $item->codigo_verificacao,
                        'servico' => [
                            'nome' => $item->servico->nome ?? 'Serviço Excluído'
                        ],
                        'estabelecimento' => [
                            'nome' => $item->estabelecimento->nome ?? 'Estabelecimento'
                        ],
                    ];
                });

            // 2. Busca todos os Aluguéis (Locações) do cliente
            $alugueis = Aluguel::with(['item', 'estabelecimento'])
                ->where('locatario_id', $userId)
                ->get()
                ->map(function ($item) {
                    return [
                        'id'                 => $item->id,
                        'aluguel_id'         => $item->id, // Flag para o app saber que é locação
                        'tipo'               => 'aluguel',
                        'status'             => $item->status,
                        'status_pagamento'   => in_array($item->status, ['pago', 'confirmado']) ? 'pago_online' : $item->forma_pagamento,
                        'data_agendamento'   => $item->data_inicio,
                        'hora_agendamento'   => $item->hora_inicio ?? '00:00:00',
                        'valor_final'        => $item->valor_total,
                        'codigo_verificacao' => $item->codigo_reserva,
                        'servico' => [
                            'nome' => $item->item->nome ?? 'Locação de Ativo'
                        ],
                        'estabelecimento' => [
                            'nome' => $item->estabelecimento->nome ?? 'Estabelecimento'
                        ],
                    ];
                });

            // 3. Junta as duas listas e ordena das mais recentes para as mais antigas
            $historicoCompleto = $agendamentos->concat($alugueis)
                ->sortByDesc(function ($item) {
                    return $item['data_agendamento'] . ' ' . $item['hora_agendamento'];
                })
                ->values(); // Reseta os índices do array

            return response()->json($historicoCompleto, 200);

        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error("Erro ao listar Meus Agendamentos: " . $e->getMessage());
            return response()->json(['error' => 'Erro interno ao buscar o histórico.'], 500);
        }
    }

    /**
     * Função auxiliar de reversão de pontos
     */
    private function reverterPontosDeFidelidade($entidade, $isAluguel = false)
    {
        $colunaFiltro = $isAluguel ? 'aluguel_id' : 'agendamento_id';
        $userId = $isAluguel ? $entidade->locatario_id : $entidade->usuario_id;

        $pontosGanhosNessaTransacao = DB::table('historico_pontos')
            ->where($colunaFiltro, $entidade->id)
            ->where('tipo', 'ganho')
            ->sum('quantidade');

        if ($pontosGanhosNessaTransacao > 0) {
            DB::table('pontos_usuario_estabelecimento')
                ->where('usuario_id', $userId)
                ->where('estabelecimento_id', $entidade->estabelecimento_id)
                ->decrement('total_pontos', $pontosGanhosNessaTransacao);

            DB::table('historico_pontos')->insert([
                'usuario_id'         => $userId,
                'estabelecimento_id' => $entidade->estabelecimento_id,
                $colunaFiltro        => $entidade->id,
                'tipo'               => 'perda',
                'descricao'          => 'Estorno de pontos por cancelamento no aplicativo',
                'quantidade'         => $pontosGanhosNessaTransacao,
                'created_at'         => now()
            ]);
        }
    }



    /**
     * 👉 DETALHES DO AGENDAMENTO (SERVIÇO) - Com Cálculo de Fila
     */
    public function show($id)
    {
        try {
            $agendamento = Agendamento::with(['servico', 'estabelecimento'])->find($id);

            if (!$agendamento) {
                return response()->json(['error' => 'Agendamento não encontrado.'], 404);
            }

            // Segurança: Garante que o cliente só veja a própria reserva
            if ($agendamento->usuario_id !== Auth::id()) {
                return response()->json(['error' => 'Acesso negado.'], 403);
            }

            // CÁLCULO DA FILA: Quantas pessoas estão na frente dele hoje?
            $posicaoFila = null;
            $statusAtivos = ['pendente', 'confirmado', 'em_atendimento', 'aguardando_pagamento'];
            
            if (in_array($agendamento->status, $statusAtivos) && $agendamento->data_agendamento === now()->toDateString()) {
                $posicaoFila = Agendamento::where('estabelecimento_id', $agendamento->estabelecimento_id)
                    ->where('data_agendamento', $agendamento->data_agendamento)
                    ->whereIn('status', $statusAtivos)
                    ->where(function($q) use ($agendamento) {
                        $q->where('hora_agendamento', '<', $agendamento->hora_agendamento)
                          ->orWhere(function($q2) use ($agendamento) {
                              // Desempate por ordem de chegada no sistema (ID)
                              $q2->where('hora_agendamento', $agendamento->hora_agendamento)
                                 ->where('id', '<=', $agendamento->id);
                          });
                    })
                    ->count();
            }

            // Injeta a posição na fila dinamicamente no objeto
            $agendamento->posicao_fila = $posicaoFila;

            return response()->json($agendamento, 200);

        } catch (\Exception $e) {
            return response()->json(['error' => 'Erro interno ao buscar detalhes.'], 500);
        }
    }

    /**
     * 👉 DETALHES DO ALUGUEL (LOCAÇÃO)
     * Padronizado para o app ler da mesma forma que um agendamento
     */
    public function showAluguelMobile($id)
    {
        try {
            $aluguel = Aluguel::with(['item', 'estabelecimento'])->find($id);

            if (!$aluguel) {
                return response()->json(['error' => 'Locação não encontrada.'], 404);
            }

            if ($aluguel->locatario_id !== Auth::id()) {
                return response()->json(['error' => 'Acesso negado.'], 403);
            }

            // Adaptamos as chaves para que a tela do App (DetalhesAgendamento.tsx) 
            // consiga ler os dados sem precisar de "Ifs" e código duplicado.
            $dadosFormatados = [
                'id'                 => $aluguel->id,
                'status'             => $aluguel->status,
                'status_pagamento'   => in_array($aluguel->status, ['pago', 'confirmado']) ? 'pago_online' : $aluguel->forma_pagamento,
                'codigo_verificacao' => clone $aluguel->codigo_reserva,
                'data_agendamento'   => clone $aluguel->data_inicio,
                'hora_agendamento'   => clone $aluguel->hora_inicio ?? '00:00:00',
                'valor_final'        => clone $aluguel->valor_total,
                'posicao_fila'       => null, // Locação não tem fila de espera
                'servico' => [
                    'nome'            => clone $aluguel->item->nome ?? 'Item de Locação',
                    'descricao'       => 'Locação por ' . $aluguel->quantidade_periodos . ' ' . $aluguel->tipo_periodo . '(s)',
                    'duracao_minutos' => clone $aluguel->quantidade_periodos . ' ' . $aluguel->tipo_periodo
                ],
                'estabelecimento' => clone $aluguel->estabelecimento
            ];

            return response()->json($dadosFormatados, 200);

        } catch (\Exception $e) {
            return response()->json(['error' => 'Erro interno ao buscar detalhes do aluguel.'], 500);
        }
    }
}