<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Triagem;
use App\Services\TriagemService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Triagem (ficha antes da reserva/atendimento).
 * A ficha é criada no momento da reserva (ver ClienteAgendamentoMobileController); aqui ficam a
 * consulta e a decisão. Dados de saúde/uso pessoal: só o cliente e quem analisa (dono, equipe, admin) enxergam.
 */
class TriagemController extends Controller
{
    public function __construct(private TriagemService $triagens) {}

    /** Perguntas oficiais para o app montar o formulário: ?tipo=reserva|servico */
    public function perguntas(Request $request): JsonResponse
    {
        $tipo = $request->query('tipo') === 'servico' ? 'servico' : 'reserva';

        return response()->json(['tipo' => $tipo, 'perguntas' => $this->triagens->perguntas($tipo)]);
    }

    /**
     * ?visao=analisar → fichas que eu analiso (dono/equipe); padrão → as minhas como cliente.
     * Filtros: status (pendente|aprovado|recusado), tipo (reserva|servico).
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = $request->query('visao') === 'analisar'
            ? $this->triagens->queryParaAnalisar($user)
            : Triagem::where('usuario_id', $user->id);

        $lista = $query
            ->when($request->query('status'), fn ($q, $v) => $q->where('status', $v))
            ->when($request->query('tipo'), fn ($q, $v) => $q->where('tipo', $v))
            ->with(['respostas', 'usuario:id,name,foto_perfil', 'aluguel.item:id,nome', 'agendamento.servico:id,nome'])
            ->latest('id')->limit(100)->get();

        return response()->json([
            'pendentes' => $lista->where('status', 'pendente')->count(),
            'data' => $lista->map(fn (Triagem $t) => $this->triagens->paraTela($t, $request->query('visao') === 'analisar'))->values(),
        ]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $t = Triagem::findOrFail($id);
        abort_unless($this->triagens->podeVer($request->user(), $t), 403, 'Você não tem acesso a essa ficha.');

        return response()->json($this->triagens->paraTela($t));
    }

    /** O responsável aprova ou recusa. */
    public function update(Request $request, int $id): JsonResponse
    {
        $t = Triagem::findOrFail($id);
        abort_unless($this->triagens->podeAnalisar($request->user(), $t), 403, 'Só quem recebe essa reserva pode analisar a ficha.');

        $dados = $request->validate([
            'status' => 'required|in:aprovado,recusado',
            'motivo' => 'nullable|string|max:500',
        ], ['status.in' => 'Escolha aprovar ou recusar.']);

        $t = $this->triagens->decidir($t, $request->user(), $dados['status'], $dados['motivo'] ?? null);

        return response()->json([
            'message' => $dados['status'] === 'aprovado' ? 'Ficha aprovada.' : 'Ficha recusada e reserva cancelada.',
            'data' => $this->triagens->paraTela($t),
        ]);
    }
}
