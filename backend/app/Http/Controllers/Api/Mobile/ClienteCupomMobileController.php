<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Services\CupomService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

/**
 * Versão mobile (JSON, auth:sanctum) da validação de cupom no checkout —
 * mesma lógica de App\Http\Controllers\Api\ClienteCupomController::validar
 * (web/session), via App\Services\CupomService, pra não duplicar a regra de
 * negócio. Só valida (não consome) o cupom; ele é marcado como usado de
 * verdade quando a reserva é criada.
 */
class ClienteCupomMobileController extends Controller
{
    public function validar(Request $request, CupomService $cupomService)
    {
        $validated = $request->validate([
            'codigo' => 'required|string|max:60',
            'estabelecimento_id' => 'nullable|exists:estabelecimentos,id',
            'servico_id' => 'nullable|integer',
            'item_aluguel_id' => 'nullable|integer',
        ]);

        try {
            $cupom = $cupomService->buscarValidoParaUsuario($validated['codigo'], Auth::user(), $validated['estabelecimento_id'] ?? null, $validated['servico_id'] ?? null, $validated['item_aluguel_id'] ?? null);
        } catch (ValidationException $e) {
            return response()->json(['error' => collect($e->errors())->collapse()->first() ?? 'Cupom inválido.'], 422);
        }

        return response()->json([
            'cupom' => [
                'codigo' => $cupom->codigo,
                'titulo' => $cupom->titulo,
                'tipo_desconto' => $cupom->tipo_desconto,
                'valor_desconto' => $cupom->valor_desconto,
            ],
        ]);
    }

    /** Cupons que servem para este local/serviço/reserva (os específicos vêm primeiro). */
    public function recomendados(Request $request, CupomService $cupomService)
    {
        $v = $request->validate([
            'estabelecimento_id' => 'nullable|integer',
            'servico_id' => 'nullable|integer',
            'item_aluguel_id' => 'nullable|integer',
        ]);

        return response()->json(['cupons' => $cupomService->recomendados(
            Auth::user(), $v['estabelecimento_id'] ?? null, $v['servico_id'] ?? null, $v['item_aluguel_id'] ?? null
        )]);
    }

    /** Resgata o cupom com os pontos do cliente e guarda no inventário dele. */
    public function resgatar($id)
    {
        $user = Auth::user();
        $cupom = \App\Models\Cupom::findOrFail($id);

        if (!$cupom->ativo || ($cupom->data_validade && $cupom->data_validade->isPast())) {
            return response()->json(['error' => 'Este cupom não está mais disponível.'], 422);
        }
        if ($cupom->apenas_plus && !$user->isPremium()) {
            return response()->json(['error' => 'Este cupom é exclusivo para assinantes premium.'], 403);
        }
        if ($mensagem = app(\App\Services\CupomService::class)->motivoDeInelegibilidade($cupom, $user)) {
            return response()->json(['error' => $mensagem], 422);
        }
        if ($user->pontos_saldo < $cupom->pontos_custo) {
            return response()->json(['error' => 'Você não tem pontos suficientes para resgatar este cupom.'], 422);
        }
        if ($user->cupons()->where('cupom_id', $cupom->id)->wherePivot('usado', false)->exists()) {
            return response()->json(['error' => 'Você já tem este cupom no seu inventário.'], 409);
        }

        \Illuminate\Support\Facades\DB::transaction(function () use ($user, $cupom) {
            if ($cupom->pontos_custo > 0) {
                $user->decrement('pontos_saldo', $cupom->pontos_custo);
            }
            $user->cupons()->attach($cupom->id, ['usado' => false]);
        });

        return response()->json(['message' => 'Cupom resgatado! Ele já está pronto para usar.', 'codigo' => $cupom->codigo]);
    }
}
