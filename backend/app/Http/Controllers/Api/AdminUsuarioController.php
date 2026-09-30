<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AdminUsuarioService;
use App\Services\PlanoService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class AdminUsuarioController extends Controller
{
    public function __construct(private AdminUsuarioService $service)
    {
    }

    /**
     * Lista todos os usuários da plataforma, com foto e status de plano, pra
     * o admin gerenciar (liberar plano, ver quem é quem). Busca por
     * nome/e-mail e paginação — a base de usuários só cresce.
     */
    public function index(Request $request)
    {
        $busca = trim((string) $request->query('busca', ''));

        return Inertia::render('Admin/Usuarios', [
            'usuarios' => $this->service->listar($busca),
            'busca' => $busca,
            // Catálogo completo (sócio e cliente têm planos com o mesmo nome
            // mas preço/tipo diferentes) — o front escolhe a lista certa
            // conforme o papel de cada usuário ao abrir o modal de liberar plano.
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

        return back()->with('success', "Plano \"{$validated['plano']}\" liberado para {$usuario->name} até " . $vencimento->format('d/m/Y') . '!');
    }

    public function revogarPlano(User $usuario)
    {
        $this->service->revogarPlano($usuario, Auth::id());

        return back()->with('success', "Plano de {$usuario->name} revogado.");
    }

    public function update(Request $request, User $usuario)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:users,email,' . $usuario->id,
            'telefone' => 'nullable|string|max:30',
            'papel' => 'required|string|in:user,socio,proprietario,gerente,funcionario,atendente,admin',
        ]);

        $this->service->atualizar($usuario, $validated, Auth::id());

        return back()->with('success', "Dados de {$usuario->name} atualizados.");
    }

    public function destroy(User $usuario)
    {
        $nome = $usuario->name;
        $this->service->apagar($usuario, Auth::id());

        return back()->with('success', "Usuário \"{$nome}\" apagado com sucesso.");
    }
}
