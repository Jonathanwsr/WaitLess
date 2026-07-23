<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AnfitriaoMobileController extends Controller
{
    /**
     * Atualiza os dados extras do perfil do Anfitrião
     */
    public function updatePerfil(Request $request)
    {
        $user = Auth::user();

        // Trava de segurança: Apenas donos e admins podem ter esse perfil preenchido
        if (!in_array($user->papel, ['admin', 'socio', 'proprietario'])) {
            return response()->json(['error' => 'Acesso negado. Apenas anfitriões podem editar este perfil.'], 403);
        }

        $validated = $request->validate([
            'onde_estudei' => 'nullable|string|max:255',
            'onde_moro'    => 'nullable|string|max:255',
            'idiomas'      => 'nullable|string|max:255',
            'profissao'    => 'nullable|string|max:255',
            'sobre_mim'    => 'nullable|string|max:1000',
        ]);

        $user->update($validated);

        return response()->json([
            'message' => 'Perfil de anfitrião atualizado com sucesso!',
            'anfitriao' => $user
        ], 200);
    }
}