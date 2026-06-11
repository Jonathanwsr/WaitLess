<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agendamento;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

use Carbon\Carbon;
use Inertia\Inertia;
use App\Models\Funcionario;

class AgendamentoController extends Controller
{
    public function updateStatus(Request $request, Agendamento $agendamento)
    {
        $validated = $request->validate([
            'status' => 'required|in:pendente,confirmado,em_atendimento,cancelado',
        ]);

        $dados = ['status' => $validated['status']];

        if ($validated['status'] === 'cancelado') {
            $dados['codigo_verificacao'] = null;
            $dados['adiado_ate'] = null; // Limpa o cronômetro se cancelar
        }

        $agendamento->update($dados);
        return redirect()->back();
    }

    // NOVA FUNÇÃO: Chamar o cliente (Inicia o atendimento)
    public function chamar(Agendamento $agendamento)
    {
        $agendamento->update([
            'status' => 'em_atendimento',
            'adiado_ate' => null // Se chamou, o cronômetro de adiamento zera
        ]);

        return redirect()->back()->with('success', 'Cliente chamado para atendimento!');
    }

    // NOVA FUNÇÃO: Adiar em 10 minutos
    public function adiar(Agendamento $agendamento)
    {
        $agendamento->update([
            // Adiciona 10 minutos a partir do momento atual
            'adiado_ate' => now()->addMinutes(10),
            'status' => 'pendente' 
        ]);

        return redirect()->back()->with('success', 'Atendimento adiado em 10 minutos. O cronômetro foi iniciado.');
    }

    // NOVA FUNÇÃO: Chamar o próximo (Joga o atual para baixo)
    public function pularProximo(Agendamento $agendamento)
    {
        // Uma forma simples de jogar para baixo na fila é alterar a hora do agendamento 
        // para 15 minutos no futuro (ou trocar a posição manual se você tiver uma coluna 'posicao')
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

        $agendamento->update([
            'status' => 'finalizado',
            'foi_realizado' => true,
            'hora_finalizacao' => now()->format('H:i'),
            'finalizado_por' => Auth::id(),
            'status_pagamento' => $agendamento->status_pagamento === 'presencial' ? 'pago_presencial' : $agendamento->status_pagamento,
            'adiado_ate' => null
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

        $agendamento = \App\Models\Agendamento::findOrFail($id);
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
            $funcionario = \App\Models\Funcionario::find($agendamento->funcionario_id);
            if ($funcionario) {
                $media = \App\Models\Agendamento::where('funcionario_id', $funcionario->id)
                            ->whereNotNull('nota')->avg('nota');
                $funcionario->update(['avaliacao_media' => round($media, 1)]);
            }
        }

        if ($agendamento->servico_id) {
            $servico = \App\Models\Servico::find($agendamento->servico_id);
            if ($servico) {
                $mediaServico = \App\Models\Agendamento::where('servico_id', $servico->id)->whereNotNull('nota')->avg('nota');
                $totalAvaliacoes = \App\Models\Agendamento::where('servico_id', $servico->id)->whereNotNull('nota')->count();
                
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
    // 1. Data de hoje como padrão
    $hoje = Carbon::today()->toDateString();

    // 2. Filtros do React
    $filtros = [
        'data_inicio'      => $request->input('data_inicio', $hoje),
        'data_fim'         => $request->input('data_fim', $hoje),
        'ordem'            => $request->input('ordem', 'asc'),
        'status'           => $request->input('status', 'todos'),
        'status_pagamento' => $request->input('status_pagamento', 'todos'),
        'per_page'         => $request->input('per_page', 10),
    ];

    // 3. Estabelecimentos do usuário logado
    $estabelecimentos = Auth::user()->estabelecimentos()->get();
    $todosIds = $estabelecimentos->pluck('id')->toArray();

    $estabelecimentoAtual = null;
    $estabelecimentosIdsBusca = $todosIds;

    // Se o parâmetro {estabelecimento} foi passado na URL
    if ($estabelecimento) {
        // Captura o ID independentemente se o Laravel resolveu como Objeto ou string/ID
        $idProcurado = $estabelecimento instanceof \App\Models\Estabelecimento ? $estabelecimento->id : $estabelecimento;
        
        // Validação de segurança
        $estabelecimentoAtual = $estabelecimentos->firstWhere('id', $idProcurado);
        
        if ($estabelecimentoAtual) {
            $estabelecimentosIdsBusca = [$estabelecimentoAtual->id];
        } else {
            abort(403, 'Você não tem permissão para acessar este estabelecimento.');
        }
    }

    // 4. Funcionários do escopo visualizado
    $funcionarios = Funcionario::select('id', 'nome', 'cargo')
        ->whereIn('estabelecimento_id', $estabelecimentosIdsBusca)
        ->get();

    // 5. Query base de Agendamentos
    $query = Agendamento::with(['usuario', 'servico'])
        ->whereIn('estabelecimento_id', $estabelecimentosIdsBusca)
        ->whereBetween('data_agendamento', [$filtros['data_inicio'], $filtros['data_fim']]);

    // 6. Filtros de status
    if ($filtros['status'] !== 'todos') {
        $query->where('status', $filtros['status']);
    }

    if ($filtros['status_pagamento'] !== 'todos') {
        $query->where('status_pagamento', $filtros['status_pagamento']);
    }

    // 7. Ordenação
    $direcao = $filtros['ordem'] === 'desc' ? 'desc' : 'asc';
    $query->orderBy('data_agendamento', $direcao)
          ->orderBy('hora_agendamento', $direcao);

    // 8. Paginação
    $agendamentos = $query->paginate($filtros['per_page'])->withQueryString();

    // 9. Renderização da View única do Inertia
    return Inertia::render('Estabelecimentos/Fila', [
        'estabelecimento'  => $estabelecimentoAtual,
        'estabelecimentos' => $estabelecimentos,
        'agendamentos'     => $agendamentos,
        'filtros'          => $filtros,
        'funcionarios'     => $funcionarios,
    ]);
}
}