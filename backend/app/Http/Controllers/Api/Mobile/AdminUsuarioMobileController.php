<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AdminUsuarioService;
use App\Services\PlanoService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Versão mobile (JSON) da área de admin "gestão de usuários" — mesma lógica
 * de App\Http\Controllers\Api\AdminUsuarioController (web/Inertia), só que
 * via App\Services\AdminUsuarioService, pra não duplicar a regra de negócio.
 */
class AdminUsuarioMobileController extends Controller
{
    public function __construct(private AdminUsuarioService $service)
    {
    }

    public function index(Request $request)
    {
        $busca = trim((string) $request->query('busca', ''));

        return response()->json([
            'status' => 'success',
            'usuarios' => $this->service->listar($busca, 20),
            'catalogoPlanos' => PlanoService::PLANOS_PREMIUM,
        ]);
    }

    public function liberarPlano(Request $request, User $usuario)
    {
        $validated = $request->validate([
            'plano' => 'required|string|in:' . implode(',', $this->service->planosValidosParaUsuario($usuario)),
            'dias' => 'required|integer|min:1|max:365',
        ]);

        $vencimento = $this->service->liberarPlano($usuario, Auth::id(), $validated['plano'], $validated['dias']);

        return response()->json([
            'status' => 'success',
            'message' => "Plano \"{$validated['plano']}\" liberado para {$usuario->name} até " . $vencimento->format('d/m/Y') . '!',
            'plano_expira_em' => $vencimento->toIso8601String(),
        ]);
    }

    public function revogarPlano(User $usuario)
    {
        $this->service->revogarPlano($usuario, Auth::id());

        return response()->json([
            'status' => 'success',
            'message' => "Plano de {$usuario->name} revogado.",
        ]);
    }
}
