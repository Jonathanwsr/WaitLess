<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Models\Agendamento;
use App\Models\Aluguel;
use App\Models\ItemAluguel;
use App\Models\Servico;
use App\Models\User;
use App\Models\Estabelecimento;
use App\Models\Pagamento;
use App\Services\PagamentoService;
use App\Events\FilaAtualizada;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Carbon\Carbon;
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
        event(new FilaAtualizada($agendamento->estabelecimento_id));

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
        event(new FilaAtualizada($agendamento->estabelecimento_id));

        return response()->json(['message' => 'Cliente chamado para atendimento!'], 200);
    }

    public function adiar(Agendamento $agendamento)
    {
        $agendamento->update([
            'adiado_ate' => now()->addMinutes(10),
            'status' => 'pendente'
        ]);
        event(new FilaAtualizada($agendamento->estabelecimento_id));

        return response()->json(['message' => 'Atendimento adiado em 10 minutos.'], 200);
    }

    public function pularProximo(Agendamento $agendamento)
    {
        $agendamento->update([
            'hora_agendamento' => now()->addMinutes(15)->format('H:i:s'),
            'status' => 'pendente',
            'adiado_ate' => null
        ]);
        event(new FilaAtualizada($agendamento->estabelecimento_id));

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

        event(new FilaAtualizada($agendamento->estabelecimento_id));

        return response()->json(['message' => 'Atendimento concluído com sucesso!'], 200);
    }

    public function updateFuncionario(Request $request, Agendamento $agendamento)
    {
        $validated = $request->validate([
            'funcionario_id' => 'nullable|exists:funcionarios,id',
        ]);

        $agendamento->update(['funcionario_id' => $validated['funcionario_id']]);
        event(new FilaAtualizada($agendamento->estabelecimento_id));

        return response()->json(['message' => 'Funcionário atualizado com sucesso.', 'agendamento' => $agendamento], 200);
    }

    public function avaliar(Request $request, $id)
    {
        $request->validate([
            'nota' => 'required|numeric|min:1|max:5',
            'comentario' => 'nullable|string|max:1000',
            'nota_limpeza' => 'nullable|numeric|min:1|max:5',
            'nota_precisao' => 'nullable|numeric|min:1|max:5',
            'nota_comunicacao' => 'nullable|numeric|min:1|max:5',
            'nota_localizacao' => 'nullable|numeric|min:1|max:5',
            'nota_checkin' => 'nullable|numeric|min:1|max:5',
            'nota_custo_beneficio' => 'nullable|numeric|min:1|max:5',
            'fotos' => 'nullable|array'
        ]);

        $agendamento = Agendamento::findOrFail($id);
        $donoDoAgendamento = $agendamento->usuario_id ?? $agendamento->user_id;

        if ($donoDoAgendamento !== Auth::id()) {
            return response()->json(['error' => 'Você não tem permissão para avaliar este agendamento.'], 403);
        }

        $jaAvaliou = DB::table('avaliacoes')->where('agendamento_id', $agendamento->id)->exists();
        if ($jaAvaliou) {
            return response()->json(['error' => 'Você já avaliou este atendimento!'], 400);
        }

        DB::table('avaliacoes')->insert([
            'usuario_id' => Auth::id(),
            'estabelecimento_id' => $agendamento->estabelecimento_id,
            'agendamento_id' => $agendamento->id,
            'nota' => $request->nota,
            'comentario' => $request->comentario,
            'nota_limpeza' => $request->nota_limpeza,
            'nota_precisao' => $request->nota_precisao,
            'nota_comunicacao' => $request->nota_comunicacao,
            'nota_localizacao' => $request->nota_localizacao,
            'nota_checkin' => $request->nota_checkin,
            'nota_custo_beneficio' => $request->nota_custo_beneficio,
            'publica' => true,
            'fotos' => $request->fotos ? json_encode($request->fotos) : null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        if ($agendamento->servico_id) {
            $servico = Servico::find($agendamento->servico_id);
            if ($servico) {
                $mediaServico = DB::table('avaliacoes')
                    ->join('agendamentos', 'avaliacoes.agendamento_id', '=', 'agendamentos.id')
                    ->where('agendamentos.servico_id', $servico->id)
                    ->avg('avaliacoes.nota');

                $totalAvaliacoes = DB::table('avaliacoes')
                    ->join('agendamentos', 'avaliacoes.agendamento_id', '=', 'agendamentos.id')
                    ->where('agendamentos.servico_id', $servico->id)
                    ->count();

                $servico->update([
                    'avaliacao_media' => round($mediaServico, 1),
                    'total_avaliacoes' => $totalAvaliacoes
                ]);
            }
        }

        Auth::user()->increment('pontos_saldo', 50);

        return response()->json(['message' => 'Muito obrigado pela sua avaliação! Você ganhou 50 pontos.'], 200);
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

        if ($estabelecimentoId && in_array($estabelecimentoId, $estabelecimentosIdsBusca)) {
            $estabelecimentosIdsBusca = [$estabelecimentoId];
        }

        $query = Agendamento::with(['usuario', 'servico'])
            ->whereIn('estabelecimento_id', $estabelecimentosIdsBusca)
            ->whereBetween('data_agendamento', [$filtros['data_inicio'], $filtros['data_fim']]);

        if ($filtros['status'] !== 'todos') $query->where('status', $filtros['status']);
        if ($filtros['status_pagamento'] !== 'todos') $query->where('status_pagamento', $filtros['status_pagamento']);

        $direcao = $filtros['ordem'] === 'desc' ? 'desc' : 'asc';
        $query->orderBy('data_agendamento', $direcao)->orderBy('hora_agendamento', $direcao);

        return response()->json([
            'filtros' => $filtros,
            'agendamentos' => $query->paginate($filtros['per_page'])
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

    /**
     * 👉 HORÁRIOS DISPONÍVEIS (PUXANDO DO BANCO DE DADOS E LENDO JSON CORRETAMENTE)
     */
    public function obtenerHorariosDisponiveis(Request $request, $id)
    {
        $data = $request->query('data');
        $tipo = $request->query('tipo', 'servico');

        if (!$data) return response()->json([]);

        $horariosFuncionamento = [];
        $horariosOcupados = [];

        try {
            if ($tipo === 'aluguel') {
                $item = ItemAluguel::findOrFail($id);
                $horariosStr = $item->horarios_disponiveis ?? '[]';
                
                if (is_string($horariosStr)) {
                    $horariosFuncionamento = json_decode($horariosStr, true) ?? [];
                } elseif (is_array($horariosStr)) {
                    $horariosFuncionamento = $horariosStr;
                }

                // OTIMIZAÇÃO: Consulta mais simples e rápida para evitar timeout
                $horariosOcupados = DB::table('alugueis')
                    ->where('item_aluguel_id', $id)
                    ->where('data_inicio', $data)
                    ->whereNotIn('status', ['cancelado', 'estornado'])
                    ->pluck('hora_inicio')
                    ->map(fn($hora) => substr($hora, 0, 5))
                    ->toArray();
                    
            } else {
                $servico = Servico::findOrFail($id);
                $horariosStr = $servico->horarios_disponiveis ?? '[]';
                
                if (is_string($horariosStr)) {
                    $horariosFuncionamento = json_decode($horariosStr, true) ?? [];
                } elseif (is_array($horariosStr)) {
                    $horariosFuncionamento = $horariosStr;
                }

                $horariosOcupados = DB::table('agendamentos')
                    ->where('data_agendamento', $data)
                    ->where('servico_id', $id)
                    ->whereNotIn('status', ['cancelado', 'finalizado'])
                    ->pluck('hora_agendamento')
                    ->map(fn($hora) => substr($hora, 0, 5))
                    ->toArray();
            }

            if (empty($horariosFuncionamento)) {
                $horariosFuncionamento = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
            }

            $horariosLivres = array_values(array_filter($horariosFuncionamento, function($hora) use ($horariosOcupados) {
                return !in_array(substr($hora, 0, 5), $horariosOcupados);
            }));

            return response()->json($horariosLivres);

        } catch (Exception $e) {
            Log::error('Erro na busca de horários: ' . $e->getMessage());
            return response()->json(['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00']); // Fallback de segurança para não travar o app
        }
    }

    public function salvarNotaTriagem(Request $request, $id)
    {
        $request->validate(['observacoes' => 'required|string']);
        DB::table('triagens')->where('id', $id)->update(['observacoes' => $request->observacoes, 'updated_at' => now()]);
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

        event(new FilaAtualizada($request->estabelecimento_id));
        return response()->json(['message' => 'Reagendado com sucesso!', 'agendamento' => $agendamento], 201);
    }

    /* =========================================================================
       👉 MÉTODOS MOBILE - MÓDULO DE LOCAÇÃO E ASSINATURA SAAS
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
            default => $item->valor_diaria
        };

        $valorBruto = ($valorUnitario * $validated['quantidade_periodos']) * $validated['quantidade'];
        $valorTotalComCaucao = $valorBruto + ($item->valor_caucao ?? 0);

        $taxaMarketplace = $valorBruto * $this->taxaApp;

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

    /* =========================================================================
       👉 MÉTODOS MOBILE - CLIENTE (APP): DETALHES RÍCOS DE CATÁLOGO
       ========================================================================= */

    public function detalhesServicoApp($id)
    {
        $servico = Servico::with('estabelecimento')->findOrFail($id);

        $avaliacoes = DB::table('avaliacoes')
            ->join('users', 'avaliacoes.usuario_id', '=', 'users.id')
            ->where('avaliacoes.estabelecimento_id', $servico->estabelecimento_id)
            ->select('avaliacoes.*', 'users.name as nome_usuario', 'users.foto_url as foto_usuario')
            ->latest('avaliacoes.created_at')
            ->take(10)
            ->get();

        $fotosArray = [];
        if (is_string($servico->fotos)) {
            $fotosArray = json_decode($servico->fotos, true) ?? [];
        } elseif (is_array($servico->fotos)) {
            $fotosArray = $servico->fotos;
        }
        if (empty($fotosArray)) {
            $fotosArray = ['https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?q=80&w=1000&auto=format&fit=crop'];
        }

        $config = is_string($servico->configuracoes) ? json_decode($servico->configuracoes, true) : $servico->configuracoes;

        return response()->json([
            'id' => $servico->id,
            'nome' => $servico->nome,
            'descricao' => $servico->descricao,
            'valor' => $servico->valor,
            'duracao_minutos' => $servico->duracao_minutos,
            'fotos' => $fotosArray,
            'avaliacao_media' => $servico->avaliacao_media ?? 0,
            'total_avaliacoes' => $servico->total_avaliacoes ?? 0,
            
            // Regras de Desconto
            'tem_promocao' => $config['tem_cupom'] ?? false,
            'tipo_desconto' => $config['tipo_desconto_cupom'] ?? 'percentual',
            'valor_desconto' => $config['valor_cupom'] ?? 0,
            'aceita_pontos' => true, 
            'maximo_pontos_permitidos' => 10000,
            
            'estabelecimento' => [
                'id' => $servico->estabelecimento->id ?? null,
                'nome' => $servico->estabelecimento->nome ?? $servico->estabelecimento->nome_fantasia ?? 'Estabelecimento',
                'foto_perfil' => $servico->estabelecimento->foto_perfil ?? 'https://via.placeholder.com/150',
                'rua' => $servico->estabelecimento->rua ?? '',
                'numero' => $servico->estabelecimento->numero ?? '',
                'cidade' => $servico->estabelecimento->cidade ?? '',
                'estado' => $servico->estabelecimento->estado ?? '',
            ],
            'avaliacoes' => $avaliacoes
        ], 200);
    }

    /**
     * BUSCA OS DETALHES COMPLETOS DE UM ITEM DE ALUGUEL (CARRO, ESPAÇO, ETC)
     */
    public function detalhesItemAluguelApp($id)
    {
        $item = ItemAluguel::with('estabelecimento')->findOrFail($id);

        $avaliacoes = DB::table('avaliacoes')
            ->join('users', 'avaliacoes.usuario_id', '=', 'users.id')
            ->where('avaliacoes.estabelecimento_id', $item->estabelecimento_id)
            ->select('avaliacoes.*', 'users.name as nome_usuario', 'users.foto_url as foto_usuario')
            ->latest('avaliacoes.created_at')
            ->take(10)
            ->get();

        $fotosArray = [];
        if (is_string($item->fotos)) {
            $fotosArray = json_decode($item->fotos, true) ?? [];
        } elseif (is_array($item->fotos)) {
            $fotosArray = $item->fotos;
        }
        if (empty($fotosArray)) {
            $fotosArray = [$item->foto_principal ?? 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?q=80&w=1000&auto=format&fit=crop'];
        }

        $provedor = $item->estabelecimento;
        $nomeProvedor = $provedor->name ?? $provedor->nome ?? 'Proprietário';
        $fotoProvedor = $provedor->foto_url ?? $provedor->foto_perfil ?? 'https://via.placeholder.com/150';

        $recursos = is_string($item->recursos_oferecidos) ? json_decode($item->recursos_oferecidos, true) : $item->recursos_oferecidos;
        $acessorios = is_string($item->acessorios) ? json_decode($item->acessorios, true) : $item->acessorios;

        return response()->json([
            'id' => $item->id,
            'nome' => $item->nome,
            'categoria' => $item->categoria ?? 'locacao',
            'descricao' => $item->descricao,
            
            // Preços
            'valor_diaria' => $item->valor_diaria,
            'valor_semanal' => $item->valor_semanal,
            'valor_mensal' => $item->valor_mensal,
            'valor_caucao' => $item->valor_caucao,
            
            // Promoções e Descontos
            'tem_promocao' => (bool) $item->tem_promocao,
            'tipo_desconto' => $item->tipo_desconto ?? 'percentual',
            'valor_desconto' => $item->valor_desconto ?? 0,
            
            // Fidelidade
            'aceita_pontos' => (bool) $item->aceita_pontos,
            'maximo_pontos_permitidos' => $item->maximo_pontos_permitidos ?? 0,
            
            // Atributos Especiais
            'capacidade_pessoas' => $item->capacidade_pessoas ?? 0,
            'numero_quartos' => $item->numero_quartos ?? 0,
            'mobiliado' => (bool) $item->mobiliado,
            'aceita_pet' => (bool) $item->aceita_pet,
            'possui_wifi' => (bool) $item->possui_wifi,
            'possui_ar_condicionado' => (bool) $item->possui_ar_condicionado,
            'piscina' => (bool) $item->piscina,
            'churrasqueira' => (bool) $item->churrasqueira,
            'possui_seguro' => (bool) $item->possui_seguro,

            // Listas
            'recursos_oferecidos' => is_array($recursos) ? $recursos : [],
            'acessorios' => is_array($acessorios) ? $acessorios : [],
            'fotos' => $fotosArray,
            
            // Retirada Específica do Bem
            'cep_retirada' => $item->cep_retirada,
            'rua_retirada' => $item->rua_retirada,
            'numero_retirada' => $item->numero_retirada,
            'bairro_retirada' => $item->bairro_retirada,
            'cidade_retirada' => $item->cidade_retirada,
            'estado_retirada' => $item->estado_retirada,

            // Entrega Específica do Bem
            'cep_entrega' => $item->cep_entrega,
            'rua_entrega' => $item->rua_entrega,
            'numero_entrega' => $item->numero_entrega,
            'bairro_entrega' => $item->bairro_entrega,
            'cidade_entrega' => $item->cidade_entrega,
            'estado_entrega' => $item->estado_entrega,
            
            // Perfil do Anunciante
            'estabelecimento' => [
                'id' => $provedor->id ?? null,
                'nome' => $nomeProvedor,
                'foto_perfil' => $fotoProvedor,
                'rua' => $provedor->rua ?? $provedor->address ?? '',
                'numero' => $provedor->numero ?? $provedor->address_number ?? '',
                'cidade' => $provedor->cidade ?? $provedor->city ?? '',
                'estado' => $provedor->estado ?? $provedor->province ?? '',
            ],
            'avaliacoes' => $avaliacoes
        ], 200);
    }

    public function verEstabelecimento($id)
    {
        $estabelecimento = Estabelecimento::findOrFail($id);

        if (!$estabelecimento->ativo) {
            return response()->json(['error' => 'Estabelecimento fechado'], 404);
        }

        $avaliacoes = DB::table('avaliacoes')
            ->where('estabelecimento_id', $id)
            ->select(
                DB::raw('AVG(nota) as media_geral'),
                DB::raw('AVG(nota_limpeza) as media_limpeza'),
                DB::raw('AVG(nota_precisao) as media_precisao'),
                DB::raw('AVG(nota_comunicacao) as media_comunicacao'),
                DB::raw('COUNT(id) as total')
            )->first();

        return response()->json([
            'estabelecimento' => $estabelecimento->only([
                'id','nome','foto_perfil','foto_capa','bairro','cidade','estado','telefone'
            ]),
            'avaliacoes_resumo' => $avaliacoes,
            'servicos' => $estabelecimento->servicos()->where('ativo', true)->get(),
            'locacoes' => ItemAluguel::where('estabelecimento_id', $id)->where('ativo', true)->get()
        ]);
    }

    /* =========================================================================
       👉 CHECKOUT MISTO (CARRINHO E PONTOS) TOTALMENTE OTIMIZADO PARA VELOCIDADE
       ========================================================================= */

    public function checkoutMisto(Request $request)
    {
        $validated = $request->validate([
            'estabelecimento_id'          => 'required',
            'forma_pagamento'             => 'required|in:online,presencial',
            'usar_pontos'                 => 'boolean',
            'pontos_a_usar'               => 'nullable|integer|min:1',
            'itens'                       => 'required|array|min:1',
            'itens.*.tipo'                => 'required|in:servico,aluguel,produto',
            'itens.*.id'                  => 'required|integer',
            'itens.*.quantidade'          => 'required|integer|min:1',
            'itens.*.data_agendamento'    => 'nullable|date',
            'itens.*.hora_agendamento'    => 'nullable|string',
            'itens.*.data_inicio'         => 'nullable|date',
            'itens.*.data_fim'            => 'nullable|date',
            'itens.*.tipo_periodo'        => 'nullable|string|in:diaria,semanal,mensal',
            'itens.*.quantidade_periodos' => 'nullable|integer',
            'tipo_entrega'                => 'nullable|in:estabelecimento,endereco',
            'cep_entrega'                 => 'nullable|string',
            'rua_entrega'                 => 'nullable|string',
            'numero_entrega'              => 'nullable|string',
            'bairro_entrega'              => 'nullable|string',
            'cidade_entrega'              => 'nullable|string',
        ]);

        $user = Auth::user();
        $estabelecimentoId = $validated['estabelecimento_id'];

        try {
            DB::beginTransaction();

            $valorTotalBruto = 0;
            $agendamentosCriados = [];
            $alugueisCriados = [];
            $codigoReservaGrupo = 'PED-' . strtoupper(Str::random(8));

            // OTIMIZAÇÃO: Consulta de uma vez só todos os itens para evitar Timeout (N+1 Problem)
            $idsServicos = [];
            $idsLocacoes = [];
            foreach ($validated['itens'] as $item) {
                if ($item['tipo'] === 'servico') $idsServicos[] = $item['id'];
                if ($item['tipo'] === 'aluguel') $idsLocacoes[] = $item['id'];
            }

            $servicosNoBanco = Servico::whereIn('id', $idsServicos)->get()->keyBy('id');
            $locacoesNoBanco = ItemAluguel::whereIn('id', $idsLocacoes)->get()->keyBy('id');

            foreach ($validated['itens'] as $itemReq) {
                
                if ($itemReq['tipo'] === 'servico') {
                    $servico = $servicosNoBanco->get($itemReq['id']);
                    if (!$servico) continue;

                    $valorItem = $servico->valor * $itemReq['quantidade'];
                    $valorTotalBruto += $valorItem;

                    for ($i = 0; $i < $itemReq['quantidade']; $i++) {
                        $agendamentosCriados[] = Agendamento::create([
                            'estabelecimento_id' => $estabelecimentoId,
                            'usuario_id'         => $user->id,
                            'servico_id'         => $servico->id,
                            'data_agendamento'   => $itemReq['data_agendamento'] ?? now()->toDateString(),
                            'hora_agendamento'   => $itemReq['hora_agendamento'] ?? '00:00:00',
                            'status'             => 'aguardando_pagamento',
                            'status_pagamento'   => 'pendente',
                            'valor_final'        => $servico->valor,
                            'codigo_verificacao' => $codigoReservaGrupo,
                        ]);
                    }
                } 
                elseif ($itemReq['tipo'] === 'aluguel') {
                    $itemAluguel = $locacoesNoBanco->get($itemReq['id']);
                    if (!$itemAluguel) continue;

                    $tipoPeriodo = $itemReq['tipo_periodo'] ?? 'diaria';
                    
                    $valorUnitario = match($tipoPeriodo) {
                        'semanal' => $itemAluguel->valor_semanal,
                        'mensal'  => $itemAluguel->valor_mensal,
                        default   => $itemAluguel->valor_diaria,
                    } ?? 0;

                    $qtdPeriodos = $itemReq['quantidade_periodos'] ?? 1;
                    $valorItemTotal = ($valorUnitario * $qtdPeriodos) * $itemReq['quantidade'];
                    $valorItemTotal += ($itemAluguel->valor_caucao ?? 0); 
                    
                    $valorTotalBruto += $valorItemTotal;

                    $isDelivery = ($validated['tipo_entrega'] ?? '') === 'endereco';

                    $alugueisCriados[] = Aluguel::create([
                        'codigo_reserva'      => $codigoReservaGrupo,
                        'item_aluguel_id'     => $itemAluguel->id,
                        'estabelecimento_id'  => $estabelecimentoId,
                        'proprietario_id'     => $itemAluguel->estabelecimento_id,
                        'locatario_id'        => $user->id,
                        'tipo_periodo'        => $tipoPeriodo,
                        'quantidade_periodos' => $qtdPeriodos,
                        'data_inicio'         => $itemReq['data_inicio'] ?? now()->toDateString(),
                        'data_fim'            => $itemReq['data_fim'] ?? Carbon::parse($itemReq['data_inicio'])->addDays($qtdPeriodos),
                        'quantidade'          => $itemReq['quantidade'],
                        'valor_unitario'      => $valorUnitario,
                        'valor_caucao'        => $itemAluguel->valor_caucao ?? 0,
                        'valor_total'         => $valorItemTotal,
                        'taxa_plataforma'     => $valorItemTotal * $this->taxaApp,
                        'forma_pagamento'     => $validated['forma_pagamento'],
                        'status'              => 'pendente',
                        
                        'cep_entrega'         => $isDelivery ? $validated['cep_entrega'] : null,
                        'rua_entrega'         => $isDelivery ? $validated['rua_entrega'] : null,
                        'numero_entrega'      => $isDelivery ? $validated['numero_entrega'] : null,
                        'bairro_entrega'      => $isDelivery ? $validated['bairro_entrega'] : null,
                        'cidade_entrega'      => $isDelivery ? $validated['cidade_entrega'] : null,
                    ]);
                }
            }

            $valorDesconto = 0;
            $pontosUtilizados = 0;

            if (($validated['usar_pontos'] ?? false) && !empty($validated['pontos_a_usar'])) {
                $saldoPontos = DB::table('pontos_usuario_estabelecimento')
                    ->where('usuario_id', $user->id)
                    ->where('estabelecimento_id', $estabelecimentoId)
                    ->value('total_pontos') ?? 0;

                $pontosSolicitados = $validated['pontos_a_usar'];

                if ($saldoPontos >= $pontosSolicitados) {
                    $taxaConversao = 0.01; 
                    $descontoCalculado = $pontosSolicitados * $taxaConversao;

                    if ($descontoCalculado > $valorTotalBruto) {
                        $descontoCalculado = $valorTotalBruto;
                        $pontosUtilizados = $valorTotalBruto / $taxaConversao;
                    } else {
                        $valorDesconto = $descontoCalculado;
                        $pontosUtilizados = $pontosSolicitados;
                    }

                    DB::table('pontos_usuario_estabelecimento')
                        ->where('usuario_id', $user->id)
                        ->where('estabelecimento_id', $estabelecimentoId)
                        ->decrement('total_pontos', $pontosUtilizados);

                    DB::table('historico_pontos')->insert([
                        'usuario_id'         => $user->id,
                        'estabelecimento_id' => $estabelecimentoId,
                        'agendamento_id'     => !empty($agendamentosCriados) ? $agendamentosCriados[0]->id : null,
                        'tipo'               => 'uso',
                        'descricao'          => "Desconto de R$ " . number_format($valorDesconto, 2, ',', '.') . " aplicado no pedido {$codigoReservaGrupo}.",
                        'quantidade'         => $pontosUtilizados,
                        'created_at'         => now()
                    ]);
                } else {
                    return response()->json(['error' => 'Saldo de pontos insuficiente para o resgate.'], 400);
                }
            }

            $valorFinalLiquido = max(0, $valorTotalBruto - $valorDesconto);

            $pagamentoPedido = Pagamento::create([
                'usuario_id'         => $user->id,
                'estabelecimento_id' => $estabelecimentoId,
                'agendamento_id'     => !empty($agendamentosCriados) ? $agendamentosCriados[0]->id : null,
                'aluguel_id'         => !empty($alugueisCriados) ? $alugueisCriados[0]->id : null,
                'valor'              => $valorFinalLiquido,
                'taxa'               => round($valorFinalLiquido * $this->taxaApp, 2),
                'valor_liquido'      => $valorFinalLiquido - round($valorFinalLiquido * $this->taxaApp, 2),
                'status'             => 'pendente',
                'metodo_pagamento'   => $validated['forma_pagamento'] === 'presencial' ? 'presencial' : 'pendente_online',
            ]);

            DB::commit();

            return response()->json([
                'message'           => 'Pedido montado com sucesso!',
                'codigo_pedido'     => $codigoReservaGrupo,
                'resumo_financeiro' => [
                    'valor_bruto'     => $valorTotalBruto,
                    'desconto_pontos' => $valorDesconto,
                    'pontos_usados'   => $pontosUtilizados,
                    'valor_total'     => $valorFinalLiquido,
                ],
                'pagamento_id'      => $pagamentoPedido->id
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("Erro no Checkout Misto: " . $e->getMessage());
            return response()->json(['error' => 'Erro ao processar o pedido: ' . $e->getMessage()], 500);
        }
    }

    /* =========================================================================
       👉 ESTORNOS E STATUS GERAIS
       ========================================================================= */

    public function show($id)
    {
        try {
            $agendamento = Agendamento::with(['servico', 'estabelecimento'])->find($id);

            if (!$agendamento) {
                return response()->json(['error' => 'Agendamento não encontrado.'], 404);
            }

            if ($agendamento->usuario_id !== Auth::id()) {
                return response()->json(['error' => 'Acesso negado.'], 403);
            }

            $posicaoFila = null;
            $statusAtivos = ['pendente', 'confirmado', 'em_atendimento', 'aguardando_pagamento'];

            if (in_array($agendamento->status, $statusAtivos) && $agendamento->data_agendamento === now()->toDateString()) {
                $posicaoFila = Agendamento::where('estabelecimento_id', $agendamento->estabelecimento_id)
                    ->where('data_agendamento', $agendamento->data_agendamento)
                    ->whereIn('status', $statusAtivos)
                    ->where(function($q) use ($agendamento) {
                        $q->where('hora_agendamento', '<', $agendamento->hora_agendamento)
                          ->orWhere(function($q2) use ($agendamento) {
                              $q2->where('hora_agendamento', $agendamento->hora_agendamento)
                                 ->where('id', '<=', $agendamento->id);
                          });
                    })
                    ->count();
            }

            $agendamento->posicao_fila = $posicaoFila;
            return response()->json($agendamento, 200);

        } catch (\Exception $e) {
            return response()->json(['error' => 'Erro interno ao buscar detalhes.'], 500);
        }
    }

    public function statusFila($id)
    {
        try {
            $agendamento = Agendamento::with(['estabelecimento', 'funcionario', 'servico'])
                            ->findOrFail($id);

            if ($agendamento->status === 'finalizado' || $agendamento->status === 'cancelado') {
                return response()->json(['status' => $agendamento->status, 'mensagem' => 'Agendamento não está mais na fila.'], 200);
            }

            $pessoasNaFrente = Agendamento::where('estabelecimento_id', $agendamento->estabelecimento_id)
                ->when($agendamento->funcionario_id, function($query) use ($agendamento) {
                    return $query->where('funcionario_id', $agendamento->funcionario_id);
                })
                ->whereDate('data_agendamento', $agendamento->data_agendamento)
                ->where('hora_agendamento', '<', $agendamento->hora_agendamento)
                ->whereIn('status', ['pendente', 'confirmado'])
                ->orderBy('hora_agendamento', 'asc')
                ->get();

            $posicao = $pessoasNaFrente->count() + 1;

            $tempoEstimadoPorPessoa = 15;
            $tempoTotalEstimado = $pessoasNaFrente->count() * $tempoEstimadoPorPessoa;

            $listaPessoas = $pessoasNaFrente->map(function($agen, $index) {
                return [
                    'id' => $agen->id,
                    'nome_ficticio' => 'Cliente 0' . ($index + 1),
                    'status_texto' => $index === 0 ? 'Em atendimento' : 'Aguardando',
                    'is_em_atendimento' => $index === 0
                ];
            });

            return response()->json([
                'id_agendamento' => $agendamento->id,
                'posicao_atual' => str_pad($posicao, 2, '0', STR_PAD_LEFT),
                'tempo_estimado_minutos' => $tempoTotalEstimado,
                'pessoas_na_frente' => $listaPessoas,
                'detalhes' => [
                    'estabelecimento_id' => $agendamento->estabelecimento_id,
                    'profissional' => $agendamento->funcionario ? $agendamento->funcionario->nome : 'Profissional',
                    'servico' => $agendamento->servico ? $agendamento->servico->nome : 'Serviço',
                    'valor' => number_format($agendamento->valor_final, 2, ',', '.'),
                    'horario_previsto' => Carbon::parse($agendamento->hora_agendamento)->format('H:i'),
                    'estabelecimento' => $agendamento->estabelecimento->nome,
                    'endereco' => $agendamento->estabelecimento->endereco ?? 'Endereço não cadastrado',
                    'pin' => str_pad($agendamento->id % 10000, 4, '0', STR_PAD_LEFT)
                ]
            ], 200);

        } catch (\Exception $e) {
            return response()->json(['error' => 'Erro ao calcular fila: ' . $e->getMessage()], 500);
        }
    }

    public function sairDaFila($id)
    {
        $agendamento = Agendamento::findOrFail($id);
        $agendamento->update(['status' => 'cancelado']);

        event(new FilaAtualizada($agendamento->estabelecimento_id));

        return response()->json(['success' => true, 'message' => 'Você saiu da fila.']);
    }
}