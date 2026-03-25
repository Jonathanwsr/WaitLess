<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Funcionario;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Carbon\Carbon;

class FuncionarioAusenciaController extends Controller
{
    public function index()
    {
        $user = Auth::user();
        $funcionarios = Funcionario::with('estabelecimento')->where('usuario_id', $user->id)->get();
        $funcionarioIds = $funcionarios->pluck('id');

        $ausencias = DB::table('ausencias_funcionarios')
            ->join('funcionarios', 'ausencias_funcionarios.funcionario_id', '=', 'funcionarios.id')
            ->join('estabelecimentos', 'funcionarios.estabelecimento_id', '=', 'estabelecimentos.id')
            ->whereIn('funcionario_id', $funcionarioIds)
            ->where('data_ausencia', '>=', Carbon::today())
            ->select('ausencias_funcionarios.*', 'estabelecimentos.nome as loja')
            ->orderBy('data_ausencia', 'asc')
            ->get();

        return Inertia::render('Funcionario/Ausencias', [
            'funcionarios' => $funcionarios,
            'ausencias' => $ausencias
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'funcionario_id' => 'required',
            'data_ausencia' => 'required|date|after_or_equal:today',
            'motivo' => 'required|string|max:255'
        ]);

        $funcionario = Funcionario::where('id', $request->funcionario_id)->where('usuario_id', Auth::id())->firstOrFail();

        DB::table('ausencias_funcionarios')->insert([
            'funcionario_id' => $funcionario->id,
            'data_ausencia' => $request->data_ausencia,
            'motivo' => $request->motivo,
            'created_at' => now(),
            'updated_at' => now()
        ]);

        return back()->with('success', 'Ausência registrada! A sua agenda foi bloqueada para este dia.');
    }

    public function destroy($id)
    {
        $ausencia = DB::table('ausencias_funcionarios')->where('id', $id)->first();
        if($ausencia) {
             Funcionario::where('id', $ausencia->funcionario_id)->where('usuario_id', Auth::id())->firstOrFail();
             DB::table('ausencias_funcionarios')->where('id', $id)->delete();
             return back()->with('success', 'Ausência cancelada. A sua agenda está aberta novamente.');
        }
        return back();
    }
}