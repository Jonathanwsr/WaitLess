<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agendamento;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AgendamentoController extends Controller
{
    public function updateStatus(Request $request, Agendamento $agendamento)
    {
        $validated = $request->validate([
            'status' => 'required|in:pendente,confirmado,cancelado',
        ]);

        $dados = ['status' => $validated['status']];

        if ($validated['status'] === 'cancelado') {
            $dados['codigo_verificacao'] = null;
        }

        $agendamento->update($dados);
        return redirect()->back();
    }

    public function finalizarComCodigo(Request $request, Agendamento $agendamento)
    {
        $request->validate([
            'codigo' => 'required|string|size:4'
        ]);

        if ($agendamento->codigo_verificacao !== $request->codigo) {
            return redirect()->back()->withErrors(['codigo' => 'Código PIN inválido. Peça o código correto ao cliente.']);
        }

        $agendamento->update([
            'status' => 'finalizado',
            'foi_realizado' => true,
            'hora_finalizacao' => now()->format('H:i'),
            'finalizado_por' => Auth::id()
        ]);

        return redirect()->back()->with('success', 'Serviço finalizado com sucesso! Pagamento liberado.');
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

        // Verifica se a tabela usa usuario_id ou user_id
        $donoDoAgendamento = $agendamento->usuario_id ?? $agendamento->user_id;

        if ($donoDoAgendamento !== Auth::id()) {
            abort(403, 'Você não tem permissão para avaliar este agendamento.');
        }

        if ($agendamento->nota) {
            return back()->with('error', 'Você já avaliou este atendimento!');
        }

        // 1. Salva a nota no agendamento
        $agendamento->update([
            'nota' => $request->nota,
            'comentario_avaliacao' => $request->comentario,
        ]);

        // 2. Atualiza a média de estrelas do Funcionário que atendeu
        if ($agendamento->funcionario_id) {
            $funcionario = \App\Models\Funcionario::find($agendamento->funcionario_id);
            if ($funcionario) {
                $media = \App\Models\Agendamento::where('funcionario_id', $funcionario->id)
                            ->whereNotNull('nota')
                            ->avg('nota');
                $funcionario->update(['avaliacao_media' => round($media, 1)]);
            }
        }

        // 👉 3. NOVA LÓGICA: Atualiza a média e o total de avaliações do Serviço
        if ($agendamento->servico_id) {
            $servico = \App\Models\Servico::find($agendamento->servico_id);
            if ($servico) {
                $mediaServico = \App\Models\Agendamento::where('servico_id', $servico->id)
                                ->whereNotNull('nota')
                                ->avg('nota');
                
                $totalAvaliacoes = \App\Models\Agendamento::where('servico_id', $servico->id)
                                ->whereNotNull('nota')
                                ->count();
                
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

     public function atribuirTodosEspera(Request $request, $estabelecimentoId)
    {
        $request->validate([
            'funcionario_id' => 'required|exists:funcionarios,id',
            'data_inicio' => 'required|date',
            'data_fim' => 'required|date'
        ]);

        \App\Models\Agendamento::where('estabelecimento_id', $estabelecimentoId)
            ->whereBetween('data_agendamento', [$request->data_inicio, $request->data_fim])
            ->whereNull('funcionario_id')
            ->whereIn('status', ['pendente', 'confirmado'])
            ->update(['funcionario_id' => $request->funcionario_id]);

        return back()->with('success', 'Todos os clientes em espera do período selecionado foram atribuídos com sucesso!');
    }
}