<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FlashDeal;
use App\Services\FlashDealService;
use Illuminate\Http\Request;
use Inertia\Inertia;

/**
 * Flash Deals (ofertas relâmpago): painel do sócio/gerente no web e no app,
 * e a lista de ofertas perto do cliente no app.
 */
class FlashDealController extends Controller
{
    public function __construct(private FlashDealService $flash)
    {
    }

    // ------------------------------------------------------------------ web (sócio/gerente)

    public function index(Request $request)
    {
        return Inertia::render('Gestao/FlashDeals', $this->painel($request));
    }

    public function store(Request $request)
    {
        $deal = $this->flash->criar($request->user(), $this->validar($request));

        return back()->with('success', $this->mensagemCriado($deal));
    }

    public function cancelar(Request $request, FlashDeal $flashDeal)
    {
        $this->flash->cancelar($request->user(), $flashDeal);

        return back()->with('success', 'Flash Deal encerrado. O preço normal já voltou.');
    }

    // ------------------------------------------------------------------ app (sócio/gerente)

    public function painelApp(Request $request)
    {
        return response()->json($this->painel($request));
    }

    public function storeApp(Request $request)
    {
        $deal = $this->flash->criar($request->user(), $this->validar($request));

        return response()->json(['message' => $this->mensagemCriado($deal), 'deal_id' => $deal->id], 201);
    }

    public function cancelarApp(Request $request, int $id)
    {
        $this->flash->cancelar($request->user(), FlashDeal::findOrFail($id));

        return response()->json(['message' => 'Flash Deal encerrado. O preço normal já voltou.']);
    }

    // ------------------------------------------------------------------ app (cliente)

    public function perto(Request $request)
    {
        $dados = $request->validate([
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
            'cidade' => 'nullable|string|max:120',
        ]);

        $lat = isset($dados['latitude']) ? (float) $dados['latitude'] : null;
        $lng = isset($dados['longitude']) ? (float) $dados['longitude'] : null;
        if ($lat !== null && $lng !== null) {
            $this->flash->registrarLocalizacao($request->user(), $lat, $lng, $dados['cidade'] ?? null);
        }

        return response()->json(['deals' => $this->flash->ativosParaCliente($request->user(), $lat, $lng, $dados['cidade'] ?? null)]);
    }

    public function clique(Request $request, int $id)
    {
        $this->flash->registrarClique($request->user(), FlashDeal::findOrFail($id));

        return response()->json(['ok' => true]);
    }

    // ------------------------------------------------------------------ apoio

    private function painel(Request $request): array
    {
        return [
            'opcoes' => $this->flash->opcoesDoDono($request->user()),
            'deals' => $this->flash->dealsDoDono($request->user()),
            'limites' => [
                'percentual_min' => FlashDealService::PERCENTUAL_MIN,
                'percentual_max' => FlashDealService::PERCENTUAL_MAX,
                'quantidade_max' => FlashDealService::QUANTIDADE_MAX,
                'duracao_min' => FlashDealService::DURACAO_MIN,
                'duracao_max' => FlashDealService::DURACAO_MAX,
                'duracao_padrao' => FlashDealService::DURACAO_PADRAO,
                'raio_padrao' => FlashDealService::RAIO_PADRAO_KM,
                'por_dia' => FlashDealService::MAX_DEALS_POR_DIA,
            ],
        ];
    }

    private function validar(Request $request): array
    {
        return $request->validate([
            'alvo_tipo' => 'required|in:item_aluguel,servico',
            'alvo_id' => 'required|integer',
            'percentual' => 'required|integer|between:' . FlashDealService::PERCENTUAL_MIN . ',' . FlashDealService::PERCENTUAL_MAX,
            'quantidade' => 'required|integer|between:1,' . FlashDealService::QUANTIDADE_MAX,
            'duracao_minutos' => 'nullable|integer|between:' . FlashDealService::DURACAO_MIN . ',' . FlashDealService::DURACAO_MAX,
            'raio_km' => 'nullable|integer|between:1,100',
        ], [], [
            'percentual' => 'desconto', 'quantidade' => 'vagas', 'duracao_minutos' => 'duração', 'raio_km' => 'raio', 'alvo_id' => 'item',
        ]);
    }

    private function mensagemCriado(FlashDeal $deal): string
    {
        return $deal->notificados > 0
            ? "Flash Deal no ar! {$deal->notificados} cliente(s) na cidade foram avisados agora."
            : 'Flash Deal no ar! Ainda não há clientes com o app aberto perto daqui; quem abrir o app na cidade verá a oferta.';
    }
}
