<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Estorno;
use App\Models\Pagamento;
use App\Models\Agendamento;
use App\Services\EstornoService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Carbon\Carbon;
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
    
    public function index(Request $request)
    {
        $user = Auth::user();
        $papel = strtolower($user->papel ?? 'cliente');

        if (in_array($papel, ['admin', 'superadmin'])) {
            return Inertia::render('Admin/Estornos');
        } elseif (in_array($papel, ['socio', 'proprietario', 'estabelecimento'])) {
            return Inertia::render('Estabelecimentos/Estornos');
        } else {
            return Inertia::render('Cliente/MeusEstornos');
        }
    }


    // 🐛 FUNÇÃO QUE ESTAVA FALTANDO!
    public function adminAprovar($id)
    {
        $admin = Auth::user();
        $estorno = Estorno::findOrFail($id);

        try {
            $this->estornoService->aprovarEstorno($estorno, $admin);

            return response()->json([
                'status' => 'success', 
                'message' => 'Estorno aprovado e processado no Asaas com sucesso!'
            ]);
        } catch (\Exception $e) {
            Log::error('Erro Admin Aprovar Estorno: ' . $e->getMessage());
            return response()->json(['error' => $e->getMessage()], 400);
        }
    }

    // =========================================================================
    // 👤 PARA CLIENTES E PROPRIETÁRIOS
    // =========================================================================

    public function minhasSolicitacoes(Request $request)
    {
        $user = Auth::user();
        
        $query = Estorno::with(['estabelecimento', 'servico', 'itemAluguel', 'cliente', 'prestador'])
            ->where(function ($q) use ($user) {
                $q->where('usuario_id', $user->id) 
                  ->orWhere('prestador_id', $user->id);
            });

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $estornos = $query->orderBy('created_at', 'desc')->get();
        return response()->json(['status' => 'success', 'data' => $estornos]);
    }

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
                    $query->where('id', $pagamento_id)
                          ->orWhere('agendamento_id', $pagamento_id);
                })
                ->whereIn('status', ['pago', 'PAGO', 'concluido', 'CONCLUIDO']) 
                ->orderBy('id', 'desc') 
                ->first();

            if (!$pagamento) {
                return response()->json(['error' => 'Nenhum pagamento concluído foi encontrado para este serviço.'], 404);
            }

            $pagamento->status = strtoupper($pagamento->status);

            if ($pagamento->usuario_id !== $cliente->id) {
                return response()->json(['error' => 'Este pagamento não pertence a você.'], 403);
            }

            if ($pagamento->agendamento_id) {
                $agendamento = Agendamento::find($pagamento->agendamento_id);
                
                if ($agendamento) {
                    if (!$agendamento->foi_realizado) {
                        return response()->json(['error' => 'Você só pode solicitar estorno de um serviço que já foi finalizado.'], 403);
                    }

                    $dataConclusao = null;
                    if ($agendamento->data_agendamento && $agendamento->hora_finalizacao) {
                        $dataConclusao = \Carbon\Carbon::parse($agendamento->data_agendamento . ' ' . $agendamento->hora_finalizacao);
                    } else {
                        $dataConclusao = \Carbon\Carbon::parse($agendamento->updated_at);
                    }
                    
                    if (now()->greaterThan($dataConclusao->copy()->addDays(4))) {
                        return response()->json(['error' => 'O prazo de 4 dias após a conclusão do serviço para solicitar estorno expirou.'], 403);
                    }
                }
            }

            $imagens = $request->file('imagens') ?? [];
            
            $estorno = $this->estornoService->solicitarEstorno($cliente, $pagamento, $request->all(), $imagens);

            $estorno->update([
                'prazo_resposta' => now()->addDays(2),
                'data_solicitacao' => now(),
                'status' => 'PENDENTE'
            ]);

            return response()->json([
                'status' => 'success',
                'message' => 'Solicitação de estorno enviada com sucesso.',
                'data' => $estorno
            ], 201);

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['error' => collect($e->errors())->flatten()->first()], 422);

        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Erro ao solicitar estorno: ' . $e->getMessage() . ' | Linha: ' . $e->getLine());
            return response()->json(['error' => $e->getMessage()], 400); 
        }
    }

    public function contestar(Request $request, $estorno_id)
    {
        $request->validate([
            'descricao' => 'required|string|min:10',
            'imagens' => 'nullable|array|max:5',
            'imagens.*' => 'image|mimes:jpeg,png,jpg|max:2048', 
        ]);

        $prestador = Auth::user();
        $estorno = Estorno::findOrFail($estorno_id);

        try {
            $imagens = $request->file('imagens') ?? [];
            $this->estornoService->contestarEstorno($prestador, $estorno, $request->all(), $imagens);

            return response()->json([
                'status' => 'success',
                'message' => 'Sua contestação foi enviada com sucesso e está em análise pela administração.'
            ], 200);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Erro ao contestar: ' . $e->getMessage());
            return response()->json(['error' => $e->getMessage()], 400);
        }
    }

    // =========================================================================
    // 👑 PARA ADMINISTRADORES DA PLATAFORMA
    // =========================================================================

    public function adminIndex(Request $request)
    {
        if (!in_array(strtolower(Auth::user()->papel), ['admin', 'superadmin', 'administrador'])) {
            return response()->json(['error' => 'Acesso restrito.'], 403);
        }

        $query = Estorno::with(['cliente:id,name', 'prestador:id,name', 'estabelecimento:id,nome']);

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }
        
        $estornos = $query->orderBy('created_at', 'desc')->paginate(20);
        return response()->json(['status' => 'success', 'data' => $estornos]);
    }

    public function detalhes($id)
    {
        $user = Auth::user();
        
        $estorno = Estorno::with([
            'cliente:id,name,email', 
            'prestador:id,name,email', 
            'estabelecimento:id,nome',
            'pagamento', 'servico', 'itemAluguel', 
            'documentos', 
            'historicos', 
            'mensagens' 
        ])->findOrFail($id);

        $isAdmin = in_array(strtolower($user->papel), ['admin', 'superadmin', 'administrador']);
        
        if (!$isAdmin && $estorno->usuario_id !== $user->id && $estorno->prestador_id !== $user->id) {
            return response()->json(['error' => 'Acesso negado.'], 403);
        }

        if ($estorno->prestador_id === $user->id && !$estorno->prestador_visualizou) {
            $estorno->update([
                'prestador_visualizou' => true,
                'data_visualizacao_prestador' => now()
            ]);
        }

        return response()->json(['status' => 'success', 'data' => $estorno]);
    } 

    /**
     * 3. ADMIN APROVA O ESTORNO
     */
    public function aprovarEstorno(Estorno $estorno, User $adminOuSistema)
    {
        if (in_array($estorno->status, ['ESTORNADO', 'CANCELADO', 'REPROVADO'])) {
            throw new Exception("Este estorno já foi finalizado ou cancelado.");
        }

        DB::transaction(function () use ($estorno, $adminOuSistema) {
            $idTransacao = $estorno->id_transacao_asaas;
            if (!$idTransacao && $estorno->pagamento) {
                $idTransacao = $estorno->pagamento->id_transacao_gateway;
            }

            if ($idTransacao) {
                // 🐛 CORREÇÃO DEFINITIVA: Pega a chave EXCLUSIVA da subconta
                $provider = DB::table('providers')->where('user_id', $estorno->prestador_id)->first();
                $asaasKey = $provider->asaas_api_key ?? env('ASAAS_API_KEY');

                // Mantém a inteligência: Se a chave tiver 'hmlg', é Sandbox! Senão, é Produção.
                if (strpos($asaasKey, '$aact_hmlg_') !== false) {
                    $asaasUrl = 'https://sandbox.asaas.com/api/v3';
                } else {
                    $asaasUrl = rtrim(env('ASAAS_API_URL', 'https://api.asaas.com/v3'), '/');
                }

                $asaasResponse = Http::withHeaders([
                    'access_token' => $asaasKey,
                    'Content-Type' => 'application/json',
                ])->post("{$asaasUrl}/payments/{$idTransacao}/refund", [
                    'value' => (float) $estorno->valor_estornado,
                    'description' => 'Estorno aprovado via Plataforma WaitLess'
                ]);

                if ($asaasResponse->failed()) {
                    $estorno->update(['status' => 'ERRO_ASAAS']);
                    $erroAsaas = $asaasResponse->json();
                    
                    $mensagemErro = $erroAsaas['errors'][0]['description'] ?? 'Erro desconhecido ao tentar estornar no Asaas.';
                    
                    Log::error("Erro Asaas Estorno [Transacao: {$idTransacao}]: " . json_encode($erroAsaas));
                    throw new Exception("Asaas recusou o estorno: " . $mensagemErro);
                }

                $respostaData = $asaasResponse->json();
                $estorno->id_estorno_asaas = $respostaData['id'] ?? null;
            }
            
            // Atualiza financeiro do Provider (move de analise para estornado)
            if (isset($provider)) {
                DB::table('providers')->where('user_id', $estorno->prestador_id)->update([
                    'valor_em_analise' => DB::raw("valor_em_analise - {$estorno->valor_pago}"),
                    'valor_estornado' => DB::raw("valor_estornado + {$estorno->valor_pago}")
                ]);
            }
            
            // Regras internas de status
            if (method_exists($estorno, 'processarEstornoConcluido')) {
                $estorno->processarEstornoConcluido();
            } else {
                if ($estorno->pagamento) {
                    $estorno->pagamento->update(['status' => 'estornado']);
                }
            }

            if ($estorno->pagamento && $estorno->pagamento->agendamento_id) {
                $agendamento = Agendamento::where('id', $estorno->pagamento->agendamento_id)->first();
                if ($agendamento) {
                    $agendamento->update(['status' => 'estornado']);
                }
            }

            $estorno->update([
                'status' => 'ESTORNADO',
                'data_aprovacao' => now(),
                'data_estorno' => now()
            ]);

            HistoricoEstorno::create([
                'estorno_id' => $estorno->id,
                'usuario_id' => $adminOuSistema->id,
                'status_anterior' => $estorno->status,
                'novo_status' => 'ESTORNADO',
                'descricao' => 'Estorno aprovado e efetuado diretamente na API do Asaas com sucesso.',
                'ip' => request()->ip()
            ]);

            NotificacaoEstorno::create([
                'estorno_id' => $estorno->id,
                'usuario_id' => $estorno->usuario_id,
                'titulo' => 'Estorno Aprovado',
                'mensagem' => 'Seu estorno foi aprovado e o valor foi estornado para sua conta/cartão original.'
            ]);

            if (class_exists(\App\Services\NotificacaoService::class) && $estorno->prestador) {
                $notificacaoService = new \App\Services\NotificacaoService();
                $notificacaoService->notificarEventoEstorno($estorno->cliente, $estorno->prestador, 'APROVADO', $estorno->id);
            }
        });
    }
    // =========================================================================
    // 🔄 ASAAS WEBHOOK E ELEGIBILIDADE
    // =========================================================================

    public function asaasWebhook(Request $request)
    {
        $evento = $request->input('event');
        $pagamentoAsaas = $request->input('payment');

        if ($evento === 'PAYMENT_REFUNDED' && isset($pagamentoAsaas['id'])) {
            $pagamento = Pagamento::where('asaas_payment_id', $pagamentoAsaas['id'])->first();

            if ($pagamento) {
                if ($pagamento->status !== 'ESTORNADO') {
                    $pagamento->update(['status' => 'ESTORNADO']);
                }

                $estorno = Estorno::where('pagamento_id', $pagamento->id)->first();
                
                if ($estorno && $estorno->status !== 'APROVADO') {
                    $estorno->update([
                        'status' => 'APROVADO',
                        'data_aprovacao' => now(),
                        'data_estorno' => now(),
                        'descricao_admin' => 'Aprovado automaticamente.'
                    ]);
                }
            }
        }

        return response()->json(['status' => 'success'], 200);
    }

    public function elegiveisEstorno(Request $request)
    {
        try {
            $userId = auth()->id();

            $agendamentos = Agendamento::with(['servico', 'estabelecimento'])
                ->where('usuario_id', $userId)
                ->where('foi_realizado', true)
                ->whereIn('id', function ($query) {
                    $query->select('agendamento_id')
                          ->from('pagamentos')
                          ->whereIn('status', ['pago', 'PAGO', 'concluido', 'CONCLUIDO'])
                          ->whereIn('metodo_pagamento', ['pix', 'PIX', 'cartao', 'CARTAO', 'boleto', 'BOLETO', 'CREDIT_CARD', 'pago_online'])
                          ->whereNotIn('id', function ($sub) {
                              $sub->select('pagamento_id')
                                  ->from('estornos')
                                  // 🐛 AJUSTE: Adicionados os status que bloqueiam a exibição na tela de solicitação
                                  ->whereIn('status', ['PENDENTE', 'AGUARDANDO_DOCUMENTOS', 'EM_ANALISE', 'APROVADO', 'ESTORNADO', 'CONTESTADO']);
                          });
                })
                ->latest('data_agendamento')
                ->get();

            $pagamentosLocais = DB::table('pagamentos')
                ->whereIn('agendamento_id', $agendamentos->pluck('id'))
                ->get()
                ->keyBy('agendamento_id');

            $resultado = $agendamentos->map(function ($agendamento) use ($pagamentosLocais) {
                
                $dataBase = null;
                if ($agendamento->data_agendamento && $agendamento->hora_finalizacao) {
                    $dataBase = \Carbon\Carbon::parse($agendamento->data_agendamento . ' ' . $agendamento->hora_finalizacao);
                } else {
                    $dataBase = \Carbon\Carbon::parse($agendamento->updated_at);
                }
                
                $dataLimite = $dataBase->copy()->addDays(4);
                
                $agendamento->data_limite_estorno = $dataLimite->format('Y-m-d H:i:s');
                $agendamento->data_limite_formatada = $dataLimite->format('d/m/Y \à\s H:i');
                $agendamento->pode_solicitar = now()->lessThanOrEqualTo($dataLimite);
                
                $pagamentoLocal = $pagamentosLocais->get($agendamento->id);
                
                if ($pagamentoLocal) {
                    $agendamento->id_pagamento_real = $pagamentoLocal->id;
                    $agendamento->valor_total = $pagamentoLocal->valor; 
                    $agendamento->taxa = $pagamentoLocal->taxa;
                    $agendamento->valor_liquido = $pagamentoLocal->valor_liquido;
                    $agendamento->metodo_pagamento = $pagamentoLocal->metodo_pagamento;
                    $agendamento->data_pagamento = $pagamentoLocal->data_pagamento;
                    
                    $agendamento->gateway_pagamento = $pagamentoLocal->gateway_pagamento ?? null;
                    $agendamento->id_transacao_gateway = $pagamentoLocal->id_transacao_gateway ?? null;
                    $agendamento->status_estorno = $pagamentoLocal->status_estorno ?? null;
                    $agendamento->valor_estornado = $pagamentoLocal->valor_estornado ?? null;
                    $agendamento->data_estorno = $pagamentoLocal->data_estorno ?? null;
                    $agendamento->codigo_estorno = $pagamentoLocal->codigo_estorno ?? null;
                    $agendamento->id_estorno_asaas = $pagamentoLocal->id_estorno_asaas ?? null;
                } else {
                    $agendamento->id_pagamento_real = null;
                }
                
                return $agendamento;

            })->filter(function ($agendamento) {
                return $agendamento->pode_solicitar && $agendamento->id_pagamento_real !== null;
            })->values();

            return response()->json($resultado, 200);

        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Erro em elegiveisEstorno: ' . $e->getMessage());
            return response()->json(['error' => 'Falha ao carregar itens elegíveis.', 'details' => $e->getMessage()], 500);
        }
    }


    public function gerarComprovante($id)
    {
        $estorno = Estorno::with(['cliente', 'prestador', 'estabelecimento', 'pagamento'])->findOrFail($id);

        $user = \Illuminate\Support\Facades\Auth::user();
        $isAdmin = in_array(strtolower($user->papel), ['admin', 'superadmin', 'administrador']);
        
        // Proteção: Só o dono do estabelecimento, o cliente ou o admin podem ver o comprovante
        if (!$isAdmin && $estorno->usuario_id !== $user->id && $estorno->prestador_id !== $user->id) {
            abort(403, 'Acesso negado.');
        }

        if ($estorno->status !== 'ESTORNADO') {
            abort(404, 'O comprovante só fica disponível após o estorno ser concluído.');
        }

        return view('pdfs.estorno', compact('estorno'));
    }
}