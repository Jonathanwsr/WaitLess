<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\Cupom;
use Inertia\Inertia;

class CarteiraController extends Controller
{
    public function index()
    {
        $user = Auth::user();
        
        // 1. Recompensas disponíveis para resgatar
        $recompensas = Cupom::with('estabelecimento:id,nome,foto_perfil')
            ->where('pontos_custo', '>', 0)
            ->where('ativo', true)
            ->latest()
            ->get();

        // 2. Cupons que o usuário JÁ resgatou e estão na "bolsa" dele
        $meusCupons = $user->cuponsResgatados()
            ->with('estabelecimento:id,nome')
            ->orderByPivot('created_at', 'desc')
            ->get();

        return Inertia::render('Cliente/Carteira', [
            'recompensas' => $recompensas,
            'meusCupons' => $meusCupons // 👉 Enviamos para o React!
        ]);
    }

    // 👉 NOVA FUNÇÃO: O Cliente clica em "Resgatar" e gasta os pontos
    public function resgatarCupom(Request $request, Cupom $cupom)
    {
        $user = Auth::user();

      
        if ($cupom->apenas_plus && $user->plano_assinatura !== 'plus') {
            return redirect()->back()->with('error', 'Este cupom é exclusivo para assinantes WaitLess Plus.');
        }

       
        if ($user->pontos_saldo < $cupom->pontos_custo) {
            return redirect()->back()->with('error', 'Você não tem pontos suficientes.');
        }

       
        $jaPossui = $user->cuponsResgatados()->where('cupom_id', $cupom->id)->wherePivot('usado', false)->exists();
        if ($jaPossui) {
            return redirect()->back()->with('warning', 'Você já tem este cupom na sua carteira e ainda não o usou!');
        }

        
        $user->decrement('pontos_saldo', $cupom->pontos_custo);
        $user->cuponsResgatados()->attach($cupom->id, ['usado' => false]);

        return redirect()->back()->with('success', 'Cupom resgatado com sucesso! Ele agora está na sua carteira.');
    }
}