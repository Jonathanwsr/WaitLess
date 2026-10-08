<?php

namespace App\Http\Controllers\Api\Mobile\Proprietario;

use App\Http\Controllers\Controller;
use App\Models\Estabelecimento;
use App\Models\HorarioFuncionamento;
use Illuminate\Http\Request;

/** Espelha HorarioFuncionamentoController (web) — mesma regra, devolvendo JSON. */
class HorarioFuncionamentoMobileController extends Controller
{
    private function garantirQueGerencia(Request $request, Estabelecimento $estabelecimento): void
    {
        $user = $request->user();
        $gerencia = $user->papel === 'admin'
            || $user->estabelecimentos()->where('estabelecimentos.id', $estabelecimento->id)->exists();

        abort_unless($gerencia, 403, 'Você não administra este estabelecimento.');
    }

    public function index(Request $request, Estabelecimento $estabelecimento)
    {
        $this->garantirQueGerencia($request, $estabelecimento);

        return response()->json(['horarios' => $estabelecimento->horariosFuncionamento()->get()]);
    }

    public function store(Request $request, Estabelecimento $estabelecimento)
    {
        $this->garantirQueGerencia($request, $estabelecimento);

        $validated = $request->validate([
            'dia_semana' => 'required|integer|min:0|max:6',
            'fechado' => 'nullable|boolean',
            'hora_abertura' => 'required_if:fechado,false|nullable|date_format:H:i',
            'hora_fechamento' => 'required_if:fechado,false|nullable|date_format:H:i|after:hora_abertura',
        ]);

        $fechado = $request->boolean('fechado');

        $horario = HorarioFuncionamento::updateOrCreate(
            ['estabelecimento_id' => $estabelecimento->id, 'dia_semana' => $validated['dia_semana']],
            [
                'fechado' => $fechado,
                'hora_abertura' => $fechado ? null : $validated['hora_abertura'],
                'hora_fechamento' => $fechado ? null : $validated['hora_fechamento'],
            ]
        );

        return response()->json(['message' => 'Horário de funcionamento salvo.', 'horario' => $horario]);
    }

    public function destroy(Request $request, Estabelecimento $estabelecimento, HorarioFuncionamento $horario)
    {
        $this->garantirQueGerencia($request, $estabelecimento);

        if ((int) $horario->estabelecimento_id !== (int) $estabelecimento->id) {
            abort(404);
        }

        $horario->delete();

        return response()->json(['message' => 'Horário removido.']);
    }
}
