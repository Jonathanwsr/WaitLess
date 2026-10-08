<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cobranca;
use App\Models\CobrancaParcela;
use App\Models\Estabelecimento;
use App\Services\CobrancaParceladaService;
use App\Services\PagamentoService;
use App\Support\Taxas;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Lado do sócio: monta cobranças parceladas (serviços e/ou reserva), acompanha as parcelas,
 * dá baixa nas presenciais e sincroniza com o Asaas. Criar exige sócio premium.
 */
class CobrancaController extends Controller
{
    public function __construct(private CobrancaParceladaService $cobrancas)
    {
    }

    public function index(Request $request)
    {
        $user = $request->user();

        $dados = [
            'cobrancas' => $this->cobrancas->listarDoSocio($user),
            'estabelecimentos' => $this->cobrancas->estabelecimentosDoSocio($user),
            'podeCriar' => $this->cobrancas->podeCriar($user),
            'taxaPercentual' => Taxas::percentualCobrancas(),
            'parteDoSocioPercentual' => Taxas::parteDoSocioCobrancasPercentual(),
        ];

        if ($request->wantsJson()) {
            return response()->json($dados);
        }

        return Inertia::render('Cobrancas/Socio', $dados);
    }

    public function opcoes(Request $request)
    {
        $dados = $request->validate(['estabelecimento_id' => 'required|integer|exists:estabelecimentos,id']);
        $estabelecimento = Estabelecimento::findOrFail($dados['estabelecimento_id']);

        return $this->responder(fn () => response()->json($this->cobrancas->opcoes($request->user(), $estabelecimento)));
    }

    public function buscarClientes(Request $request)
    {
        $termo = (string) $request->query('q', '');

        return response()->json(['clientes' => $this->cobrancas->buscarClientes($request->user(), $termo)]);
    }

    public function store(Request $request)
    {
        if (!$this->cobrancas->podeCriar($request->user())) {
            return response()->json(['error' => 'Cobranças parceladas são exclusivas de sócios com plano premium de sócio.'], 403);
        }

        $dados = $request->validate([
            'estabelecimento_id' => 'required|integer|exists:estabelecimentos,id',
            'cliente_id' => 'required|integer|exists:users,id',
            'modo' => 'required|in:online,presencial',
            'parcelas' => 'required|integer|min:1|max:' . PagamentoService::PARCELAS_MAXIMAS,
            'primeiro_vencimento' => 'required|date|after_or_equal:' . now(CobrancaParceladaService::FUSO)->toDateString(),
            'descricao' => 'nullable|string|max:500',
            'itens' => 'required|array|min:1|max:30',
            'itens.*.tipo' => 'required|in:servico,reserva',
            'itens.*.id' => 'required|integer',
            'itens.*.valor' => 'nullable|numeric|min:0.01|max:999999',
            'itens.*.funcionario_id' => 'nullable|integer',
        ]);

        $estabelecimento = Estabelecimento::findOrFail($dados['estabelecimento_id']);

        return $this->responder(function () use ($request, $estabelecimento, $dados) {
            $cobranca = $this->cobrancas->criar($request->user(), $estabelecimento, $dados);

            return response()->json([
                'message' => 'Cobrança enviada! O cliente precisa aceitar para os pagamentos começarem.',
                'cobranca' => $cobranca,
            ], 201);
        });
    }

    public function comprovante(Request $request, Cobranca $cobranca)
    {
        abort_unless((int) $cobranca->criado_por_usuario_id === (int) $request->user()->id, 403, 'Esta cobrança não é sua.');

        $pdf = Pdf::loadView('pdfs.comprovante_cobranca', $this->cobrancas->dadosComprovante($cobranca));

        return $pdf->download("Comprovante_Cobranca_{$cobranca->codigo}.pdf");
    }

    public function cancelar(Request $request, Cobranca $cobranca)
    {
        return $this->responder(function () use ($request, $cobranca) {
            $atualizada = $this->cobrancas->cancelar($request->user(), $cobranca);

            return response()->json(['message' => 'Cobrança cancelada.', 'cobranca' => $atualizada]);
        });
    }

    public function baixa(Request $request, CobrancaParcela $parcela)
    {
        $dados = $request->validate(['data_pagamento' => 'nullable|date|before_or_equal:today']);

        return $this->responder(function () use ($request, $parcela, $dados) {
            $atualizada = $this->cobrancas->darBaixa($request->user(), $parcela, $dados['data_pagamento'] ?? null);

            return response()->json(['message' => 'Parcela marcada como paga.', 'parcela' => $atualizada]);
        });
    }

    public function sincronizar(Request $request, CobrancaParcela $parcela)
    {
        abort_unless((int) $parcela->cobranca->criado_por_usuario_id === (int) $request->user()->id, 403, 'Esta cobrança não é sua.');

        return $this->responder(function () use ($parcela) {
            $status = $this->cobrancas->sincronizarParcela($parcela);

            return response()->json(['message' => 'Parcela atualizada com o Asaas.', 'status' => $status]);
        });
    }

    /** Regra de negócio vira 409 com a mensagem; falha inesperada não expõe detalhes. */
    private function responder(callable $acao)
    {
        try {
            return $acao();
        } catch (\DomainException $e) {
            return response()->json(['error' => $e->getMessage()], 409);
        } catch (ValidationException|HttpException $e) {
            throw $e;
        } catch (\Throwable $e) {
            Log::error('Erro em cobrança parcelada: ' . $e->getMessage());

            return response()->json(['error' => 'Não foi possível concluir agora. Tente novamente em instantes.'], 500);
        }
    }
}
