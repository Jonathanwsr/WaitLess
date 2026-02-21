<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Estabelecimento;
use App\Models\Agendamento;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Carbon\Carbon;

class FilaController extends Controller
{
    public function show(Request $request, Estabelecimento $estabelecimento)
    {
        
        $funcionarios = $estabelecimento->funcionarios()->where('ativo', true)->get(['id', 'nome', 'cargo']);

        $query = Agendamento::with(['usuario', 'servico', 'pagamento'])
            ->where('estabelecimento_id', $estabelecimento->id);



        
        $periodo = $request->get('periodo', 'hoje');
        if ($periodo === 'futuro') {
            $query->whereDate('data_agendamento', '>', Carbon::today());
        } else {
           
            $query->whereDate('data_agendamento', '<=', Carbon::today());
        }

       
        if ($request->filled('status') && $request->status !== 'todos') {
            $query->where('status', $request->status);
        }

       
        if ($request->filled('status_pagamento') && $request->status_pagamento !== 'todos') {
            $query->whereHas('pagamento', function($q) use ($request) {
                $q->where('status', $request->status_pagamento);
            });
        }

        $ordem = $request->get('ordem', 'asc');
        $query->orderBy('data_agendamento', $ordem)
              ->orderBy('hora_agendamento', $ordem);

      
        
        $perPage = $request->get('per_page', 10);
        $agendamentos = $query->paginate($perPage)->withQueryString();

        return Inertia::render('Estabelecimentos/Fila', [
            'estabelecimento' => $estabelecimento,
            'agendamentos' => $agendamentos, 
            'funcionarios' => $funcionarios,
            'filtros' => $request->all(),
        ]);
    }
}