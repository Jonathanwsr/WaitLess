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
}