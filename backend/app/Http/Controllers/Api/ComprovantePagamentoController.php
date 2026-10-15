<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Pagamento;
use App\Services\ComprovantePagamentoService;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Http\Request;

/** Comprovante de pagamento em PDF (web e app) e a conferência pública do código de autenticação. */
class ComprovantePagamentoController extends Controller
{
    public function __construct(private ComprovantePagamentoService $comprovantes)
    {
    }

    /**
     * Aceita o id do pagamento ou a referência do que foi pago (agendamento, reserva ou pedido):
     * as telas nem sempre conhecem o id do pagamento.
     */
    public function pdf(Request $request)
    {
        $ref = $request->validate([
            'pagamento_id' => 'nullable|integer',
            'agendamento_id' => 'nullable|integer',
            'aluguel_id' => 'nullable|integer',
            'pedido_entrega_id' => 'nullable|integer',
        ]);
        $ref = array_filter($ref);
        abort_if(count($ref) !== 1, 422, 'Informe qual pagamento deseja.');

        $campo = array_key_first($ref) === 'pagamento_id' ? 'id' : array_key_first($ref);
        $pagamento = Pagamento::where($campo, (int) reset($ref))
            ->whereIn('status', ComprovantePagamentoService::STATUS_COM_COMPROVANTE)
            ->latest('id')
            ->first();

        abort_unless($pagamento, 404, 'Nenhum pagamento confirmado encontrado para gerar o comprovante.');
        // Comprovante individual: cada um baixa só a sua via (o admin escolhe com ?via=recebedor).
        $via = $this->comprovantes->viaDe($request->user(), $pagamento, $request->query('via'));
        abort_unless($via, 403, 'Este comprovante não é seu.');

        return Pdf::loadView('pdfs.comprovante_pagamento', ['comprovantes' => [$this->comprovantes->dados($pagamento, $request->user(), $via)]])
            ->setPaper('a4')
            ->download($this->comprovantes->nomeArquivo($pagamento, $via));
    }

    /**
     * Busca do sócio/gerente/dono: pagamentos recebidos num período, agrupados por cliente.
     * Nada é listado antes da busca, para a tela não encher.
     */
    public function recebidos(Request $request)
    {
        $dados = $request->validate([
            'de' => 'required|date',
            'ate' => 'required|date|after_or_equal:de',
            'busca' => 'nullable|string|max:100',
        ], [], ['de' => 'data inicial', 'ate' => 'data final']);

        abort_if(Carbon::parse($dados['de'])->diffInDays(Carbon::parse($dados['ate'])) > 366, 422, 'Escolha um período de até 1 ano.');

        return response()->json(['clientes' => $this->comprovantes->recebidosPorCliente(
            $request->user(), $dados['de'], $dados['ate'], $dados['busca'] ?? null
        )]);
    }

    /** Vários comprovantes de recebimento num só PDF (um por página): os escolhidos ou todos de um cliente. */
    public function lote(Request $request)
    {
        $dados = $request->validate(['ids' => 'required|array|min:1|max:50', 'ids.*' => 'integer']);
        @ini_set('memory_limit', '512M');
        @set_time_limit(120);

        $ids = array_values(array_unique(array_map('intval', $dados['ids'])));
        $pagamentos = Pagamento::whereIn('id', $ids)
            ->whereIn('status', ComprovantePagamentoService::STATUS_COM_COMPROVANTE)
            ->orderBy('data_pagamento')->orderBy('id')
            ->get();
        abort_if($pagamentos->count() !== count($ids), 404, 'Algum pagamento não foi encontrado.');

        $comprovantes = $pagamentos->map(function (Pagamento $p) use ($request) {
            // Lote é para quem recebeu: cada pagamento precisa ser dele.
            abort_unless($this->comprovantes->viaDe($request->user(), $p, 'recebedor') === 'recebedor', 403, 'Algum desses comprovantes não é seu.');

            return $this->comprovantes->dados($p, $request->user(), 'recebedor');
        })->all();

        $nome = count($comprovantes) === 1
            ? $this->comprovantes->nomeArquivo($pagamentos->first(), 'recebedor')
            : 'Comprovantes_recebimento_' . count($comprovantes) . '.pdf';

        return Pdf::loadView('pdfs.comprovante_pagamento', ['comprovantes' => $comprovantes])->setPaper('a4')->download($nome);
    }

    /** Página pública: qualquer pessoa confere se um comprovante é verdadeiro pelo código. */
    public function verificar(Request $request)
    {
        $codigo = (string) $request->query('codigo', '');
        $resultado = $codigo !== '' ? $this->comprovantes->verificar($codigo) : null;

        return response()->view('comprovantes.verificar', ['codigo' => $codigo, 'resultado' => $resultado]);
    }
}
