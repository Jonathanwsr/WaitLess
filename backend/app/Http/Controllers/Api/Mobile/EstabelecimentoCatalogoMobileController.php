<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Estabelecimento;
use App\Models\Servico;
use App\Models\Agendamento;
use App\Models\Pagamento;
use App\Models\Produto;
use App\Services\PagamentoService;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Exception;

class EstabelecimentoCatalogoMobileController extends Controller
{
    /**
     * 👉 DETALHES DO ESTABELECIMENTO E CATÁLOGO (Padrão iFood / Tela Home do Estabelecimento)
     */
    public function show($id)
    {
        try {
            $estabelecimento = Estabelecimento::with(['servicos' => function($q) {
                $q->where('ativo', true);
            }])->findOrFail($id);

            // Busca cupons ativos vinculados a este estabelecimento
            $cupons = DB::table('cupons')
                ->where('estabelecimento_id', $estabelecimento->id)
                ->where('ativo', true)
                ->get();

            return response()->json([
                'estabelecimento' => [
                    'id'               => $estabelecimento->id,
                    'nome'             => $estabelecimento->nome,
                    'ramo_atuacao'     => $estabelecimento->ramo_atuacao,
                    'foto_perfil'      => $estabelecimento->foto_perfil,
                    'avaliacao_media'  => $estabelecimento->avaliacao_media ?? 5.0,
                    'total_avaliacoes' => $estabelecimento->total_avaliacoes ?? 0,
                    'endereco'         => "{$estabelecimento->rua}, {$estabelecimento->numero} - {$estabelecimento->bairro}"
                ],
                'destaques' => $estabelecimento->servicos,
                'cupons'    => $cupons
            ], 200);

        } catch (Exception $e) {
            return response()->json(['error' => 'Estabelecimento não encontrado.'], 404);
        }
    }

    /**
     * 👉 PRODUTOS EXTRAS DISPONÍVEIS PARA ADICIONAR AO PEDIDO (estilo iFood)
     * Equivalente mobile de Api\ProdutoController::produtosDisponiveisParaCliente
     * — mesma regra (estoque disponível, atrelado a reservas, respeita
     * benefício premium), servida numa rota autenticada por Sanctum.
     */
    public function listarProdutos($estabelecimentoId)
    {
        try {
            $usuario = Auth::user();
            $planosPremium = ['premium', 'premium_plus', 'pro'];
            $isPremium = in_array(strtolower($usuario->plano_assinatura ?? ''), $planosPremium);

            $query = Produto::where('estabelecimento_id', $estabelecimentoId)
                ->where('estoque_disponivel', '>', 0)
                ->where('atrelado_reservas', true);

            if (!$isPremium) {
                $query->where('somente_premium', false);
            }

            $produtos = $query->orderBy('is_promocao', 'desc')
                ->orderBy('nome', 'asc')
                ->get(['id', 'nome', 'descricao', 'valor_final', 'valor_normal', 'is_promocao', 'fotos', 'estoque_disponivel'])
                ->map(function (Produto $produto) {
                    $fotos = Produto::decodeFotos($produto->fotos);
                    return [
                        'id' => $produto->id,
                        'nome' => $produto->nome,
                        'descricao' => $produto->descricao,
                        'valor' => (float) $produto->valor_final,
                        'valor_original' => $produto->is_promocao ? (float) $produto->valor_normal : null,
                        'foto' => $fotos[0] ?? null,
                        'estoque_disponivel' => $produto->estoque_disponivel,
                    ];
                });

            return response()->json(['status' => 'success', 'data' => $produtos]);
        } catch (Exception $e) {
            Log::error('Erro ao listar produtos extras (mobile): ' . $e->getMessage());
            return response()->json(['error' => 'Não conseguimos carregar os itens adicionais agora.'], 500);
        }
    }

    /**
     * 👉 INICIA O PEDIDO/RESERVA E SEGUE PARA O PAGAMENTO
     */
    public function criarPedidoSacola(Request $request, PagamentoService $pagamentoService)
    {
        $request->validate([
            'estabelecimento_id' => 'required|exists:estabelecimentos,id',
            'servico_id'         => 'required|exists:servicos,id',
            'data_agendamento'   => 'required|date',
            'hora_agendamento'   => 'required|string',
            'metodo_pagamento'   => 'required|in:pix,cartao,boleto,local',
            'cupom_id'           => 'nullable|exists:cupons,id'
        ]);

        try {
            DB::beginTransaction();

            $servico = Servico::findOrFail($request->servico_id);
            $valorFinal = $servico->valor;

            // Aplica desconto do cupom se enviado
            if ($request->filled('cupom_id')) {
                $cupom = DB::table('cupons')->where('id', $request->cupom_id)->first();
                if ($cupom) {
                    if ($cupom->tipo_desconto === 'percentual') {
                        $valorFinal -= ($valorFinal * ($cupom->valor_desconto / 100));
                    } else {
                        $valorFinal -= $cupom->valor_desconto;
                    }
                    $valorFinal = max(0, $valorFinal);
                }
            }

            $pin = (string) mt_rand(1000, 9999);

            // Cria o agendamento vinculado nas tabelas oficiais
            $agendamento = Agendamento::create([
                'usuario_id'         => Auth::id(),
                'estabelecimento_id' => $request->estabelecimento_id,
                'servico_id'         => $servico->id,
                'data_agendamento'   => $request->data_agendamento,
                'hora_agendamento'   => $request->hora_agendamento,
                'status'             => 'aguardando_pagamento',
                'status_pagamento'   => 'pendente',
                'valor_final'        => $valorFinal,
                'codigo_verificacao' => $pin
            ]);

            DB::commit();

            // Se for pagamento online (Asaas), gera a cobrança via Service
            if ($request->metodo_pagamento !== 'local') {
                $user = Auth::user();
                $cobranca = $pagamentoService->criarCobrancaAsaas(
                    $agendamento,
                    $request->metodo_pagamento,
                    $user->asaas_customer_id ?? null,
                    1
                );

                return response()->json([
                    'status'      => 'success',
                    'agendamento' => $agendamento,
                    'invoice_url' => $cobranca['invoice_url'] ?? null,
                    'pix_qr_code' => $cobranca['pix_qr_code'] ?? null
                ], 201);
            }

            // Se for pagamento no local
            $agendamento->update(['status' => 'confirmado', 'status_pagamento' => 'local']);

            return response()->json([
                'status'      => 'success',
                'message'     => 'Reserva confirmada para pagamento no local!',
                'agendamento' => $agendamento,
                'pin'         => $pin
            ], 201);

        } catch (Exception $e) {
            DB::rollBack();
            return response()->json(['error' => 'Erro ao processar reserva: ' . $e->getMessage()], 500);
        }
    }
}