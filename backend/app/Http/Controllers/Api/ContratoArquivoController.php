<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contrato;
use App\Services\Locacao\ContratoReservaService;
use Illuminate\Http\Request;

/**
 * Contrato da reserva para o cliente (e para quem gerencia a reserva):
 * - mostrar(): dados + texto do contrato, com links temporários (web e app);
 * - arquivo(): entrega o PDF/Word por link assinado — funciona ao abrir no navegador do celular.
 */
class ContratoArquivoController extends Controller
{
    public function __construct(private ContratoReservaService $contratos) {}

    public function mostrar(Request $request, Contrato $contrato)
    {
        abort_unless($this->contratos->podeVer($contrato, $request->user()), 403, 'Você não tem acesso a este contrato.');

        return response()->json(['contrato' => $this->contratos->paraTela($contrato)]);
    }

    /** "Li e aceito" do cliente (web e app). */
    public function aceitar(Request $request, Contrato $contrato)
    {
        $request->validate(['aceito' => 'accepted'], ['aceito.accepted' => 'Marque que você leu e aceita o contrato.']);

        $aparelho = $request->header('X-Aparelho') ?: $request->userAgent();
        $contrato = $this->contratos->aceitar($contrato, $request->user(), $request->ip(), $aparelho);

        return response()->json(['message' => 'Contrato aceito. O proprietário foi avisado.', 'contrato' => $this->contratos->paraTela($contrato, $request->user())]);
    }

    public function arquivo(Contrato $contrato, string $formato)
    {
        abort_unless(in_array($formato, ['pdf', 'docx'], true), 404);
        $caminho = $this->contratos->caminho($contrato, $formato);
        abort_unless($caminho, 404, 'O arquivo deste contrato não está mais disponível. Peça ao proprietário para gerar de novo.');

        $nome = ($contrato->numero_contrato ?: 'contrato') . '.' . $formato;

        return $formato === 'pdf'
            ? response()->file($caminho, ['Content-Type' => 'application/pdf', 'Content-Disposition' => 'inline; filename="' . $nome . '"'])
            : response()->download($caminho, $nome);
    }
}
