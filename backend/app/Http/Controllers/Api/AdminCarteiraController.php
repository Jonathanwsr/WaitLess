<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ContaBancariaRepasse;
use App\Models\TransferenciaCarteira;
use App\Services\Carteira\CarteiraService;
use Illuminate\Http\Request;
use Inertia\Inertia;

/** Visão do admin sobre todo o dinheiro que saiu das carteiras: repasses, antecipações e validações. */
class AdminCarteiraController extends Controller
{
    public function __construct(private CarteiraService $carteira) {}

    public function index(Request $request)
    {
        $filtros = $request->only(['tipo', 'status', 'busca', 'de', 'ate', 'aba']);

        $query = TransferenciaCarteira::with(['provider:id,name,email', 'conta'])
            ->when($filtros['tipo'] ?? null, fn ($q, $v) => $q->where('tipo', $v))
            ->when($filtros['status'] ?? null, fn ($q, $v) => $q->where('status', $v))
            ->when($filtros['de'] ?? null, fn ($q, $v) => $q->whereDate('created_at', '>=', $v))
            ->when($filtros['ate'] ?? null, fn ($q, $v) => $q->whereDate('created_at', '<=', $v))
            ->when($filtros['busca'] ?? null, function ($q, $v) {
                $q->where(function ($w) use ($v) {
                    $w->where('external_reference', 'like', "%{$v}%")
                        ->orWhere('asaas_transfer_id', 'like', "%{$v}%")
                        ->orWhere('id', ltrim($v, '#'))
                        ->orWhereHas('provider', fn ($p) => $p->where('name', 'like', "%{$v}%")->orWhere('email', 'like', "%{$v}%"));
                });
            });

        $transferencias = $query->latest('id')->paginate(25)->withQueryString()->through(fn (TransferenciaCarteira $t) => [
            'id' => $t->id,
            'nome' => $t->nome,
            'tipo' => $t->tipo,
            'origem' => $t->origem,
            'status' => $t->status,
            'proprietario' => $t->provider?->name,
            'proprietario_email' => $t->provider?->email,
            'destino' => $t->conta?->destinoMascarado(),
            'valor_bruto' => (float) $t->valor_bruto,
            'taxa_plataforma' => (float) $t->taxa_plataforma,
            'taxa_asaas' => (float) $t->taxa_asaas,
            'valor_liquido' => (float) $t->valor_liquido,
            'taxa_status' => $t->taxa_status,
            'asaas_transfer_id' => $t->asaas_transfer_id,
            'asaas_status' => $t->asaas_status,
            'referencia' => $t->external_reference,
            'erro_codigo' => $t->erro_codigo,
            'erro_mensagem' => $t->erro_mensagem,
            'erro_detalhe' => $t->erro_detalhe,
            'tentativas' => $t->tentativas,
            'payload' => $t->payload_enviado,
            'resposta' => $t->resposta_asaas,
            'criado_em' => optional($t->created_at)->toIso8601String(),
            'processado_em' => optional($t->processado_em)->toIso8601String(),
        ]);

        $contas = ContaBancariaRepasse::with('provider:id,name,email')
            ->where('ativa', true)
            ->latest('id')->limit(100)->get()->map(fn (ContaBancariaRepasse $c) => $c->paraTela() + [
                'proprietario' => $c->provider?->name,
                'proprietario_email' => $c->provider?->email,
                'tentativas' => $c->tentativas_validacao,
                'erro_codigo' => $c->ultimo_erro_codigo,
                'validacao_transferencia_id' => $c->validacao_transferencia_id,
            ]);

        $resumo = [
            'repassado' => (float) TransferenciaCarteira::whereIn('tipo', ['repasse', 'antecipacao'])->where('status', 'concluida')->sum('valor_bruto'),
            'taxas_antecipacao' => (float) TransferenciaCarteira::where('tipo', 'antecipacao')->where('taxa_status', 'cobrada')->sum('taxa_plataforma'),
            'em_andamento' => TransferenciaCarteira::whereIn('status', ['pendente', 'processando'])->count(),
            'falhas' => TransferenciaCarteira::where('status', 'falhou')->count(),
            'taxas_pendentes' => TransferenciaCarteira::whereIn('taxa_status', ['falhou', 'devolucao_falhou'])->count(),
            'contas_validadas' => ContaBancariaRepasse::where('ativa', true)->where('status_validacao', 'validada')->count(),
            'contas_com_problema' => ContaBancariaRepasse::where('ativa', true)->where('status_validacao', 'falhou')->count(),
        ];

        return Inertia::render('Admin/Repasses', [
            'transferencias' => $transferencias,
            'contas' => $contas,
            'resumo' => $resumo,
            'filtros' => $filtros,
        ]);
    }

    /** Pergunta ao Asaas o status atual de uma transferência (útil quando ficou "processando"). */
    public function consultar(TransferenciaCarteira $transferencia)
    {
        $mudou = $this->carteira->consultar($transferencia);

        return back()->with('success', $mudou ? "Operação #{$transferencia->id} atualizada." : "Sem novidades para a operação #{$transferencia->id}.");
    }

    /** Força um novo Pix de R$ 0,01 para a conta. */
    public function validarConta(ContaBancariaRepasse $conta)
    {
        if ($conta->estaValidada()) {
            return back()->with('success', 'Essa conta já está validada.');
        }
        $t = $this->carteira->validarConta($conta);

        return back()->with('success', "Validação enviada (operação #{$t->id}) — status: {$t->status}.");
    }
}
