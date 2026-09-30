<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Services\IndicacaoService;
use Illuminate\Http\Request;

/** "Convide amigos": código de indicação, ganhos e aplicação de um código recebido. */
class IndicacaoMobileController extends Controller
{
    public function __construct(private IndicacaoService $indicacao)
    {
    }

    public function resumo(Request $request)
    {
        return response()->json($this->indicacao->resumo($request->user()));
    }

    /** Quem se cadastrou sem código pode informar o de um amigo depois (até concluir a 1ª reserva). */
    public function aplicar(Request $request)
    {
        $dados = $request->validate(['codigo' => 'required|string|max:12']);

        $problema = $this->indicacao->registrar($request->user(), $dados['codigo']);
        if ($problema) {
            return response()->json(['error' => $problema, 'message' => $problema], 422);
        }

        return response()->json([
            'message' => 'Código aplicado! Quando você concluir sua primeira reserva, vocês dois ganham pontos.',
            'resumo' => $this->indicacao->resumo($request->user()->fresh()),
        ]);
    }
}
