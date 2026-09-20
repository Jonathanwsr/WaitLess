<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Models\Agendamento;
use App\Models\Pagamento;
use App\Services\PagamentoService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class PagamentoMobileController extends Controller
{
    /**
     * 👉 RESUMO DO PEDIDO
     * Usado tanto pela tela de pagamento (antes de pagar, para mostrar o que
     * será cobrado — serviço + produtos extras incluídos) quanto pela tela de
     * confirmação (depois de pagar, para mostrar o PIN e os detalhes finais).
     */
    public function resumoPagamento($agendamentoId)
    {
        $agendamento = Agendamento::with(['servico', 'funcionario', 'estabelecimento:id,nome,foto_perfil'])->find($agendamentoId);

        if (!$agendamento || $agendamento->usuario_id !== Auth::id()) {
            return response()->json(['error' => 'Pedido não encontrado.'], 404);
        }

        $produtos = DB::table('produtos')
            ->where('agendamento_id', $agendamento->id)
            ->get(['id', 'nome', 'valor_final', 'fotos'])
            ->map(function ($produto) {
                $fotos = \App\Models\Produto::decodeFotos($produto->fotos);
                return [
                    'id' => $produto->id,
                    'nome' => $produto->nome,
                    'valor' => (float) $produto->valor_final,
                    'foto' => $fotos[0] ?? null,
                ];
            });

        $pagamento = Pagamento::where('agendamento_id', $agendamento->id)->latest()->first();

        return response()->json([
            'agendamento_id' => $agendamento->id,
            'estabelecimento_nome' => $agendamento->estabelecimento->nome ?? null,
            'estabelecimento_foto' => $agendamento->estabelecimento->foto_perfil ?? null,
            'servico_nome' => $agendamento->servico->nome ?? null,
            'funcionario_nome' => $agendamento->funcionario->nome ?? 'Profissional da casa',
            'data_formatada' => $agendamento->data_agendamento ? \Carbon\Carbon::parse($agendamento->data_agendamento)->format('d/m/Y') : null,
            'hora_formatada' => $agendamento->hora_agendamento ? substr($agendamento->hora_agendamento, 0, 5) : null,
            'pin' => $agendamento->codigo_verificacao,
            'produtos' => $produtos,
            'valor_total' => (float) ($pagamento->valor ?? $agendamento->valor_final ?? 0),
            'status_pagamento' => $agendamento->status_pagamento,
            'status' => $agendamento->status,
            'ja_esta_pago' => in_array($agendamento->status_pagamento, ['pago', 'pago_online', 'local', 'presencial']),
        ]);
    }

    /**
     * 👉 GERA A COBRANÇA (PIX, boleto, cartão ou local)
     * Se já existir uma cobrança pendente para o mesmo agendamento, ela é
     * descartada antes de gerar uma nova — evita que o cliente acabe com
     * duas cobranças abertas ao tentar pagar mais de uma vez.
     */
    public function processar(Request $request, PagamentoService $pagamentoService)
    {
        $request->validate([
            'agendamento_id'    => 'required|exists:agendamentos,id',
            'asaas_customer_id' => 'required_unless:metodo_pagamento,local|string',
            'metodo_pagamento'  => 'required|in:pix,boleto,cartao,local',
            'parcelas'          => 'nullable|integer|min:1|max:12',
        ]);

        $agendamento = Agendamento::with(['servico', 'estabelecimento'])->find($request->agendamento_id);

        if (!$agendamento || $agendamento->usuario_id !== Auth::id()) {
            return response()->json(['error' => 'Não foi possível localizar este pedido.'], 404);
        }

        if (in_array($agendamento->status_pagamento, ['pago', 'pago_online', 'local', 'presencial'])) {
            return response()->json(['error' => 'Este pedido já está pago, não é possível pagar novamente.'], 409);
        }

        try {
            if ($request->metodo_pagamento === 'local') {
                $codigoPin = str_pad((string) mt_rand(0, 9999), 4, '0', STR_PAD_LEFT);

                $agendamento->update([
                    'status_pagamento'   => 'local',
                    'status'             => 'confirmado',
                    'codigo_verificacao' => $codigoPin,
                ]);

                $pagamentoService->enviarEmailNotificacao($agendamento, 'local');

                return response()->json([
                    'status'  => 'success',
                    'message' => 'Reserva confirmada! O pagamento será feito no estabelecimento.',
                    'metodo'  => 'local',
                    'pin'     => $codigoPin,
                ], 200);
            }

            // Evita cobrança duplicada: descarta qualquer cobrança pendente
            // anterior para este mesmo agendamento antes de gerar uma nova.
            Pagamento::where('agendamento_id', $agendamento->id)->where('status', 'pendente')->delete();

            $resultado = $pagamentoService->criarCobrancaAsaas(
                $agendamento,
                $request->metodo_pagamento,
                $request->asaas_customer_id,
                $request->input('parcelas', 1)
            );

            return response()->json([
                'status'      => 'success',
                'message'     => 'Cobrança gerada com sucesso!',
                'payment_id'  => $resultado['payment_id'],
                'pix_qr_code' => $resultado['pix_qr_code'],
                'invoice_url' => $resultado['invoice_url'],
            ], 200);
        } catch (\Exception $e) {
            Log::error('Erro no PagamentoMobileController::processar: ' . $e->getMessage());
            return response()->json([
                'status'  => 'error',
                'message' => 'Não foi possível gerar a cobrança agora. Tente novamente em instantes.',
            ], 500);
        }
    }

    /**
     * 👉 TENTAR PAGAR NOVAMENTE (pedido ficou pendente e o cliente voltou depois)
     */
    public function pagarNovamente(Request $request, $id, PagamentoService $pagamentoService)
    {
        $request->validate([
            'metodo_pagamento' => 'required|string|in:pix,cartao,boleto',
            'parcelas'         => 'nullable|integer|min:1|max:12',
        ]);

        $agendamento = Agendamento::with(['servico', 'estabelecimento'])->find($id);

        if (!$agendamento || $agendamento->usuario_id !== Auth::id()) {
            return response()->json(['error' => 'Pedido não encontrado.'], 404);
        }

        if (in_array($agendamento->status_pagamento, ['pago', 'pago_online'])) {
            return response()->json(['error' => 'Este pedido já está pago.'], 409);
        }

        if ($agendamento->status === 'cancelado') {
            return response()->json(['error' => 'Este pedido já foi cancelado.'], 409);
        }

        $dataAgendamento = \Carbon\Carbon::parse($agendamento->data_agendamento . ' ' . $agendamento->hora_agendamento);
        $limite = ($agendamento->created_at ?: now())->diffInHours($dataAgendamento) > 2
            ? $dataAgendamento->copy()->subHours(2)
            : $dataAgendamento;

        if (now()->isAfter($limite)) {
            $agendamento->update(['status' => 'cancelado', 'status_pagamento' => 'cancelado']);
            return response()->json(['error' => 'O prazo para pagar esse pedido expirou e ele foi cancelado automaticamente.'], 410);
        }

        try {
            Pagamento::where('agendamento_id', $agendamento->id)->where('status', 'pendente')->delete();

            $resultado = $pagamentoService->criarCobrancaAsaas(
                $agendamento,
                $request->metodo_pagamento,
                Auth::user()->asaas_customer_id,
                $request->parcelas ?? 1
            );

            if (empty($resultado['invoice_url'])) {
                return response()->json(['error' => 'Não foi possível gerar o link de pagamento agora. Tente novamente.'], 500);
            }

            return response()->json([
                'status'      => 'success',
                'invoice_url' => $resultado['invoice_url'],
                'pix_qr_code' => $resultado['pix_qr_code'],
            ]);
        } catch (\Exception $e) {
            Log::error("Erro ao tentar pagar novamente agendamento #{$id}: " . $e->getMessage());
            return response()->json(['error' => 'Erro temporário ao gerar o link de pagamento. Tente novamente.'], 500);
        }
    }

    public function detalhesCheckout($id)
    {
        try {
            $agendamento = Agendamento::with(['estabelecimento', 'funcionario', 'servico'])->findOrFail($id);

            return response()->json([
                'id' => $agendamento->id,
                'estabelecimento_nome' => $agendamento->estabelecimento->nome,
                'estabelecimento_foto' => $agendamento->estabelecimento->foto_perfil,
                'servico_nome' => $agendamento->servico->nome,
                'funcionario_nome' => $agendamento->funcionario->nome ?? 'Profissional da casa',
                'data_formatada' => \Carbon\Carbon::parse($agendamento->data_agendamento)->format('d/m/Y'),
                'hora_formatada' => \Carbon\Carbon::parse($agendamento->hora_agendamento)->format('H:i'),
                'duracao_minutos' => $agendamento->servico->duracao_minutos ?? 45,
                'valor_total' => $agendamento->valor_final,
                'pin' => $agendamento->codigo_verificacao,
            ], 200);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Agendamento não encontrado.'], 404);
        }
    }
}
