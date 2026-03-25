<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Funcionario;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class FuncionarioCatalogoController extends Controller
{
    public function index()
    {
        $user = Auth::user();
        
       
        $funcionarios = Funcionario::with(['estabelecimento.servicos'])
            ->where('usuario_id', $user->id)
            ->get();

        if ($funcionarios->isEmpty()) {
            abort(403, 'Acesso restrito. Você não possui um perfil de profissional associado.');
        }

        return Inertia::render('Funcionario/Catalogo', [
            'funcionarios' => $funcionarios
        ]);
    }
}