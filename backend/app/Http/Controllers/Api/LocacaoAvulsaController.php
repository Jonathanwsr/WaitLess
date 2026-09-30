<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Api\Concerns\GerenciaLocacaoAvulsa;
use App\Models\Aluguel;
use App\Models\ItemAluguel;
use App\Services\ImageKitService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

/**
 * "Locações Avulsas": itens de aluguel (imóveis, veículos, equipamentos...)
 * que o próprio sócio/proprietário cadastra e aluga diretamente, sem precisar
 * ter um Estabelecimento — usa `itens_aluguel.estabelecimento_id` apontando
 * para o próprio `users.id` do dono (é assim que a coluna já funciona hoje).
 */
class LocacaoAvulsaController extends Controller
{
    use GerenciaLocacaoAvulsa;

    public function index()
    {
        $this->garantirPapelPermitido();
        $donoId = Auth::id();

        $itens = ItemAluguel::catalogo()
            ->where('estabelecimento_id', $donoId)
            ->orderBy('created_at', 'desc')
            ->get();

        $emUsoAgora = Aluguel::with('item', 'locatario:id,name,telefone')
            ->whereIn('item_aluguel_id', $itens->pluck('id'))
            ->where('status', 'em_andamento')
            ->orderBy('data_inicio', 'asc')
            ->get()
            ->map(fn ($aluguel) => [
                'id'            => $aluguel->id,
                'item_nome'     => $aluguel->item->nome ?? '—',
                'locatario'     => $aluguel->locatario->name ?? '—',
                'data_inicio'   => $aluguel->data_inicio,
                'data_fim'      => $aluguel->data_fim,
            ]);

        return Inertia::render('Estabelecimentos/LocacoesAvulsas', [
            'itens'      => $itens,
            'emUsoAgora' => $emUsoAgora,
            'categorias' => ItemAluguel::CATEGORIAS_LOCACAO_AVULSA,
        ]);
    }

    public function store(Request $request)
    {
        $this->garantirPapelPermitido();

        $validated = $this->validarDadosLocacaoAvulsa($request);
        unset($validated['fotos_mantidas']);
        $validated['estabelecimento_id'] = Auth::id();
        $validated['fotos'] = $this->processarFotosLocacaoAvulsa($request, [], $validated['categoria']);

        $item = ItemAluguel::create($validated);

        return redirect()->back()->with('success', 'Locação "' . $item->nome . '" criada com sucesso!');
    }

    public function update(Request $request, ItemAluguel $item)
    {
        $this->garantirPapelPermitido();

        if ((int) $item->estabelecimento_id !== Auth::id()) {
            abort(403, 'Você não tem permissão para editar esta locação.');
        }

        $validated = $this->validarDadosLocacaoAvulsa($request);
        unset($validated['fotos_mantidas']);
        $validated['fotos'] = $this->processarFotosLocacaoAvulsa($request, $item->fotos ?? [], $validated['categoria']);

        $item->update($validated);

        return redirect()->back()->with('success', 'Locação atualizada com sucesso!');
    }

    public function destroy(ItemAluguel $item)
    {
        $this->garantirPapelPermitido();

        if ((int) $item->estabelecimento_id !== Auth::id()) {
            abort(403, 'Você não tem permissão para excluir esta locação.');
        }

        ImageKitService::deleteMany($item->fotos ?? []);
        $item->delete();

        return redirect()->back()->with('success', 'Locação removida.');
    }
}
