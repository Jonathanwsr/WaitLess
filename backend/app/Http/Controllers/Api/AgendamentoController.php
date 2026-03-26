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

    public function finalizarComCodigo(Request $request, $id)
    {
        // Valida exatamente o campo enviado pelo Frontend React
        $request->validate([
            'codigo_pin' => 'required|string|size:4'
        ]);

        $agendamento = Agendamento::findOrFail($id);

        // Verifica se o PIN bate (convertido para string para não perder zeros à esquerda como "0123")
        if ((string)$agendamento->codigo_verificacao !== (string)$request->codigo_pin) {
            // Retorna o erro na chave 'error' para o Inertia capturar e exibir o alerta vermelho
            return redirect()->back()->withErrors(['error' => 'PIN inválido! Peça ao cliente para verificar o código correto no aplicativo.']);
        }

        // Tudo certo! Finaliza o agendamento
        $agendamento->update([
            'status' => 'finalizado', // <- "finalizado" respeita a sua constraint do Postgres!
            'foi_realizado' => true,
            'hora_finalizacao' => now()->format('H:i'),
            'finalizado_por' => Auth::id(),
            // Se o pagamento era no local, atualiza para pago
            'status_pagamento' => $agendamento->status_pagamento === 'presencial' ? 'pago_presencial' : $agendamento->status_pagamento
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

        // 3. Atualiza a média e o total de avaliações do Serviço
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

        // Adiciona 50 pontos à carteira do usuário pela avaliação
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