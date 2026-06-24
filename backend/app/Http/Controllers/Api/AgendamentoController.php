<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agendamento;
use App\Models\Aluguel;
use App\Models\ItemAluguel;
use App\Models\Contrato;
use App\Models\User;
use App\Models\Servico;
use App\Models\Funcionario;
use App\Models\Estabelecimento; // Adicionado para atualizar o Saldo Devedor
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Carbon\Carbon;
use Inertia\Inertia;
use Barryvdh\DomPDF\Facade\Pdf;

class AgendamentoController extends Controller
{
    /* =========================================================================
       👉 MÉTODOS ORIGINAIS - CONTROLE DE FILA E AGENDAMENTO DE SERVIÇOS
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
        return redirect()->back();
    }

    public function chamar(Agendamento $agendamento)
    {
        $agendamento->update([
            'status' => 'em_atendimento',
            'adiado_ate' => null 
        ]);

        return redirect()->back()->with('success', 'Cliente chamado para atendimento!');
    }

    public function adiar(Agendamento $agendamento)
    {
        $agendamento->update([
            'adiado_ate' => now()->addMinutes(10),
            'status' => 'pendente' 
        ]);

        return redirect()->back()->with('success', 'Atendimento adiado em 10 minutos. O cronômetro foi iniciado.');
    }

    public function pularProximo(Agendamento $agendamento)
    {
        $agendamento->update([
            'hora_agendamento' => now()->addMinutes(15)->format('H:i:s'),
            'status' => 'pendente',
            'adiado_ate' => null
        ]);

        return redirect()->back()->with('success', 'Cliente jogado para o final da fila.');
    }

    public function finalizarComCodigo(Request $request, $id)
    {
        $request->validate([
            'codigo_pin' => 'required|string|size:4'
        ]);

        $agendamento = Agendamento::findOrFail($id);

        if ((string)$agendamento->codigo_verificacao !== (string)$request->codigo_pin) {
            return redirect()->back()->withErrors(['error' => 'PIN inválido! Peça ao cliente para verificar o código correto no aplicativo.']);
        }

        // =====================================================================
        // 👉 REGRA DE NEGÓCIO WAITLESS: COMISSÃO DE 12% NOS SERVIÇOS
        // =====================================================================
        $valorBase = $agendamento->valor_final ?? $agendamento->valor_original ?? 0;
        $taxaMarketplace = $valorBase * 0.12; // 12% da Plataforma
        $estabelecimento = Estabelecimento::find($agendamento->estabelecimento_id);

        // Se o cliente pagou fisicamente no local, o logista fica devendo os 12% à WaitLess
        if ($agendamento->status_pagamento === 'presencial' || $agendamento->status_pagamento === 'pago_presencial') {
            if ($estabelecimento) {
                // Acumula os 12% na dívida do estabelecimento para descontar no próximo repasse online
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
            'taxa_plataforma' => $taxaMarketplace // Fica o registro histórico de quanto foi a taxa
        ]);

        return redirect()->back()->with('success', 'Atendimento concluído com sucesso! O cliente foi para o histórico.');
    }

    public function updateFuncionario(Request $request, Agendamento $agendamento)
    {
        $validated = $request->validate([
            'funcionario_id' => 'nullable|exists:funcionarios,id',
        ]);
        
        $agendamento->update(['funcionario_id' => $validated['funcionario_id']]);
        return redirect()->back();
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
            abort(403, 'Você não tem permissão para avaliar este agendamento.');
        }

        if ($agendamento->nota) {
            return back()->with('error', 'Você já avaliou este atendimento!');
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

        return back()->with('success', 'Muito obrigado pela sua avaliação! Você acabou de ganhar 50 pontos na sua carteira.');
    }

    public function index(Request $request, $estabelecimento = null)
    {
        $hoje = Carbon::today()->toDateString();

        $filtros = [
            'data_inicio'      => $request->input('data_inicio', $hoje),
            'data_fim'         => $request->input('data_fim', $hoje),
            'ordem'            => $request->input('ordem', 'asc'),
            'status'           => $request->input('status', 'todos'),
            'status_pagamento' => $request->input('status_pagamento', 'todos'),
            'per_page'         => $request->input('per_page', 10),
        ];

        $estabelecimentos = Auth::user()->estabelecimentos()->get();
        $todosIds = $estabelecimentos->pluck('id')->toArray();

        $estabelecimentoAtual = null;
        $estabelecimentosIdsBusca = $todosIds;

        if ($estabelecimento) {
            $idProcurado = $estabelecimento instanceof \App\Models\Estabelecimento ? $estabelecimento->id : $estabelecimento;
            $estabelecimentoAtual = $estabelecimentos->firstWhere('id', $idProcurado);
            
            if ($estabelecimentoAtual) {
                $estabelecimentosIdsBusca = [$estabelecimentoAtual->id];
            } else {
                abort(403, 'Você não tem permissão para acessar este estabelecimento.');
            }
        }

        $funcionarios = Funcionario::select('id', 'nome', 'cargo')
            ->whereIn('estabelecimento_id', $estabelecimentosIdsBusca)
            ->get();

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
        $query->orderBy('data_agendamento', $direcao)
              ->orderBy('hora_agendamento', $direcao);

        $agendamentos = $query->paginate($filtros['per_page'])->withQueryString();

        return Inertia::render('Estabelecimentos/Fila', [
            'estabelecimento'  => $estabelecimentoAtual,
            'estabelecimentos' => $estabelecimentos,
            'agendamentos'     => $agendamentos,
            'filtros'          => $filtros,
            'funcionarios'     => $funcionarios,
        ]);
    }

    public function detalheCliente($id)
    {
        $userLogado = auth()->user();
        $estabelecimento = $userLogado->estabelecimentos()->firstOrFail();
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

        $servicosDisponiveis = DB::table('servicos')
            ->where('estabelecimento_id', $estabelecimento->id)
            ->get(['id', 'nome', 'valor']);

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
            'total_gasto' => number_format(Agendamento::where('usuario_id', $cliente->id)->where('status', 'finalizado')->sum('valor_final'), 2, ',', '.'),
            'pendente' => number_format(Agendamento::where('usuario_id', $cliente->id)->where('status_pagamento', 'pendente')->sum('valor_final'), 2, ',', '.'),
            'referencia_pendente' => 'Procedimentos em aberto'
        ];

        return Inertia::render('Estabelecimentos/DetalheCliente', [
            'estabelecimento' => $estabelecimento,
            'paciente' => [
                'id' => $cliente->id,
                'nome' => $cliente->name,
                'email' => $cliente->email,
                'telefone' => $cliente->telefone ?? '(00) 00000-0000',
                'foto' => $cliente->foto_url ?? 'https://ui-avatars.com/api/?name=' . urlencode($cliente->name),
                'status' => 'Ativo',
                'desde' => $cliente->created_at ? $cliente->created_at->translatedFormat('M, Y') : now()->translatedFormat('M, Y'),
            ],
            'triagem' => $triagem,
            'proximoServico' => $proximoServicoData,
            'servicos' => $servicosDisponiveis,
            'financeiro' => $financeiroData,
            'historicoServicos' => $historico
        ]);
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

        return back()->with('success', 'Nota updated!');
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

        DB::table('agendamentos')->insert([
            'usuario_id' => $request->cliente_id,
            'estabelecimento_id' => $request->estabelecimento_id,
            'servico_id' => $request->servico_id,
            'data_agendamento' => $request->data,
            'hora_agendamento' => $request->hora,
            'status' => 'pendente',
            'created_at' => now(),
            'updated_at' => now()
        ]);

        return back()->with('success', 'Reagendado com sucesso!');
    }

    /* =========================================================================
       👉 MÉTODOS ADICIONAIS - MÓDULO DE LOCAÇÃO E ASSINATURA SAAS (D4SIGN)
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
        // 👉 Validação atualizada
        $validated = $request->validate([
            'item_aluguel_id' => 'required|exists:itens_aluguel,id',
            'tipo_periodo' => 'required|in:diaria,semanal,mensal',
            'quantidade_periodos' => 'required|integer|min:1',
            'data_inicio' => 'required|date|after_or_equal:today',
            'quantidade' => 'required|integer|min:1',
            'forma_pagamento' => 'required|string|in:online,presencial', // Validando formato

            'tipo_servico' => [
                'string',
                'in:retirada,entrega,ambos',
                function ($attribute, $value, $fail) use ($request) {
                    if (($request->filled('cep_retirada') || $request->filled('cep_entrega')) && empty($value)) {
                        $fail('O campo ' . $attribute . ' é obrigatório quando endereços logísticos são fornecidos.');
                    }
                },
            ],
            
            // Endereço de Retirada Completo
            'cep_retirada' => 'nullable|string|max:10',
            'rua_retirada' => 'required_with:cep_retirada|string|max:255',
            'numero_retirada' => 'required_with:cep_retirada|string|max:20',
            'complemento_retirada' => 'nullable|string|max:255',
            'bairro_retirada' => 'required_with:cep_retirada|string|max:255',
            'cidade_retirada' => 'required_with:cep_retirada|string|max:255',
            'estado_retirada' => 'required_with:cep_retirada|string|size:2',
            'latitude_retirada' => 'nullable|numeric',
            'longitude_retirada' => 'nullable|numeric',

            // Endereço de Entrega Completo
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

        // =====================================================================
        // 👉 REGRA DE NEGÓCIO WAITLESS: COMISSÃO DE 12% NOS ALUGUÉIS/LOCAÇÕES
        // =====================================================================
        // A comissão recai sobre o valor faturado (ignorando caução, que é devolvido)
        $taxaMarketplace = $valorBruto * 0.12; 
        
        if ($validated['forma_pagamento'] === 'presencial') {
            $estabelecimento = Estabelecimento::find($item->estabelecimento_id);
            if ($estabelecimento) {
                // Como o cliente pagou na mão do logista, a loja fica devendo os 12% da plataforma
                // O Saldo Devedor é acumulativo (+12% +12% ...) e será retido quando ele receber Online
                $estabelecimento->increment('saldo_devedor', $taxaMarketplace);
            }
        }

        // Criar Aluguel
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
            'taxa_plataforma' => $taxaMarketplace, // Registro da Taxa WaitLess gerada pela reserva
            'forma_pagamento' => $validated['forma_pagamento'],
            'status' => 'pendente',

            'tipo_servico' => $validated['tipo_servico'] ?? null,

            // Salvando informações de Retirada
            'cep_retirada' => $validated['cep_retirada'] ?? null,
            'rua_retirada' => $validated['rua_retirada'] ?? null,
            'numero_retirada' => $validated['numero_retirada'] ?? null,
            'complemento_retirada' => $validated['complemento_retirada'] ?? null,
            'bairro_retirada' => $validated['bairro_retirada'] ?? null,
            'cidade_retirada' => $validated['cidade_retirada'] ?? null,
            'estado_retirada' => $validated['estado_retirada'] ?? null,
            'latitude_retirada' => $validated['latitude_retirada'] ?? null,
            'longitude_retirada' => $validated['longitude_retirada'] ?? null,

            // Salvando informações de Entrega
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
        return response()->json(['message' => 'Aluguel updated!', 'aluguel' => $aluguel]);
    }

    public function destroyAluguel($id)
    {
        $aluguel = Aluguel::findOrFail($id);
        $aluguel->delete();
        return response()->json(['message' => 'Aluguel deletado do sistema']);
    }

    public function generarEEnviarContrato($aluguelId)
    {
        $aluguel = Aluguel::with(['item', 'locatario', 'proprietario'])->findOrFail($aluguelId);

        // Formatação estruturada dos novos campos de endereços logísticos completos
        $enderecoRetiradaFormatado = $aluguel->cep_retirada 
            ? "{$aluguel->rua_retirada}, nº {$aluguel->numero_retirada} - {$aluguel->bairro_retirada}, {$aluguel->cidade_retirada}/{$aluguel->estado_retirada} (CEP: {$aluguel->cep_retirada})"
            : "Diretamente na sede física do estabelecimento proprietário.";

        $enderecoEntregaFormatado = $aluguel->cep_entrega 
            ? "{$aluguel->rua_entrega}, nº {$aluguel->numero_entrega} - {$aluguel->bairro_entrega}, {$aluguel->cidade_entrega}/{$aluguel->estado_entrega} (CEP: {$aluguel->cep_entrega})"
            : "Mesmo endereço estipulado para o ato de retirada do bem.";

        // 👉 Renderização dinâmica de todos os recursos/opcionais que o bem oferece (JSON para HTML)
        $recursosInclusosHtml = '';
        if (!empty($aluguel->item->recursos_oferecidos) && is_array($aluguel->item->recursos_oferecidos)) {
            $recursosInclusosHtml = "<h2>4. Recursos, Opcionais e Comodidades Inclusas</h2><div class='dados'><ul>";
            foreach ($aluguel->item->recursos_oferecidos as $recurso) {
                $recursosInclusosHtml .= "<li style='font-size: 13px; color: #334155; margin-bottom: 4px;'>" . e($recurso) . "</li>";
            }
            $recursosInclusosHtml .= "</ul></div>";
        }

        $html = "
        <html>
        <head>
            <style>
                body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #0F172A; line-height: 1.6; padding: 30px; background-color: #FAFAFA; }
                h1 { text-align: center; font-size: 22px; color: #0F172A; text-transform: uppercase; margin-bottom: 25px; font-weight: 900; }
                h2 { font-size: 14px; color: #FF5A00; border-bottom: 2px solid #E2E8F0; padding-bottom: 6px; margin-top: 25px; font-weight: 800; text-transform: uppercase; }
                p, li { font-size: 13px; text-align: justify; color: #334155; }
                ul { padding-left: 20px; }
                .dados { background: #FFFFFF; padding: 18px; border-radius: 16px; margin-top: 10px; margin-bottom: 15px; font-size: 13px; border: 1px solid #E2E8F0; }
                .footer { text-align: center; font-size: 10px; color: #94A3B8; margin-top: 40px; font-weight: 600; }
            </style>
        </head>
        <body>
            <h1>Contrato de Locação e Termos de Uso • WaitLess</h1>
            <p>Por este instrumento particular de contrato de locação, as partes qualificadas abaixo concordam mútua e expressamente com os termos, valores e regras de negócio descritos.</p>
            
            <h2>1. Identificação das Partes</h2>
            <div class='dados'>
                <strong>LOCADOR (PROPRIETÁRIO):</strong> {$aluguel->proprietario->name} <br>
                <strong>LOCATÁRIO (CLIENTE):</strong> {$aluguel->locatario->name} • Email: {$aluguel->locatario->email}
            </div>

            <h2>2. Descrição Detalhada do Objeto</h2>
            <div class='dados'>
                <strong>Item Cadastrado:</strong> {$aluguel->item->nome} ({$aluguel->item->categoria})<br>
                <strong>Descrição do Atributo:</strong> {$aluguel->item->descricao}<br>
                " . ($aluguel->item->placa ? "<strong>Especificações do Veículo:</strong> Placa: {$aluguel->item->placa} | Renavam: {$aluguel->item->renavam} | Chassi: {$aluguel->item->chassis}<br>" : "") . "
                " . ($aluguel->item->endereco ? "<strong>Endereço do Imóvel:</strong> {$aluguel->item->endereco}, nº {$aluguel->item->numero} - {$aluguel->item->cidade}/{$aluguel->item->estado}<br>" : "") . "
            </div>

            <h2>3. Logística de Retirada e Entrega</h2>
            <div class='dados'>
                <strong>Local de Retirada do Bem:</strong> {$enderecoRetiradaFormatado}<br>
                <strong>Local de Devolução/Entrega:</strong> {$enderecoEntregaFormatado}
            </div>

            {$recursosInclusosHtml}

            <h2>5. Valores, Prazos e Vigência</h2>
            <div class='dados'>
                <strong>Período de Locação:</strong> " . \Carbon\Carbon::parse($aluguel->data_inicio)->format('d/m/Y') . " até " . \Carbon\Carbon::parse($aluguel->data_fim)->format('d/m/Y') . "<br>
                <strong>Modalidade de Cobrança:</strong> Recorrência por {$aluguel->tipo_periodo}<br>
                <strong>Valor de Tabela:</strong> R$ " . number_format($aluguel->valor_unitario, 2, ',', '.') . "<br>
                <strong>Fundo de Reserva (Caução):</strong> R$ " . number_format($aluguel->valor_caucao, 2, ',', '.') . "<br>
                <strong>VALOR INTEGRAL CONSOLIDADO:</strong> R$ " . number_format($aluguel->valor_total, 2, ',', '.') . "
            </div>

            <h2>6. Cláusulas e Responsabilidades Gerais</h2>
            <ul>
                <li><strong>Cancelamento e Reembolso:</strong> Fica assegurado o estorno e devolução total dos valores transacionados desde que o pedido de cancelamento formal seja realizado com até 2 (duas) horas de antecedência ao horário previsto de liberação do bem.</li>
                <li><strong>Pontuação e Fidelidade:</strong> O usuário acumulará pontos automaticamente ao utilizar o ecossistema WaitLess, podendo usufruir de ganhos triplicados (3x) caso elegível à modalidade ativa.</li>
                <li><strong>Conservação:</strong> O locatário assume inteira responsabilidade civil e criminal por danos, avarias ou multas decorrentes do uso inadequado do objeto alugado durante o período de vigência contratual.</li>
            </ul>
            
            <div class='footer'>Documento gerado digitalmente via D4Sign e custodiado pelos servidores WaitLess</div>
        </body>
        </html>";

        $pdf = Pdf::loadHTML($html);
        $pdfPath = 'contratos/contrato_' . $aluguel->codigo_reserva . '.pdf';
        Storage::disk('public')->put($pdfPath, $pdf->output());

        $tokenApi = config('services.d4sign.token');
        $cryptKey = config('services.d4sign.crypt');
        $uuidCofre = config('services.d4sign.uuid_safe');

        $responseUpload = Http::withHeaders(['Accept' => 'application/json'])
            ->attach('file', Storage::disk('public')->get($pdfPath), 'contrato.pdf')
            ->post("https://binary.d4sign.com.br/v1/documents/{$uuidCofre}/upload?token={$tokenApi}&crypt={$cryptKey}");

        if ($responseUpload->failed()) {
            return response()->json(['error' => 'Falha de comunicação com o cofre de arquivos D4Sign'], 500);
        }

        $uuidDocD4Sign = $responseUpload->json()['uuid'];

        Http::post("https://www.d4sign.com.br/v1/documents/{$uuidDocD4Sign}/createlist?token={$tokenApi}&crypt={$cryptKey}", [
            'signers' => [
                [
                    'email' => $aluguel->locatario->email,
                    'act' => 1, 
                    'foreign' => 0,
                    'cert_auth' => 0,
                ]
            ]
        ]);

        Http::post("https://www.d4sign.com.br/v1/documents/{$uuidDocD4Sign}/sendtosigner?token={$tokenApi}&crypt={$cryptKey}", [
            'message' => 'Assinatura digital do seu contrato de locação do marketplace WaitLess.'
        ]);

        $contrato = Contrato::create([
            'aluguel_id' => $aluguel->id,
            'numero_contrato' => 'CTR-' . strtoupper(Str::random(8)),
            'titulo' => 'Contrato de Locação ' . $aluguel->codigo_reserva,
            'arquivo_pdf' => $pdfPath,
            'hash_documento' => $uuidDocD4Sign,
            'plataforma_assinatura' => 'D4Sign',
            'assinado' => false
        ]);

        $aluguel->update([
            'contrato_id' => $contrato->id,
            'status' => 'aguardando_assinatura'
        ]);

        return response()->json(['message' => 'Contrato gerado com sucesso e enviado para assinatura eletrônica!', 'contrato' => $contrato]);
    }

    public function webhookD4Sign(Request $request)
    {
        $uuidDoc = $request->input('uuid');
        $typePost = $request->input('type'); 

        if ($typePost === 'document_signed' || $request->input('status') === 'Concluído') {
            $contrato = Contrato::where('hash_documento', $uuidDoc)->first();

            if ($contrato) {
                $tokenApi = config('services.d4sign.token');
                $cryptKey = config('services.d4sign.crypt');

                $responseDownload = Http::post("https://www.d4sign.com.br/v1/documents/{$uuidDoc}/download?token={$tokenApi}&crypt={$cryptKey}");

                if ($responseDownload->successful()) {
                    $pdfAssinadoPath = 'contratos/assinados/contrato_final_' . $uuidDoc . '.pdf';
                    Storage::disk('public')->put($pdfAssinadoPath, $responseDownload->body());

                    $contrato->update([
                        'assinado' => true,
                        'arquivo_pdf' => $pdfAssinadoPath,
                        'data_assinatura' => now(),
                        'ip_assinatura' => $request->ip() ?? 'Webhook D4Sign',
                    ]);

                    $contrato->aluguel->update([
                        'contrato_assinado' => true,
                        'status' => 'confirmado'
                    ]);
                }
            }
        }

        return response()->json(['status' => 'success']);
    }
}