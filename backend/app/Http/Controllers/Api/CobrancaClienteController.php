<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cobranca;
use App\Services\CobrancaParceladaService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Symfony\Component\HttpKernel\Exception\HttpException;

/** Lado do cliente: vê as cobranças que recebeu com todos os detalhes e aceita ou recusa. */
class CobrancaClienteController extends Controller
{
    public function __construct(private CobrancaParceladaService $cobrancas)
    {
    }

    public function index(Request $request)
    {
        $dados = ['cobrancas' => $this->cobrancas->listarDoCliente($request->user())];

        if ($request->wantsJson()) {
            return response()->json($dados);
        }

        return Inertia::render('Cobrancas/MinhasCobrancas', $dados);
    }

    public function comprovante(Request $request, Cobranca $cobranca)
    {
        abort_unless((int) $cobranca->cliente_id === (int) $request->user()->id, 403, 'Esta cobrança não é sua.');

        $pdf = Pdf::loadView('pdfs.comprovante_cobranca', $this->cobrancas->dadosComprovante($cobranca));

        return $pdf->download("Comprovante_Cobranca_{$cobranca->codigo}.pdf");
    }

    public function aceitar(Request $request, Cobranca $cobranca)
    {
        return $this->responder(function () use ($request, $cobranca) {
            $atualizada = $this->cobrancas->aceitar($request->user(), $cobranca);

            return response()->json(['message' => 'Cobrança aceita! Pague cada parcela pelo link de pagamento.', 'cobranca' => $atualizada]);
        });
    }

    public function recusar(Request $request, Cobranca $cobranca)
    {
        return $this->responder(function () use ($request, $cobranca) {
            $atualizada = $this->cobrancas->recusar($request->user(), $cobranca);

            return response()->json(['message' => 'Cobrança recusada.', 'cobranca' => $atualizada]);
        });
    }

    private function responder(callable $acao)
    {
        try {
            return $acao();
        } catch (\DomainException $e) {
            return response()->json(['error' => $e->getMessage()], 409);
        } catch (HttpException $e) {
            throw $e;
        } catch (\Throwable $e) {
            Log::error('Erro ao responder cobrança parcelada: ' . $e->getMessage());

            return response()->json(['error' => 'Não foi possível concluir agora. Tente novamente em instantes.'], 500);
        }
    }
}
