<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Models\OfertaViagem;
use App\Services\Viagem\CrossSellViagemService;
use Illuminate\Http\Request;

/** App do cliente: avisa a chegada na cidade da hospedagem, lista as ofertas da viagem e mede os cliques. */
class OfertasViagemMobileController extends Controller
{
    public function __construct(private CrossSellViagemService $crossSell)
    {
    }

    public function chegada(Request $request)
    {
        $dados = $request->validate([
            'latitude' => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
            'cidade' => 'nullable|string|max:120',
        ]);

        // A mesma leitura alimenta os Flash Deals (só recebe quem está na cidade agora).
        app(\App\Services\FlashDealService::class)->registrarLocalizacao(
            $request->user(), (float) $dados['latitude'], (float) $dados['longitude'], $dados['cidade'] ?? null
        );

        $novas = $this->crossSell->registrarChegada(
            $request->user(), (float) $dados['latitude'], (float) $dados['longitude'], $dados['cidade'] ?? null
        );

        return response()->json(['novas' => $novas->count(), 'ofertas' => $this->crossSell->ofertasAtivas($request->user())]);
    }

    public function index(Request $request)
    {
        return response()->json(['ofertas' => $this->crossSell->ofertasAtivas($request->user())]);
    }

    public function clique(Request $request, int $id)
    {
        $oferta = OfertaViagem::where('usuario_id', $request->user()->id)->findOrFail($id);
        $this->crossSell->registrarClique($oferta);

        return response()->json(['ok' => true]);
    }
}
