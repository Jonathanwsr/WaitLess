<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Estorno;
use App\Models\Pagamento;
use App\Services\EstornoService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia; 

class EstornoController extends Controller
{
    protected $estornoService;

    public function __construct(EstornoService $estornoService)
    {
        $this->estornoService = $estornoService;
    }

    // =========================================================================
    // 🖥️ ROTA DE TELA (INERTIA/REACT)
    // =========================================================================
    
    /**
     * Carrega a página principal de estornos no Frontend de acordo com o papel do usuário
     */
    public function index(Request $request)
    {
        $user = Auth::user();
        $papel = strtolower($user->papel ?? 'cliente');

        if (in_array($papel, ['admin', 'superadmin'])) {
            return Inertia::render('Admin/Estornos');
        } elseif (in_array($papel, ['socio', 'proprietario'])) {
            return Inertia::render('Proprietario/Estornos');
        } else {
            return Inertia::render('Cliente/MeusEstornos');
        }
    }

    // =========================================================================
    // 👤 PARA CLIENTES E PROPRIETÁRIOS
    // =========================================================================

    /**
     * Lista todos os estornos vinculados ao usuário logado (Seja ele quem pediu, ou o dono do local)
     */
    public function minhasSolicitacoes(Request $request)
    {
        $user = Auth::user();
        
        $query = Estorno::with(['estabelecimento', 'servico', 'itemAluguel'])
            ->where(function ($q) use ($user) {
                $q->where('usuario_id', $user->id)     // Sou o cliente
                  ->orWhere('prestador_id', $user->id); // Sou o prestador
            });

        // Filtros (Ex: ?status=PENDENTE)
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $estornos = $query->orderBy('created_at', 'desc')->get();

        return response()->json(['status' => 'success', 'data' => $estornos]);
    }

    /**
     * Ver Detalhes do Estorno (Carrega as fotos, histórico de status e chat)
     */
    public function detalhes($id)
    {
        $user = Auth::user();
        
        $estorno = Estorno::with([
            'cliente:id,name,email', 
            'prestador:id,name,email', 
            'estabelecimento:id,nome',
            'pagamento', 'servico', 'itemAluguel', 
            'documentos', // Fotos e Pdfs
            'historicos', // Linha do tempo
            'mensagens.remetente' // Mensagens de contestação
        ])->findOrFail($id);

        // Bloqueia acesso se o usuário não for o cliente, dono ou um admin
        $isAdmin = in_array($user->papel, ['admin', 'superadmin']);
        if (!$isAdmin && $estorno->usuario_id !== $user->id && $estorno->prestador_id !== $user->id) {
            return response()->json(['error' => 'Acesso negado.'], 403);
        }

        // Se o prestador está abrindo pela primeira vez, atualiza a flag de visualização
        if ($estorno->prestador_id === $user->id && !$estorno->prestador_visualizou) {
            $estorno->update([
                'prestador_visualizou' => true,
                'data_visualizacao_prestador' => now()
            ]);
        }

        return response()->json(['status' => 'success', 'data' => $estorno]);
    }

    /**
     * Cliente SOLICITA o Estorno
     */
    public function solicitar(Request $request, $pagamento_id)
    {
        // 🚨 Validação limitando a 5 imagens de até 2MB (2048 KB)
        $request->validate([
            'motivo' => 'required|string',
            'descricao' => 'required|string|min:10',
            'categoria' => 'required|in:SERVICO,ALUGUEL',
            'subcategoria' => 'nullable|string',
            'imagens' => 'nullable|array|max:5',
            'imagens.*' => 'image|mimes:jpeg,png,jpg|max:2048', // Modificado para 2MB
        ]);

        $cliente = Auth::user();
        $pagamento = Pagamento::findOrFail($pagamento_id);

        if ($pagamento->user_id !== $cliente->id) {
            return response()->json(['error' => 'Este pagamento não pertence a você.'], 403);
        }

        try {
            // Pega as imagens enviadas e despacha para o Service (Hive AI + Cloudflare R2)
            $imagens = $request->file('imagens') ?? [];
            $estorno = $this->estornoService->solicitarEstorno($cliente, $pagamento, $request->all(), $imagens);

            return response()->json([
                'status' => 'success',
                'message' => 'Solicitação de estorno enviada com sucesso.',
                'data' => $estorno
            ], 201);
        } catch (\Exception $e) {
            // Se a HiveAI barrar a foto no Service, o erro cai aqui e retorna um 422 barrando a ação.
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    /**
     * Proprietário/Sócio CONTESTA o Estorno
     */
    public function contestar(Request $request, $estorno_id)
    {
        // 🚨 Validação idêntica à do cliente: Até 5 imagens, máx 2MB (2048 KB)
        $request->validate([
            'descricao' => 'required|string|min:10',
            'imagens' => 'nullable|array|max:5',
            'imagens.*' => 'image|mimes:jpeg,png,jpg|max:2048', // Modificado para 2MB
        ]);

        $prestador = Auth::user();
        $estorno = Estorno::findOrFail($estorno_id);

        try {
            // Pega as imagens da requisição 
            $imagens = $request->file('imagens') ?? [];
            
            // O EstornoService fará o upload via S3 (Cloudflare R2) e a checagem booleana (True/False) na Hive AI
            $this->estornoService->contestarEstorno($prestador, $estorno, $request->all(), $imagens);

            return response()->json([
                'status' => 'success',
                'message' => 'Sua contestação foi enviada e está em análise pela equipe.'
            ], 200);
        } catch (\Exception $e) {
            // Caso tenha conteúdo adulto/indevido, a Hive AI joga exceção no Service e trava a contestação aqui.
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }


    // =========================================================================
    // 👑 PARA ADMINISTRADORES DA PLATAFORMA
    // =========================================================================

    /**
     * Lista Geral de Estornos para o Admin com múltiplos filtros
     */
    public function adminIndex(Request $request)
    {
        if (!in_array(Auth::user()->papel, ['admin', 'superadmin'])) {
            return response()->json(['error' => 'Acesso restrito.'], 403);
        }

        $query = Estorno::with(['cliente:id,name', 'prestador:id,name', 'estabelecimento:id,nome']);

        if ($request->has('status')) $query->where('status', $request->status);
        if ($request->has('categoria')) $query->where('categoria', $request->categoria);
        
        if ($request->has('data_inicial')) {
            $query->whereDate('data_solicitacao', '>=', $request->data_inicial);
        }
        if ($request->has('data_final')) {
            $query->whereDate('data_solicitacao', '<=', $request->data_final);
        }
        if ($request->has('mes') && $request->has('ano')) {
            $query->whereMonth('data_solicitacao', $request->mes)
                  ->whereYear('data_solicitacao', $request->ano);
        }

        $estornos = $query->orderBy('created_at', 'desc')->paginate(20);

        return response()->json(['status' => 'success', 'data' => $estornos]);
    }

    /**
     * Admin APROVA e estorna pro cliente
     */
    public function adminAprovar(Request $request, $id)
    {
        $admin = Auth::user();
        $estorno = Estorno::findOrFail($id);

        try {
            $this->estornoService->aprovarEstorno($estorno, $admin);
            return response()->json(['status' => 'success', 'message' => 'Estorno aprovado e concluído com sucesso.']);
        } catch (\Exception $e) {
            Log::error('Erro Admin Aprovar Estorno: ' . $e->getMessage());
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Admin REPROVA e devolve o dinheiro pra Wallet do prestador
     */
    public function adminReprovar(Request $request, $id)
    {
        $request->validate(['motivo_reprovacao' => 'required|string']);

        $admin = Auth::user();
        $estorno = Estorno::findOrFail($id);

        try {
            $this->estornoService->reprovarEstorno($estorno, $admin, $request->motivo_reprovacao);
            return response()->json(['status' => 'success', 'message' => 'Estorno indeferido/reprovado. O valor retornou ao prestador.']);
        } catch (\Exception $e) {
            Log::error('Erro Admin Reprovar Estorno: ' . $e->getMessage());
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }
}