<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agendamento;
use App\Models\Estorno;
use App\Models\Pagamento;
use App\Services\AsaasWalletService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

/**
 * Painel do Admin para auditoria de agendamentos: status, forma de pagamento,
 * local, quem fez, quem finalizou/assinou e se houve solicitação de estorno,
 * além do histórico completo de mudanças de status (historico_agendamentos).
 */
class AdminAgendamentoController extends Controller
{
    protected $asaasWallet;

    public function __construct(AsaasWalletService $asaasWallet)
    {
        $this->asaasWallet = $asaasWallet;
    }

    public function index(Request $request)
    {
        if (Auth::user()->papel !== 'admin') abort(403);

        $query = Agendamento::with(['usuario:id,name,email', 'estabelecimento:id,nome', 'servico:id,nome', 'finalizadoPor:id,name'])
            ->orderByDesc('data_agendamento')
            ->orderByDesc('id');

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('busca')) {
            $busca = $request->busca;
            $query->where(function ($q) use ($busca) {
                $q->whereHas('usuario', fn ($u) => $u->where('name', 'like', "%{$busca}%"))
                  ->orWhereHas('estabelecimento', fn ($e) => $e->where('nome', 'like', "%{$busca}%"))
                  ->orWhere('codigo_verificacao', 'like', "%{$busca}%");
            });
        }

        if ($request->filled('data_inicio')) {
            $query->whereDate('data_agendamento', '>=', $request->data_inicio);
        }

        if ($request->filled('data_fim')) {
            $query->whereDate('data_agendamento', '<=', $request->data_fim);
        }

        $agendamentos = $query->paginate(20)->withQueryString();

        // Marca quais desses agendamentos já têm um estorno solicitado (qualquer status)
        $pagamentoIds = $agendamentos->getCollection()->pluck('pagamento_id')->filter()->values();
        $estornosPorPagamento = Estorno::whereIn('pagamento_id', $pagamentoIds)
            ->get(['pagamento_id', 'status'])
            ->keyBy('pagamento_id');

        $agendamentos->getCollection()->transform(function (Agendamento $agendamento) use ($estornosPorPagamento) {
            $agendamento->estorno_status = $agendamento->pagamento_id
                ? ($estornosPorPagamento->get($agendamento->pagamento_id)->status ?? null)
                : null;
            return $agendamento;
        });

        return Inertia::render('Admin/Agendamentos', [
            'agendamentos' => $agendamentos,
            'filtros' => $request->only(['status', 'busca', 'data_inicio', 'data_fim']),
        ]);
    }

    public function show($id)
    {
        if (Auth::user()->papel !== 'admin') abort(403);

        $agendamento = Agendamento::with([
            'usuario:id,name,email,telefone',
            'estabelecimento:id,nome,rua,numero,bairro,cidade,estado',
            'servico:id,nome,valor',
            'funcionario:id,nome',
            'finalizadoPor:id,name,email',
            'historico.alteradoPor:id,name',
        ])->findOrFail($id);

        $pagamento = $agendamento->pagamento_id
            ? Pagamento::find($agendamento->pagamento_id)
            : Pagamento::where('agendamento_id', $agendamento->id)->first();

        $estorno = $pagamento
            ? Estorno::where('pagamento_id', $pagamento->id)->latest()->first()
            : null;

        $statusAsaas = $pagamento
            ? $this->asaasWallet->consultarPagamento($pagamento->id_transacao_gateway)
            : null;

        return response()->json([
            'agendamento' => $agendamento,
            'pagamento' => $pagamento,
            'pagamento_asaas' => $statusAsaas,
            'estorno' => $estorno,
            'historico' => $agendamento->historico,
        ]);
    }
}
