<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cupom;
use App\Models\Estabelecimento;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class CupomController extends Controller
{
    public function store(Request $request, Estabelecimento $estabelecimento)
    {
       
        $user = Auth::user();
        if (!in_array($user->papel, ['admin', 'socio', 'gerente'])) {
            abort(403, 'Ação não autorizada.');
        }

        $validated = $request->validate([
            'codigo' => 'required|string|max:50',
            'titulo' => 'required|string|max:100',
            'descricao' => 'nullable|string',
            'tipo_desconto' => 'required|in:fixo,percentual',
            'valor_desconto' => 'required|numeric|min:0.1',
            'pontos_custo' => 'required|integer|min:0',
            'apenas_plus' => 'required|boolean',
            'data_validade' => 'nullable|date',
            'ativo' => 'required|boolean'
        ]);

        $estabelecimento->cupons()->create($validated);

        return redirect()->back()->with('success', 'Cupom de desconto criado com sucesso!');
    }

    public function update(Request $request, Cupom $cupom)
    {
        $validated = $request->validate([
            'codigo' => 'required|string|max:50',
            'titulo' => 'required|string|max:100',
            'descricao' => 'nullable|string',
            'tipo_desconto' => 'required|in:fixo,percentual',
            'valor_desconto' => 'required|numeric|min:0.1',
            'pontos_custo' => 'required|integer|min:0',
            'apenas_plus' => 'required|boolean',
            'data_validade' => 'nullable|date',
            'ativo' => 'required|boolean'
        ]);

        $cupom->update($validated);

        return redirect()->back()->with('success', 'Cupom atualizado com sucesso!');
    }

    public function destroy(Cupom $cupom)
    {
        $cupom->delete();
        return redirect()->back()->with('success', 'Cupom removido do sistema.');
    }
}