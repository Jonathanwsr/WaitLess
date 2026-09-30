<?php

namespace App\Http\Controllers\Api\Mobile\Proprietario;

use App\Http\Controllers\Api\ContratoController;
use App\Http\Controllers\Controller;
use App\Models\Aluguel;
use App\Models\Contrato;
use App\Models\ContratoTemplate;
use App\Models\Estabelecimento;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;

/**
 * Contratos no app do sócio. Recurso Premium: as regras (quem conta como
 * premium, geração do PDF/Word, envio por e-mail) são as mesmas do web e
 * ficam no ContratoController — aqui só há a casca JSON para o mobile.
 */
class ContratoMobileController extends Controller
{
    private const RESPOSTA_PREMIUM = ['error' => 'Contratos é um recurso Premium. Assine um plano Premium para liberar.', 'premium_necessario' => true];

    public function __construct(private ContratoController $web)
    {
    }

    private function localAutorizado(Request $request): Estabelecimento
    {
        $local = Estabelecimento::findOrFail($request->integer('estabelecimento_id'));
        $this->web->autorizarEstabelecimento($local);

        return $local;
    }

    public function index(Request $request)
    {
        $request->validate(['estabelecimento_id' => 'required|integer']);
        $local = $this->localAutorizado($request);
        $donos = $this->web->donosDoEstabelecimento($local->id);

        if (!$this->web->temPremium($donos)) {
            return response()->json(['premium' => false, 'estabelecimento' => ['id' => $local->id, 'nome' => $local->nome]]);
        }

        $contratos = Contrato::whereHas('aluguel', fn ($q) => $q->whereIn('estabelecimento_id', $donos))
            ->with(['aluguel.locatario:id,name', 'aluguel.item:id,nome'])
            ->latest()
            ->take(50)
            ->get()
            ->map(fn (Contrato $c) => [
                'id' => $c->id,
                'numero' => $c->numero_contrato,
                'titulo' => $c->titulo,
                'cliente' => $c->aluguel?->locatario?->name,
                'item' => $c->aluguel?->item?->nome,
                'enviado_em' => $c->enviado_em?->toIso8601String(),
                'criado_em' => $c->created_at?->toIso8601String(),
                'pdf_url' => $c->arquivo_pdf ? Storage::disk('public')->url($c->arquivo_pdf) : null,
                'docx_url' => $c->arquivo_docx ? Storage::disk('public')->url($c->arquivo_docx) : null,
            ]);

        $pendentes = Aluguel::whereIn('estabelecimento_id', $donos)
            ->whereNull('contrato_id')
            ->with(['item:id,nome', 'locatario:id,name'])
            ->latest()
            ->take(50)
            ->get()
            ->map(fn (Aluguel $a) => [
                'id' => $a->id,
                'codigo' => $a->codigo_reserva,
                'item' => $a->item?->nome,
                'cliente' => $a->locatario?->name,
                'data_inicio' => $a->data_inicio,
                'data_fim' => $a->data_fim,
                'valor_total' => (float) $a->valor_total,
            ]);

        return response()->json([
            'premium' => true,
            'estabelecimento' => ['id' => $local->id, 'nome' => $local->nome],
            'modelos' => ContratoTemplate::where('estabelecimento_id', $local->id)->latest()->get(['id', 'titulo', 'conteudo', 'tipo_reserva', 'padrao']),
            'contratos' => $contratos,
            'reservas_pendentes' => $pendentes,
        ]);
    }

    public function salvarModelo(Request $request)
    {
        $dados = $request->validate([
            'estabelecimento_id' => 'required|integer',
            'titulo' => 'required|string|max:255',
            'conteudo' => 'required|string',
            'tipo_reserva' => 'nullable|string|max:100',
            'padrao' => 'boolean',
        ]);

        $local = $this->localAutorizado($request);
        if (!$this->web->temPremium($this->web->donosDoEstabelecimento($local->id))) {
            return response()->json(self::RESPOSTA_PREMIUM, 403);
        }

        if (!empty($dados['padrao'])) {
            ContratoTemplate::where('estabelecimento_id', $local->id)->update(['padrao' => false]);
        }

        $modelo = ContratoTemplate::create([
            'estabelecimento_id' => $local->id,
            'titulo' => $dados['titulo'],
            'conteudo' => $dados['conteudo'],
            'tipo_reserva' => $dados['tipo_reserva'] ?? 'geral',
            'padrao' => (bool) ($dados['padrao'] ?? false),
        ]);

        return response()->json(['success' => true, 'modelo' => $modelo], 201);
    }

    public function removerModelo($id)
    {
        $modelo = ContratoTemplate::findOrFail($id);
        $local = Estabelecimento::findOrFail($modelo->estabelecimento_id);
        $this->web->autorizarEstabelecimento($local);

        $modelo->delete();

        return response()->json(['success' => true]);
    }

    /** Gera PDF e Word de uma reserva (mesma regra e mesma trava Premium do web). */
    public function gerar(Request $request, $aluguelId)
    {
        return $this->web->gerarContrato($request, $aluguelId);
    }

    public function enviarPorEmail($id)
    {
        return $this->web->enviarPorEmail($id);
    }
}
