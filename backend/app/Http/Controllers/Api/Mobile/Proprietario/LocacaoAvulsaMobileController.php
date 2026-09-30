<?php

namespace App\Http\Controllers\Api\Mobile\Proprietario;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Api\Concerns\GerenciaLocacaoAvulsa;
use App\Models\Aluguel;
use App\Models\ItemAluguel;
use App\Services\ImageKitService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * "Locações Avulsas" no mobile: mesmo conceito da versão web (ver
 * App\Http\Controllers\Api\LocacaoAvulsaController) — o sócio/proprietário
 * cadastra e aluga imóveis/veículos/equipamentos direto, sem precisar de um
 * Estabelecimento. `itens_aluguel.estabelecimento_id` aponta pro próprio
 * `users.id` do dono.
 */
class LocacaoAvulsaMobileController extends Controller
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
                'id'          => $aluguel->id,
                'item_nome'   => $aluguel->item->nome ?? '—',
                'locatario'   => $aluguel->locatario->name ?? '—',
                'data_inicio' => $aluguel->data_inicio,
                'data_fim'    => $aluguel->data_fim,
            ]);

        return response()->json([
            'itens'       => $itens,
            'em_uso_agora' => $emUsoAgora,
            'categorias'  => ItemAluguel::CATEGORIAS_LOCACAO_AVULSA,
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

        return response()->json(['message' => 'Locação criada com sucesso!', 'item' => $item], 201);
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

        return response()->json(['message' => 'Locação atualizada com sucesso!', 'item' => $item]);
    }

    public function destroy(ItemAluguel $item)
    {
        $this->garantirPapelPermitido();

        if ((int) $item->estabelecimento_id !== Auth::id()) {
            abort(403, 'Você não tem permissão para excluir esta locação.');
        }

        ImageKitService::deleteMany($item->fotos ?? []);
        $item->delete();

        return response()->json(['message' => 'Locação removida.']);
    }
}
