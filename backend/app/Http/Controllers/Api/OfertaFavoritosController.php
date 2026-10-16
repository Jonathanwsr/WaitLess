<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Estabelecimento;
use App\Models\OfertaFavoritos;
use App\Services\OfertaFavoritosService;
use Illuminate\Http\Request;

/** Ofertas Exclusivas via Mensagem (site e app usam os mesmos métodos JSON). */
class OfertaFavoritosController extends Controller
{
    public function __construct(private OfertaFavoritosService $ofertas) {}

    public function painel(Request $request, ?Estabelecimento $estabelecimento = null)
    {
        $local = $this->local($request, $estabelecimento);
        $resultados = app(\App\Services\ResultadosSocioService::class);

        return response()->json([
            'estabelecimento' => ['id' => $local->id, 'nome' => $local->nome],
            'publico' => $this->ofertas->publico($local)->count(),
            'cupons' => $this->ofertas->cuponsDisponiveis($local),
            'enviadas_hoje' => $this->ofertas->enviadasHoje($local),
            'limite_por_dia' => OfertaFavoritosService::LIMITE_POR_DIA,
            'historico' => OfertaFavoritos::with('cupom:id,codigo')->where('estabelecimento_id', $local->id)->latest()->take(10)
                ->get(['id', 'estabelecimento_id', 'titulo', 'mensagem', 'cupom_id', 'destinatarios', 'created_at'])
                ->map(fn (OfertaFavoritos $o) => $o->setAttribute('resultado', $resultados->daOferta($o))),
            // Resultado das ofertas (leram, usaram cupom, reservaram em até 14 dias, receita).
            'resultados' => $resultados->resumoOfertas($local),
        ]);
    }

    public function enviar(Request $request, ?Estabelecimento $estabelecimento = null)
    {
        $local = $this->local($request, $estabelecimento);
        $dados = $request->validate([
            'titulo' => 'required|string|min:3|max:120',
            'mensagem' => 'required|string|min:5|max:1000',
            'cupom_id' => 'nullable|integer',
        ], [
            'titulo.required' => 'Dê um título para a oferta (ex.: "20% para quem nos segue").',
            'mensagem.required' => 'Escreva a mensagem que os clientes vão receber.',
        ]);
        $dados['titulo'] = strip_tags($dados['titulo']);
        $dados['mensagem'] = strip_tags($dados['mensagem']);

        $oferta = $this->ofertas->enviar($request->user(), $local, $dados);

        return response()->json([
            'mensagem' => "Oferta enviada para {$oferta->destinatarios} " . ($oferta->destinatarios === 1 ? 'cliente' : 'clientes') . ' que favoritaram o seu local.',
            'oferta' => $oferta,
        ], 201);
    }

    private function local(Request $request, ?Estabelecimento $estabelecimento): Estabelecimento
    {
        $local = $estabelecimento?->exists ? $estabelecimento : Estabelecimento::findOrFail((int) $request->input('estabelecimento_id'));
        abort_unless($this->ofertas->podeEnviar($request->user(), $local), 403, 'Só a equipe responsável pelo local pode enviar ofertas.');

        return $local;
    }
}
