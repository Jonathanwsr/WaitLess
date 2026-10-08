<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Funcionario;
use App\Models\PedidoEntrega;
use App\Services\Entregas\EntregasRecursosService;
use Illuminate\Http\Request;
use Inertia\Inertia;

/**
 * Área de entregas de quem trabalha no local. Sócio/gerente vê todas as entregas do local (e as
 * que fez), escolhe quem entrega e finaliza. Funcionário vê só as entregas em que foi designado,
 * com os dados do cliente. O código de 6 dígitos nunca é enviado para esta área.
 */
class EntregasGestaoController extends Controller
{
    private const PAPEIS_FUNCIONARIO = ['funcionario', 'atendente'];

    public function index(Request $request)
    {
        $dados = $this->montar($request);

        if ($request->wantsJson()) {
            return response()->json($dados);
        }

        return Inertia::render('Entregas/Gestao', $dados);
    }

    /** @return array{pedidos: array, funcionarios: array, gerente: bool, papel: string} */
    private function montar(Request $request): array
    {
        $user = $request->user();
        $papel = strtolower((string) $user->papel);
        $ehFuncionario = in_array($papel, self::PAPEIS_FUNCIONARIO, true);

        $estabelecimentosIds = $user->estabelecimentos()->pluck('estabelecimentos.id');

        $query = PedidoEntrega::with([
            'produto:id,nome,fotos,categoria',
            'cliente:id,name,mobile_phone,email',
            'estabelecimento:id,nome',
            'funcionario:id,nome,usuario_id',
            'entregador:id,name',
        ])->orderByDesc('created_at');

        if ($ehFuncionario) {
            $query->where('entregador_usuario_id', $user->id);
        } else {
            $query->where(function ($q) use ($user, $estabelecimentosIds) {
                $q->where('vendedor_id', $user->id)
                    ->orWhereIn('estabelecimento_id', $estabelecimentosIds)
                    ->orWhere('entregador_usuario_id', $user->id);
            });
        }

        $web = app(PedidoEntregaController::class);
        $pedidos = $query->limit(200)->get()->map(function (PedidoEntrega $p) use ($web, $user, $ehFuncionario, $estabelecimentosIds) {
            $dados = $web->dadosDoPedidoParaCliente($p);
            unset($dados['codigo_confirmacao_visivel']);

            $gerenciaEste = !$ehFuncionario
                && ((int) $p->vendedor_id === (int) $user->id || $estabelecimentosIds->contains($p->estabelecimento_id));

            return array_merge($dados, [
                'cliente' => [
                    'nome' => $p->cliente?->name,
                    'telefone' => $p->cliente?->mobile_phone,
                    'email' => $p->cliente?->email,
                ],
                'funcionario_nome' => $p->funcionario?->nome,
                'entregador_nome' => $p->entregador?->name,
                'eu_sou_entregador' => (int) $p->entregador_usuario_id === (int) $user->id,
                'pode_finalizar' => in_array($p->status, ['pago', 'aguardando_confirmacao'], true),
                'pode_atribuir' => $gerenciaEste,
                'pode_cancelar' => $gerenciaEste && in_array($p->status, ['pendente_pagamento', 'aguardando_confirmacao', 'pago'], true),
                'pode_posicao' => $gerenciaEste || (int) $p->entregador_usuario_id === (int) $user->id,
                'monitoramento' => EntregasRecursosService::vendedorMonitora($p),
                'precisa_codigo' => $p->modo_pagamento === 'online',
            ]);
        })->values()->all();

        $funcionarios = $ehFuncionario ? [] : Funcionario::whereIn('estabelecimento_id', $estabelecimentosIds)
            ->where('ativo', true)
            ->get(['id', 'nome', 'estabelecimento_id'])
            ->map(fn ($f) => ['id' => $f->id, 'nome' => $f->nome, 'estabelecimento_id' => $f->estabelecimento_id])
            ->values()
            ->all();

        return [
            'pedidos' => $pedidos,
            'funcionarios' => $funcionarios,
            'papel' => $ehFuncionario ? 'funcionario' : 'gestor',
        ];
    }
}
