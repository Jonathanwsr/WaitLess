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
            'status' => 'required|in:pendente,confirmado,finalizado,cancelado',
        ]);

        $dadosParaAtualizar = ['status' => $validated['status']];

        if ($validated['status'] === 'finalizado') {
            $dadosParaAtualizar['foi_realizado'] = true;
            $dadosParaAtualizar['hora_finalizacao'] = now()->format('H:i');
            $dadosParaAtualizar['finalizado_por'] = Auth::id(); 
        }

        $agendamento->update($dadosParaAtualizar);
        return redirect()->back();
    }
}