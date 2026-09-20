<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Assinatura;
use App\Models\ItemAluguel;
use App\Models\Servico;
use App\Models\User;
use App\Services\AsaasAssinaturaService;
use App\Services\AsaasWalletService;
use App\Services\PlanoService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Carbon\Carbon;

class AssinaturaController extends Controller
{
    protected $asaasService;
    protected $planoService;
    protected $asaasWallet;

    public function __construct(AsaasAssinaturaService $asaasService, PlanoService $planoService, AsaasWalletService $asaasWallet)
    {
        $this->asaasService = $asaasService;
        $this->planoService = $planoService;
        $this->asaasWallet = $asaasWallet;
    }

    /**
     * 💎 VITRINE PREMIUM
     *
     * Dá mais visibilidade a quem paga um plano premium/sócio: retorna uma
     * mistura de serviços e itens de aluguel pertencentes a estabelecimentos
     * cujo proprietário está com uma assinatura premium ativa. Usado na
     * landing page (Welcome) para alimentar o carrossel de destaques.
     */
    public function vitrinePremium(int $limite = 12)
    {
        return response()->json($this->montarVitrinePremium($limite));
    }

    /**
     * Monta a coleção de destaques premium (reaproveitado pela rota da API
     * e diretamente pelo WelcomeController para a landing page).
     */
    public function montarVitrinePremium(int $limite = 12)
    {
        $planosPremiumEstabelecimento = ['premium', 'premium-socio', 'premium-anual', 'premium-socio-anual'];

        $idsUsuariosPremium = User::whereIn('plano_assinatura', $planosPremiumEstabelecimento)->pluck('id');

        if ($idsUsuariosPremium->isEmpty()) {
            return collect();
        }

        $servicos = Servico::query()
            ->where('ativo', true)
            ->whereHas('estabelecimento', function ($query) use ($idsUsuariosPremium) {
                $query->where('ativo', true)
                    ->whereHas('proprietarios', fn ($q) => $q->whereIn('users.id', $idsUsuariosPremium));
            })
            ->with('estabelecimento:id,nome,rua,numero,bairro,cidade,estado')
            ->inRandomOrder()
            ->take($limite)
            ->get(['id', 'estabelecimento_id', 'nome', 'descricao', 'valor', 'duracao_minutos', 'fotos'])
            ->map(fn (Servico $servico) => [
                'id' => $servico->id,
                'tipo' => 'servico',
                'nome' => $servico->nome,
                'descricao' => $servico->descricao,
                'valor' => (float) $servico->valor,
                'duracao_minutos' => $servico->duracao_minutos,
                'foto' => $this->extrairPrimeiraFoto($servico->fotos),
                'estabelecimento' => $servico->estabelecimento?->nome,
                'endereco' => $servico->estabelecimento?->endereco_completo,
                'premium' => true,
            ]);

        $itensAluguel = ItemAluguel::query()
            ->where('ativo', true)
            ->where('disponivel', true)
            ->whereIn('estabelecimento_id', $idsUsuariosPremium)
            ->inRandomOrder()
            ->take($limite)
            ->get(['id', 'estabelecimento_id', 'nome', 'descricao', 'categoria', 'valor', 'valor_diaria', 'valor_semanal', 'valor_mensal', 'endereco', 'numero', 'bairro', 'cidade', 'estado'])
            ->map(fn (ItemAluguel $item) => [
                'id' => $item->id,
                'tipo' => 'aluguel',
                'nome' => $item->nome,
                'descricao' => $item->descricao,
                'categoria' => $item->categoria,
                'valor' => (float) ($item->valor ?? $item->valor_diaria ?? $item->valor_semanal ?? $item->valor_mensal ?? 0),
                'periodo' => $item->valor
                    ? null
                    : ($item->valor_diaria ? 'dia' : ($item->valor_semanal ? 'semana' : ($item->valor_mensal ? 'mês' : null))),
                'endereco' => $item->endereco_completo,
                'premium' => true,
            ]);

        return $servicos->concat($itensAluguel)->shuffle()->take($limite)->values();
    }

    private function extrairPrimeiraFoto(?string $fotosJson): ?string
    {
        if (! $fotosJson) {
            return null;
        }

        $fotos = json_decode($fotosJson, true);

        return $fotos[0] ?? null;
    }

    /**
     * 🟢 ASSINAR PLANO (Mensal ou Anual via Pix/Cartão com 7 dias grátis)
     */
    public function assinar(Request $request)
    {
        $user = Auth::user();

        if (!in_array($user->papel, ['user', 'socio'])) {
            return response()->json(['error' => 'Apenas clientes e sócios podem realizar assinaturas.'], 403);
        }

        $assinaturaExistente = Assinatura::where('user_id', $user->id)
                                         ->whereIn('status', ['ativa', 'pendente'])
                                         ->first();
                                         
        if ($assinaturaExistente) {
            return response()->json([
                'error' => "Acesso negado: Você já possui o plano '{$assinaturaExistente->nome_plano}' em andamento. Caso queira, utilize a opção de Mudar de Plano."
            ], 400);
        }

        $request->validate([
            'plano'  => 'required|string|in:' . implode(',', $this->planoService->planosPermitidos($user->papel)),
            'metodo' => 'required|string|in:pix,credit_card'
        ]);

        $planoEscolhido = $request->plano;

        ['valor' => $valorPlano, 'tipo_publico' => $tipoPublico, 'ciclo' => $ciclo] =
            $this->planoService->resolverDetalhesPlano($user->papel, $planoEscolhido);

        $dataPrimeiraCobranca = now()->addDays(7);

        $detalhesPlano = [
            'nome'          => $planoEscolhido,
            'valor'         => $valorPlano,
            'ciclo'         => $ciclo,
            'data_cobranca' => $dataPrimeiraCobranca 
        ];

        DB::beginTransaction();
        try {
            $assinatura = Assinatura::create([
                'user_id'         => $user->id,
                'nome_plano'      => $planoEscolhido,
                'tipo_publico'    => $tipoPublico,
                'valor_mensal'    => $valorPlano, 
                'data_vencimento' => $dataPrimeiraCobranca, 
                'data_inicio'     => now(), 
                'status'          => 'pendente' 
            ]);

            $gatewayData = $this->asaasService->criarCobranca($assinatura, $user, $detalhesPlano, $request->metodo);

            $assinatura->update([
                'gateway_assinatura_id' => $gatewayData['id']
            ]);

            $user->update([
                'asaas_subscription_id'     => $gatewayData['id'],
                'asaas_subscription_status' => 'PENDING',
                'plano_assinatura'          => $planoEscolhido
            ]);

            DB::commit();

            try {
                $nomePlanoFormatado = strtoupper($planoEscolhido);
                $mensagemEmail = "Olá, {$user->name}!\n\nSua assinatura do Plano {$nomePlanoFormatado} foi iniciada com sucesso na Lokyva.\n\nVocê ganhou 7 dias de teste totalmente gratuitos! Sua primeira cobrança de R$ " . number_format($valorPlano, 2, ',', '.') . " ocorrerá apenas no dia " . $dataPrimeiraCobranca->format('d/m/Y') . ".\n\nAproveite todos os seus benefícios!\nEquipe Lokyva.";
                
                Mail::raw($mensagemEmail, function ($mail) use ($user, $nomePlanoFormatado) {
                    $mail->to($user->email)->subject("Bem-vindo ao Plano {$nomePlanoFormatado} - 7 Dias Grátis!");
                });
            } catch (\Exception $e) {
                Log::error("Erro ao enviar email Brevo de assinatura: " . $e->getMessage());
            }

            return response()->json([
                'message'      => 'Assinatura gerada com sucesso! Você tem 7 dias grátis.',
                'gateway_link' => $gatewayData['invoiceUrl'] ?? null, 
                'assinatura'   => $assinatura
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => 'Falha ao processar assinatura: ' . $e->getMessage()], 422);
        }
    }

    /**
     * 🔄 MUDAR DE PLANO (Mantém ativo o ciclo atual e agenda a troca)
     */
    public function mudarPlano(Request $request)
    {
        $user = Auth::user();
        $assinaturaAtual = $user->assinaturas()->whereIn('status', ['ativa', 'pendente'])->first();

        if (!$assinaturaAtual) {
            return response()->json(['error' => 'Nenhuma assinatura ativa encontrada para realizar a mudança.'], 404);
        }

        // 👉 REGRA DE JANELA (Após 5 dias de pago, 1 dia antes de vencer)
        if ($assinaturaAtual->status === 'ativa' && $assinaturaAtual->data_inicio && $assinaturaAtual->data_vencimento) {
            $dataInicio = Carbon::parse($assinaturaAtual->data_inicio);
            $dataVencimento = Carbon::parse($assinaturaAtual->data_vencimento);

            if (now()->diffInDays($dataInicio) < 5) {
                return response()->json(['error' => 'Você só pode mudar de plano após 5 dias da confirmação do último pagamento.'], 403);
            }

            // 'false' no diffInDays permite retornar valores negativos se já tiver passado
            if (now()->diffInDays($dataVencimento, false) < 1) {
                return response()->json(['error' => 'A mudança deve ser solicitada com pelo menos 1 dia de antecedência do próximo vencimento.'], 403);
            }
        }

        $request->validate([
            'novo_plano' => 'required|string|in:' . implode(',', $this->planoService->planosPermitidos($user->papel)),
            'metodo'     => 'required|string|in:pix,credit_card'
        ]);

        $novoPlano = $request->novo_plano;

        if ($assinaturaAtual->nome_plano === $novoPlano) {
            return response()->json(['error' => 'Você já está utilizando este plano.'], 400);
        }

        // 👉 TRAVA MENSAL PARA ANUAL
        $isNovoAnual = str_contains($novoPlano, 'anual');
        $isAtualAnual = str_contains($assinaturaAtual->nome_plano, 'anual');

        if ($isNovoAnual && !$isAtualAnual) {
            return response()->json(['error' => 'Não é possível migrar do plano Mensal para o plano Anual diretamente durante a vigência. Cancele e aguarde o fim do ciclo normal.'], 403);
        }

        ['valor' => $valorPlano, 'tipo_publico' => $tipoPublico, 'ciclo' => $ciclo] =
            $this->planoService->resolverDetalhesPlano($user->papel, $novoPlano);

        // A nova cobrança só acontecerá no vencimento do plano atual
        $proximaCobranca = $assinaturaAtual->data_vencimento ? Carbon::parse($assinaturaAtual->data_vencimento) : now();

        $detalhesPlano = [
            'nome'          => $novoPlano,
            'valor'         => $valorPlano,
            'ciclo'         => $ciclo,
            'data_cobranca' => $proximaCobranca 
        ];

        DB::beginTransaction();
        try {
            // 1. Cancela a cobrança atual no Asaas
            if ($assinaturaAtual->gateway_assinatura_id) {
                $this->asaasService->cancelarNoGateway($assinaturaAtual->gateway_assinatura_id);
            }

            // 2. Cancela no banco (O benefício do usuário continuará até plano_expira_em)
            $assinaturaAtual->update([
                'status' => 'cancelada', 
                'cancelada_em' => now()
            ]);

            // 3. Cria a Nova Assinatura Agendada
            $novaAssinatura = Assinatura::create([
                'user_id'         => $user->id,
                'nome_plano'      => $novoPlano,
                'tipo_publico'    => $tipoPublico,
                'valor_mensal'    => $valorPlano, 
                'data_vencimento' => $proximaCobranca, 
                'data_inicio'     => null, 
                'status'          => 'pendente' 
            ]);

            // 4. Manda para o Asaas (Programado para iniciar só em $proximaCobranca)
            $gatewayData = $this->asaasService->criarCobranca($novaAssinatura, $user, $detalhesPlano, $request->metodo);

            $novaAssinatura->update([
                'gateway_assinatura_id' => $gatewayData['id']
            ]);

            // 5. Atualiza o ID do asaas no usuário, mantendo os benefícios do plano atual intactos
            $user->update([
                'asaas_subscription_id'     => $gatewayData['id'],
                'asaas_subscription_status' => 'PENDING',
                // Não mudamos 'plano_assinatura' aqui. Ele será atualizado via Webhook no dia que a nova fatura for paga.
            ]);

            DB::commit();

            return response()->json([
                'message'      => "Mudança agendada com sucesso! Seu novo plano começará automaticamente no dia {$proximaCobranca->format('d/m/Y')}.",
                'gateway_link' => $gatewayData['invoiceUrl'] ?? null, 
                'assinatura'   => $novaAssinatura
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => 'Falha ao agendar mudança de plano: ' . $e->getMessage()], 422);
        }
    }

    /**
     * 🔴 CANCELAMENTO PELO CLIENTE (Janela de tempo bloqueada)
     */
    public function cancelar()
    {
        $user = Auth::user();
        $assinatura = $user->assinaturas()->whereIn('status', ['ativa', 'pendente'])->first();

        if (!$assinatura) {
            return response()->json(['error' => 'Nenhuma assinatura ativa encontrada.'], 404);
        }

        // 👉 REGRA DE JANELA (Após 5 dias de pago, 1 dia antes de vencer)
        if ($assinatura->status === 'ativa' && $assinatura->data_inicio && $assinatura->data_vencimento) {
            $dataInicio = Carbon::parse($assinatura->data_inicio);
            $dataVencimento = Carbon::parse($assinatura->data_vencimento);

            if (now()->diffInDays($dataInicio) < 5) {
                return response()->json(['error' => 'O cancelamento só é permitido após 5 dias da confirmação do último pagamento.'], 403);
            }

            if (now()->diffInDays($dataVencimento, false) < 1) {
                return response()->json(['error' => 'O cancelamento deve ser feito com pelo menos 1 dia de antecedência do próximo vencimento.'], 403);
            }
        }

        try {
            if ($assinatura->gateway_assinatura_id) {
                $this->asaasService->cancelarNoGateway($assinatura->gateway_assinatura_id);
            }
            
            $assinatura->update([
                'status'       => 'cancelada', 
                'cancelada_em' => now()
            ]);

            $user->update([
                'asaas_subscription_status' => 'CANCELLED'
            ]);

            return response()->json([
                'message' => 'Plano cancelado com sucesso. O acesso será mantido até o fim do ciclo pago atual.'
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Falha de comunicação com o provedor de pagamentos.'], 500);
        }
    }

    /**
     * 🛡️ PAINEL ADMIN: Lista todas as assinaturas da plataforma (clientes e sócios).
     */
    public function adminIndex()
    {
        if (Auth::user()->papel !== 'admin') abort(403);

        $assinaturas = Assinatura::with('user:id,name,email')
            ->orderByDesc('created_at')
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('Admin/Assinaturas', [
            'assinaturas' => $assinaturas,
        ]);
    }

    /**
     * 🛡️ PAINEL ADMIN: Consulta em tempo real o status real da assinatura
     * recorrente direto na Asaas (sob demanda, por isso não entra na listagem).
     */
    public function adminConsultarAsaas($id)
    {
        if (Auth::user()->papel !== 'admin') abort(403);

        $assinatura = Assinatura::findOrFail($id);

        $dadosAsaas = $this->asaasWallet->consultarAssinatura($assinatura->gateway_assinatura_id);

        return response()->json([
            'encontrado' => $dadosAsaas !== null,
            'asaas' => $dadosAsaas,
        ]);
    }

    /**
     * 🛡️ PAINEL ADMIN / WEBHOOK: Ações, Baixas e PONTUAÇÃO
     */
    public function adminAcao(Request $request, $id)
    {
        if (Auth::user()->papel !== 'admin') abort(403);

        $request->validate(['acao' => 'required|in:cancelar,travar,marcar_pago']);
        $assinatura = Assinatura::with('user')->findOrFail($id);
        $user = $assinatura->user;

        try {
        switch ($request->acao) {
            case 'cancelar':
                if ($assinatura->gateway_assinatura_id) $this->asaasService->cancelarNoGateway($assinatura->gateway_assinatura_id);
                $assinatura->update(['status' => 'cancelada', 'cancelada_em' => now()]);
                $user->update([
                    'plano_expira_em' => now(),
                    'asaas_subscription_status' => 'CANCELLED'
                ]); 
                break;
                
            case 'travar':
                $assinatura->update(['status' => 'atrasada']);
                $user->update([
                    'plano_expira_em' => now(),
                    'asaas_subscription_status' => 'OVERDUE'
                ]);
                break;
                
            case 'marcar_pago':
                $isAnual = str_contains($assinatura->nome_plano, 'anual');
                $proximoVencimento = $isAnual ? now()->addYear() : now()->addMonth();

                $assinatura->update([
                    'status'          => 'ativa', 
                    'data_inicio'     => $assinatura->data_inicio ?? now(),
                    'data_vencimento' => $proximoVencimento
                ]);
                
                $pontosPorPlano = [
                    'premium'             => 50,
                    'premium-plus'        => 150,
                    'premium-socio'       => 300,
                    'premium-anual'       => 600,   
                    'premium-socio-anual' => 3600   
                ];
                
                $pontosGanhos = $pontosPorPlano[$assinatura->nome_plano] ?? 0;

                $user->update([
                    'plano_assinatura'          => $assinatura->nome_plano,
                    'plano_expira_em'           => $proximoVencimento,
                    'asaas_subscription_status' => 'ACTIVE'
                ]);

                if ($pontosGanhos > 0) {
                    $user->increment('pontos_saldo', $pontosGanhos);
                }
                
                $this->planoService->distribuirPontosAssinatura($user, $assinatura->nome_plano);
                break;
        }
        } catch (\Exception $e) {
            Log::error('Erro na ação admin de assinatura: ' . $e->getMessage());
            return redirect()->back()->withErrors(['error' => 'Falha ao aplicar a ação: ' . $e->getMessage()]);
        }

        $mensagens = [
            'cancelar'    => 'Assinatura cancelada imediatamente.',
            'travar'      => 'Assinatura travada por atraso.',
            'marcar_pago' => 'Assinatura marcada como paga e renovada.',
        ];

        return redirect()->back()->with('success', $mensagens[$request->acao]);
    }

    /**
     * 🔵 STATUS DA ASSINATURA (Web)
     */
    public function status()
    {
        $user = Auth::user();
        
        $assinatura = Assinatura::where('user_id', $user->id)
                                ->whereIn('status', ['ativa', 'pendente', 'atrasada'])
                                ->latest()
                                ->first();
        
        $planoAtual = 'gratuito';
        $statusAcesso = 'inativo';
        $expiraEm = null;
        $diasRestantes = 0;

        if ($assinatura) {
            $planoAtual = $assinatura->nome_plano;
            
            if ($assinatura->data_vencimento) {
                $expiraEm = Carbon::parse($assinatura->data_vencimento);
                $diasRestantes = Carbon::now()->diffInDays($expiraEm, false);
                
                if ($diasRestantes >= 0 && in_array($assinatura->status, ['ativa', 'pendente'])) {
                    $statusAcesso = $assinatura->status === 'pendente' ? 'em período de teste' : 'ativo';
                } else {
                    $statusAcesso = 'vencido/atrasado';
                }
            }
        }

        $dadosTabelaUsers = [
            'pontos_saldo'              => $user->pontos_saldo ?? 0,
            'asaas_subscription_id'     => $user->asaas_subscription_id,
            'asaas_subscription_status' => $user->asaas_subscription_status,
            'plano_assinatura'          => $user->plano_assinatura,
            'plano_expira_em'           => $user->plano_expira_em ? Carbon::parse($user->plano_expira_em)->format('d/m/Y') : 'N/A'
        ];

        $statusAssinatura = [
            'plano_atual'     => $planoAtual,
            'status_acesso'   => $statusAcesso,
            'expira_em'       => $expiraEm ? $expiraEm->format('d/m/Y') : 'N/A',
            'dias_restantes'  => max(0, (int) $diasRestantes), 
            'detalhes_fatura' => $assinatura,
            'dados_usuario'   => $dadosTabelaUsers 
        ];

        if (request()->wantsJson()) {
            return response()->json($statusAssinatura);
        }

        return Inertia::render('Cliente/StatusAssinatura', [
            'statusAssinatura' => $statusAssinatura
        ]);
    }
    
    /**
     * 🟢 EDIÇÃO DO PERFIL FINANCEIRO
     */
    public function atualizarDadosFinanceiros(Request $request)
    {
        $user = Auth::user();

        if ($user->last_asaas_update && $user->last_asaas_update->diffInDays(now()) < 30) {
            $diasRestantes = 30 - $user->last_asaas_update->diffInDays(now());
            return response()->json([
                'error' => "Você poderá alterar seus dados novamente em {$diasRestantes} dias."
            ], 403);
        }

        $validated = $request->validate([
            'address'        => 'required|string',
            'address_number' => 'required|string',
            'postal_code'    => 'required|string',
        ]);

        $validated['last_asaas_update'] = now();
        $user->update($validated);

        return response()->json(['message' => 'Dados atualizados no sistema.']);
    }
}