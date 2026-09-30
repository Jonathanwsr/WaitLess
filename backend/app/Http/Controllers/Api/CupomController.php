<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cupom;
use App\Models\Estabelecimento;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class CupomController extends Controller
{
  
    public function index()
    {
        $user = Auth::user();
        if (!in_array($user->papel, ['admin', 'socio', 'gerente'])) {
            abort(403, 'Acesso não autorizado.');
        }

        // Pega as lojas do lojista (ajuste a consulta conforme a sua regra de negócio)
        $estabelecimentos = Estabelecimento::where('usuario_id', $user->id)->get();
        
        // Pega os cupons que pertencem às lojas deste lojista
        $cupons = Cupom::with('estabelecimento')
            ->whereIn('estabelecimento_id', $estabelecimentos->pluck('id'))
            ->latest()
            ->get();

        return Inertia::render('Lojista/Cupons', [
            'cupons' => $cupons,
            'meusEstabelecimentos' => $estabelecimentos
        ]);
    }

    public function store(Request $request, Estabelecimento $estabelecimento)
    {
        $user = Auth::user();
        $user->estabelecimentosGerenciados()->where('estabelecimentos.id', $estabelecimento->id)->firstOrFail();

        $request->merge(['codigo' => strtoupper((string) $request->input('codigo'))]);

        $validated = $request->validate([
            'codigo' => 'required|string|max:50|alpha_dash|unique:cupons,codigo',
            'titulo' => 'required|string|max:100',
            'descricao' => 'nullable|string',
            'tipo_desconto' => 'required|in:fixo,percentual',
            'valor_desconto' => 'required|numeric|min:0.1|max:100000',
            'pontos_custo' => 'required|integer|min:0',
            'apenas_plus' => 'required|boolean',
            'somente_novos_clientes' => 'sometimes|boolean',
            'data_validade' => 'nullable|date|after:today',
            'ativo' => 'required|boolean',
            'servico_id' => 'nullable|integer',
            'item_aluguel_id' => 'nullable|integer',
        ], [
            'codigo.unique' => 'Já existe um cupom com este código na plataforma. Escolha outro código.',
            'codigo.alpha_dash' => 'O código só pode ter letras, números, hífen e underline (sem espaços ou acentos).',
        ]);

        if ($validated['tipo_desconto'] === 'percentual' && (float) $validated['valor_desconto'] > 100) {
            return back()->withErrors(['valor_desconto' => 'Um desconto percentual não pode passar de 100%.'])->withInput();
        }

        if ($erro = $this->validarEscopo($validated, $estabelecimento->id)) {
            return back()->withErrors($erro)->withInput();
        }

        $estabelecimento->cupons()->create($validated);

        return redirect()->back()->with('success', 'Cupom de desconto criado com sucesso!');
    }

    public function update(Request $request, Cupom $cupom)
    {
        $user = Auth::user();
        $user->estabelecimentosGerenciados()->where('estabelecimentos.id', $cupom->estabelecimento_id)->firstOrFail();

        $request->merge(['codigo' => strtoupper((string) $request->input('codigo'))]);

        $validated = $request->validate([
            'codigo' => 'required|string|max:50|alpha_dash|unique:cupons,codigo,' . $cupom->id,
            'titulo' => 'required|string|max:100',
            'descricao' => 'nullable|string',
            'tipo_desconto' => 'required|in:fixo,percentual',
            'valor_desconto' => 'required|numeric|min:0.1|max:100000',
            'pontos_custo' => 'required|integer|min:0',
            'apenas_plus' => 'required|boolean',
            'somente_novos_clientes' => 'sometimes|boolean',
            'data_validade' => 'nullable|date',
            'ativo' => 'required|boolean',
            'servico_id' => 'nullable|integer',
            'item_aluguel_id' => 'nullable|integer',
        ], [
            'codigo.unique' => 'Já existe um cupom com este código na plataforma. Escolha outro código.',
            'codigo.alpha_dash' => 'O código só pode ter letras, números, hífen e underline (sem espaços ou acentos).',
        ]);

        if ($validated['tipo_desconto'] === 'percentual' && (float) $validated['valor_desconto'] > 100) {
            return back()->withErrors(['valor_desconto' => 'Um desconto percentual não pode passar de 100%.'])->withInput();
        }

        if ($erro = $this->validarEscopo($validated, $cupom->estabelecimento_id)) {
            return back()->withErrors($erro)->withInput();
        }

        $cupom->update($validated);

        return redirect()->back()->with('success', 'Cupom atualizado com sucesso!');
    }

    /** O cupom vale para o local inteiro, para UM serviço ou para UMA reserva — e o alvo tem que ser do dono. */
    private function validarEscopo(array &$validated, int $estabelecimentoId): ?array
    {
        $servicoId = $validated['servico_id'] ?? null;
        $itemId = $validated['item_aluguel_id'] ?? null;

        if ($servicoId && $itemId) {
            return ['servico_id' => 'Escolha um serviço OU uma reserva, não os dois.'];
        }
        if ($servicoId && !\App\Models\Servico::where('id', $servicoId)->where('estabelecimento_id', $estabelecimentoId)->exists()) {
            return ['servico_id' => 'Este serviço não pertence ao seu estabelecimento.'];
        }
        if ($itemId && !\App\Models\ItemAluguel::catalogo()->where('id', $itemId)->where('estabelecimento_id', Auth::id())->exists()) {
            return ['item_aluguel_id' => 'Esta reserva não pertence a você.'];
        }

        $validated['servico_id'] = $servicoId ?: null;
        $validated['item_aluguel_id'] = $itemId ?: null;

        return null;
    }

    public function destroy(Cupom $cupom)
    {
        Auth::user()->estabelecimentosGerenciados()->where('estabelecimentos.id', $cupom->estabelecimento_id)->firstOrFail();

        $cupom->delete();
        return redirect()->back()->with('success', 'Cupom removido do sistema.');
    }
}