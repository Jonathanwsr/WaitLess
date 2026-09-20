<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Models\Agendamento;
use App\Models\Estorno;
use App\Models\Pagamento;
use App\Services\EstornoService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

/**
 * Equivalente mobile de Api\EstornoController: mesma regra de negócio (via
 * EstornoService, compartilhado com o web), mas numa rota própria do app,
 * autenticada por Sanctum — o EstornoController original mistura páginas
 * Inertia com rotas de sessão web, incompatíveis com o token do app.
 */
class EstornoMobileController extends Controller
{
    protected $estornoService;

    public function __construct(EstornoService $estornoService)
    {
        $this->estornoService = $estornoService;
    }

    /**
     * 📋 MINHAS SOLICITAÇÕES DE ESTORNO
     */
    public function minhasSolicitacoes(Request $request)
    {
        $user = Auth::user();

        $query = Estorno::with(['estabelecimento', 'servico', 'itemAluguel'])
            ->where('usuario_id', $user->id);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $estornos = $query->orderBy('created_at', 'desc')->get();

        return response()->json(['status' => 'success', 'data' => $estornos]);
    }

    public function detalhes($id)
    {
        $estorno = Estorno::with(['estabelecimento', 'servico', 'itemAluguel', 'pagamento', 'documentos', 'historicos'])
            ->findOrFail($id);

        if ($estorno->usuario_id !== Auth::id()) {
            return response()->json(['error' => 'Acesso negado.'], 403);
        }

        return response()->json(['status' => 'success', 'data' => $estorno]);
    }

    /**
     * 🔎 PEDIDOS ELEGÍVEIS PARA SOLICITAR ESTORNO
     * (finalizados há no máximo 4 dias e sem estorno em andamento)
     */
    public function elegiveis(Request $request)
    {
        try {
            $userId = Auth::id();

            $agendamentos = Agendamento::with(['servico', 'estabelecimento'])
                ->where('usuario_id', $userId)
                ->where('foi_realizado', true)
                ->whereIn('id', function ($query) {
                    $query->select('agendamento_id')
                        ->from('pagamentos')
                        ->whereIn('status', ['pago', 'PAGO', 'concluido', 'CONCLUIDO'])
                        ->whereNotIn('id', function ($sub) {
                            $sub->select('pagamento_id')
                                ->from('estornos')
                                ->whereIn('status', ['PENDENTE', 'AGUARDANDO_DOCUMENTOS', 'EM_ANALISE', 'APROVADO', 'ESTORNADO', 'CONTESTADO']);
                        });
                })
                ->latest('data_agendamento')
                ->get();

            $pagamentosPorAgendamento = Pagamento::whereIn('agendamento_id', $agendamentos->pluck('id'))
                ->get()
                ->keyBy('agendamento_id');

            $resultado = $agendamentos->map(function (Agendamento $agendamento) use ($pagamentosPorAgendamento) {
                $dataBase = ($agendamento->data_agendamento && $agendamento->hora_finalizacao)
                    ? \Carbon\Carbon::parse($agendamento->data_agendamento . ' ' . $agendamento->hora_finalizacao)
                    : \Carbon\Carbon::parse($agendamento->updated_at);

                $dataLimite = $dataBase->copy()->addDays(4);
                $pagamento = $pagamentosPorAgendamento->get($agendamento->id);

                return [
                    'agendamento_id' => $agendamento->id,
                    'servico' => $agendamento->servico->nome ?? null,
                    'estabelecimento' => $agendamento->estabelecimento->nome ?? null,
                    'estabelecimento_foto' => $agendamento->estabelecimento->foto_perfil ?? null,
                    'data_agendamento' => $agendamento->data_agendamento,
                    'hora_agendamento' => $agendamento->hora_agendamento ? substr($agendamento->hora_agendamento, 0, 5) : null,
                    'data_limite_formatada' => $dataLimite->format('d/m/Y \à\s H:i'),
                    'pode_solicitar' => now()->lessThanOrEqualTo($dataLimite),
                    'pagamento_id' => $pagamento?->id,
                    'valor_total' => $pagamento?->valor,
                    'metodo_pagamento' => $pagamento?->metodo_pagamento,
                ];
            })->filter(fn ($item) => $item['pode_solicitar'] && $item['pagamento_id'])->values();

            return response()->json(['status' => 'success', 'data' => $resultado]);
        } catch (\Exception $e) {
            Log::error('Erro em EstornoMobileController::elegiveis: ' . $e->getMessage());
            return response()->json(['error' => 'Não foi possível carregar os pedidos elegíveis para estorno agora.'], 500);
        }
    }

    /**
     * ✉️ SOLICITAR ESTORNO
     */
    public function solicitar(Request $request, $pagamento_id)
    {
        try {
            $request->validate([
                'motivo' => 'required|string',
                'descricao' => 'required|string|min:10',
                'categoria' => 'required|in:SERVICO,ALUGUEL',
                'subcategoria' => 'nullable|string',
                'imagens' => 'nullable|array|max:5',
                'imagens.*' => 'image|mimes:jpeg,png,jpg|max:2048',
            ]);

            $cliente = Auth::user();

            $pagamento = Pagamento::where(function ($query) use ($pagamento_id) {
                $query->where('id', $pagamento_id)->orWhere('agendamento_id', $pagamento_id);
            })
                ->whereIn('status', ['pago', 'PAGO', 'concluido', 'CONCLUIDO'])
                ->orderBy('id', 'desc')
                ->first();

            if (!$pagamento) {
                return response()->json(['error' => 'Nenhum pagamento concluído foi encontrado para este pedido.'], 404);
            }

            if ($pagamento->usuario_id !== $cliente->id) {
                return response()->json(['error' => 'Este pagamento não pertence a você.'], 403);
            }

            if ($pagamento->agendamento_id) {
                $agendamento = Agendamento::find($pagamento->agendamento_id);

                if ($agendamento) {
                    if (!$agendamento->foi_realizado) {
                        return response()->json(['error' => 'Você só pode solicitar estorno de um serviço que já foi finalizado.'], 403);
                    }

                    $dataConclusao = ($agendamento->data_agendamento && $agendamento->hora_finalizacao)
                        ? \Carbon\Carbon::parse($agendamento->data_agendamento . ' ' . $agendamento->hora_finalizacao)
                        : \Carbon\Carbon::parse($agendamento->updated_at);

                    if (now()->greaterThan($dataConclusao->copy()->addDays(4))) {
                        return response()->json(['error' => 'O prazo de 4 dias após a conclusão do serviço para solicitar estorno expirou.'], 403);
                    }
                }
            }

            $imagens = $request->file('imagens') ?? [];
            $estorno = $this->estornoService->solicitarEstorno($cliente, $pagamento, $request->all(), $imagens);

            return response()->json([
                'status' => 'success',
                'message' => 'Solicitação de estorno enviada com sucesso.',
                'data' => $estorno,
            ], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['error' => collect($e->errors())->flatten()->first()], 422);
        } catch (\Exception $e) {
            Log::error('Erro ao solicitar estorno (mobile): ' . $e->getMessage());
            return response()->json(['error' => $e->getMessage()], 400);
        }
    }

    /**
     * 📄 COMPROVANTE DE ESTORNO (PDF)
     */
    public function comprovantePDF($id)
    {
        $estorno = Estorno::with(['cliente', 'prestador', 'estabelecimento', 'pagamento'])->findOrFail($id);
        $user = Auth::user();

        if ($estorno->usuario_id !== $user->id && $estorno->prestador_id !== $user->id) {
            abort(403, 'Acesso negado.');
        }

        if ($estorno->status !== 'ESTORNADO') {
            return response()->json(['error' => 'O comprovante só fica disponível após o estorno ser concluído.'], 404);
        }

        $pdf = Pdf::loadView('pdfs.estorno', compact('estorno'));

        return response($pdf->output(), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => "inline; filename=\"Estorno_Lokyva_{$estorno->id}.pdf\"",
        ]);
    }
}
