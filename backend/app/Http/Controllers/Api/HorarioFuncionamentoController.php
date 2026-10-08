<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Estabelecimento;
use App\Models\HorarioFuncionamento;
use Illuminate\Http\Request;

/**
 * Horário de funcionamento por dia da semana — opcional, o sócio/gerente
 * decide se quer cadastrar. Uma linha por dia (upsert por dia_semana); dá
 * pra marcar um dia como fechado sem apagar, ou remover a linha inteira.
 */
class HorarioFuncionamentoController extends Controller
{
    private function garantirQueGerencia(Request $request, Estabelecimento $estabelecimento): void
    {
        $user = $request->user();
        $gerencia = $user->papel === 'admin'
            || $user->estabelecimentos()->where('estabelecimentos.id', $estabelecimento->id)->exists();

        abort_unless($gerencia, 403, 'Você não administra este estabelecimento.');
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

        return back()->with('success', 'Horário de funcionamento salvo.')->with('horario', $horario);
    }

    public function destroy(Request $request, Estabelecimento $estabelecimento, HorarioFuncionamento $horario)
    {
        $this->garantirQueGerencia($request, $estabelecimento);

        if ((int) $horario->estabelecimento_id !== (int) $estabelecimento->id) {
            abort(404);
        }

        $horario->delete();

        return back()->with('success', 'Horário removido.');
    }
}
