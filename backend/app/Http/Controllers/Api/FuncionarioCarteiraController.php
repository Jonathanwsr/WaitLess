<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agendamento;
use App\Models\Funcionario;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Carbon\Carbon;

class FuncionarioCarteiraController extends Controller
{
    public function index()
    {
        $user = Auth::user();
        $funcionarios = Funcionario::where('usuario_id', $user->id)->get();
        $funcionarioIds = $funcionarios->pluck('id');

        $hoje = Carbon::today()->toDateString();
        $inicioMes = Carbon::now()->startOfMonth();
        $fimMes = Carbon::now()->endOfMonth();

        // 1. Produção de Hoje
        $servicosHoje = Agendamento::whereIn('funcionario_id', $funcionarioIds)
            ->whereDate('data_agendamento', $hoje)
            ->whereIn('status', ['concluido', 'finalizado'])
            ->get();
        
        $valorHoje = $servicosHoje->sum('valor_final');
        $qtdHoje = $servicosHoje->count();

        // 2. Produção do Mês (Para a Meta)
        $ganhosMes = Agendamento::whereIn('funcionario_id', $funcionarioIds)
            ->whereBetween('data_agendamento', [$inicioMes, $fimMes])
            ->whereIn('status', ['concluido', 'finalizado'])
            ->sum('valor_final');

        $metaMensal = $funcionarios->first()->meta_mensal ?? 5000;

        // 3. Histórico de Fechamentos (Dias anteriores)
        $historicoFechamentos = DB::table('fechamentos_diarios')
            ->whereIn('funcionario_id', $funcionarioIds)
            ->orderBy('data_fechamento', 'desc')
            ->limit(15)
            ->get();
            
        // 4. Verifica se ele já encerrou o dia hoje
        $jaFechouHoje = DB::table('fechamentos_diarios')
            ->whereIn('funcionario_id', $funcionarioIds)
            ->where('data_fechamento', $hoje)
            ->exists();

        return Inertia::render('Funcionario/Carteira', [
            'valorHoje' => $valorHoje,
            'qtdHoje' => $qtdHoje,
            'ganhosMes' => $ganhosMes,
            'metaMensal' => $metaMensal,
            'historicoFechamentos' => $historicoFechamentos,
            'mesAtual' => Carbon::now()->translatedFormat('F'),
            'jaFechouHoje' => $jaFechouHoje
        ]);
    }

    // 👉 FUNÇÃO: Concluir o Dia
    public function fecharDia(Request $request)
    {
        $user = Auth::user();
        $funcionarios = Funcionario::where('usuario_id', $user->id)->get();
        $funcionarioIds = $funcionarios->pluck('id');
        $hoje = Carbon::today()->toDateString();

        $jaFechou = DB::table('fechamentos_diarios')
            ->whereIn('funcionario_id', $funcionarioIds)
            ->where('data_fechamento', $hoje)
            ->exists();

        if ($jaFechou) {
            return back()->withErrors(['error' => 'O seu expediente de hoje já foi encerrado e enviado.']);
        }

        $servicosHoje = Agendamento::whereIn('funcionario_id', $funcionarioIds)
            ->whereDate('data_agendamento', $hoje)
            ->whereIn('status', ['concluido', 'finalizado'])
            ->get();

        // Salva o relatório do dia
        DB::table('fechamentos_diarios')->insert([
            'funcionario_id' => $funcionarios->first()->id, 
            'data_fechamento' => $hoje,
            'valor_total' => $servicosHoje->sum('valor_final'),
            'qtd_servicos' => $servicosHoje->count(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

      
        Funcionario::whereIn('id', $funcionarioIds)->update(['ativo' => false]);

        return back()->with('success', 'Expediente encerrado com sucesso! Resumo de produção enviado ao gerente.');
    }
}