<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Assinatura;
use App\Services\AsaasAssinaturaService;
use App\Services\PlanoService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Carbon\Carbon;

class AssinaturaController extends Controller
{
    protected $asaasService;
    protected $planoService;

    public function __construct(AsaasAssinaturaService $asaasService, PlanoService $planoService)
    {
        $this->asaasService = $asaasService;
        $this->planoService = $planoService;
    }

    /**
     * 🟢 ASSINAR PLANO (Avulso, Mensal ou Anual via Pix/Cartão)
     */
    public function assinar(Request $request)
    {
        $request->validate([
            'plano'  => 'required|string|in:' . implode(',', array_keys(PlanoService::CATALOGO)),
            'metodo' => 'required|string|in:pix,credit_card'
        ]);

        $user = Auth::user();
        $planoEscolhido = $request->plano;
        $detalhesPlano = PlanoService::CATALOGO[$planoEscolhido];

        // Evita assinatura duplicada ativa
        $assinaturaAtiva = $user->assinaturas()->where('status', 'ativa')->first();
        if ($assinaturaAtiva && $assinaturaAtiva->nome_plano === $planoEscolhido) {
            return response()->json(['error' => 'Você já possui este plano ativo.'], 400);
        }

        DB::beginTransaction();
        try {
            $assinatura = Assinatura::create([
                'user_id'          => $user->id,
                'nome_plano'       => $planoEscolhido,
                'tipo_publico'     => $detalhesPlano['tipo'],
                'valor_mensal'     => $detalhesPlano['valor'],
                'ciclo'            => $detalhesPlano['ciclo'],
                'metodo_pagamento' => $request->metodo,
                'status'           => 'pendente'
            ]);

            // Chamada ao Gateway
            $gatewayData = $this->asaasService->criarCobranca($assinatura, $user, $detalhesPlano, $request->metodo);

            // Atualiza os IDs gerados pelo Gateway
            if ($detalhesPlano['ciclo'] === 'avulso') {
                $assinatura->update(['fatura_id' => $gatewayData['id']]);
                $link = $gatewayData['invoiceUrl'];
            } else {
                $assinatura->update(['gateway_assinatura_id' => $gatewayData['id']]);
                // Para subscriptions, muitas vezes o Asaas não retorna o link no momento da criação.
                // É recomendado buscar a fatura atrelada ou instruir o fluxo.
                $link = null; 
            }

            DB::commit();

            return response()->json([
                'message' => 'Cobrança gerada com sucesso!',
                'gateway_link' => $link,
                'assinatura' => $assinatura
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    /**
     * 🟢 EDIÇÃO DO PERFIL FINANCEIRO (Trava de 30 dias)
     */
    public function atualizarDadosFinanceiros(Request $request)
    {
        $user = Auth::user();

        // Regra de Ouro: Bloqueia se a última edição foi em menos de 30 dias
        if ($user->last_asaas_update && $user->last_asaas_update->diffInDays(now()) < 30) {
            $diasRestantes = 30 - $user->last_asaas_update->diffInDays(now());
            return response()->json([
                'error' => "Ação bloqueada de forma preventiva. Você poderá alterar seus dados novamente em {$diasRestantes} dias."
            ], 403);
        }

        $validated = $request->validate([
            'address'        => 'required|string',
            'address_number' => 'required|string',
            'postal_code'    => 'required|string',
        ]);

        // Aqui você chamaria o endpoint de PUT do Asaas para o Customer
        // Http::put("https://api.asaas.com/v3/customers/{$user->asaas_customer_id}", [...]);

        $validated['last_asaas_update'] = now();
        $user->update($validated);

        return response()->json(['message' => 'Dados atualizados no sistema e na processadora.']);
    }

    /**
     * 🔴 CANCELAMENTO PELO CLIENTE (Mantém até o fim do mês)
     */
    public function cancelar()
    {
        $user = Auth::user();
        $assinatura = $user->assinaturaAtiva;

        if (!$assinatura) {
            return response()->json(['error' => 'Nenhuma assinatura ativa encontrada.'], 404);
        }

        try {
            $this->asaasService->cancelarNoGateway($assinatura->gateway_assinatura_id);
            
            // O status fica 'cancelada', porém o $user->plano_expira_em dita até quando ele tem acesso
            $assinatura->update([
                'status' => 'cancelada', 
                'cancelada_em' => now()
            ]);

            return response()->json([
                'message' => 'Plano cancelado. Seus benefícios permanecem ativos até ' . $user->plano_expira_em->format('d/m/Y')
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Falha de comunicação com o provedor.'], 500);
        }
    }

    /**
     * 🛡️ PAINEL ADMIN: Ações forçadas
     */
    public function adminAcao(Request $request, $id)
    {
        if (Auth::user()->papel !== 'admin') abort(403);

        $request->validate(['acao' => 'required|in:cancelar,travar,marcar_pago']);
        $assinatura = Assinatura::with('user')->findOrFail($id);
        $user = $assinatura->user;

        switch ($request->acao) {
            case 'cancelar':
                if ($assinatura->gateway_assinatura_id) $this->asaasService->cancelarNoGateway($assinatura->gateway_assinatura_id);
                $assinatura->update(['status' => 'cancelada', 'cancelada_em' => now()]);
                $user->update(['plano_expira_em' => now()]); // Interrompe benefícios imediatamente
                break;

            case 'travar':
                $assinatura->update(['status' => 'bloqueada']);
                $user->update(['plano_expira_em' => now()]);
                break;

            case 'marcar_pago':
                $assinatura->update(['status' => 'ativa', 'data_inicio' => now()]);
                
                // Configura validade baseada no ciclo
                $meses = $assinatura->ciclo === 'anual' ? 12 : 1;
                $user->update([
                    'plano_assinatura' => $assinatura->nome_plano,
                    'plano_expira_em' => now()->addMonths($meses)
                ]);

                // Dispara os pontos daquele plano
                $this->planoService->distribuirPontosAssinatura($user, $assinatura->nome_plano);
                break;
        }

        return response()->json(['message' => "Ação '{$request->acao}' aplicada com sucesso."]);
    }

    /**
     * 🔵 STATUS DA ASSINATURA (Web)
     * Retorna a view do Inertia com os dias faltantes e dados da assinatura.
     */
   /**
     * 🔵 STATUS DA ASSINATURA (Web)
     * Retorna a view do Inertia com os dias faltantes e dados da assinatura direto do banco.
     */
    public function status()
    {
        $user = Auth::user();
        
        // 1. Busca a assinatura mais recente do utilizador diretamente no banco de dados
        $assinatura = Assinatura::where('user_id', $user->id)
                                ->latest()
                                ->first();
        
        // 2. Valores padrão caso o utilizador não tenha nenhuma assinatura
        $planoAtual = 'gratuito';
        $statusAcesso = 'inativo';
        $expiraEm = null;
        $diasRestantes = 0;

        // 3. Se encontrou uma assinatura no banco, atualiza as variáveis usando a coluna `data_vencimento`
        if ($assinatura) {
            $planoAtual = $assinatura->nome_plano;
            
            if ($assinatura->data_vencimento) {
                // Converte a data do banco para objeto Carbon
                $expiraEm = Carbon::parse($assinatura->data_vencimento);
                
                // Calcula os dias restantes
                $diasRestantes = Carbon::now()->diffInDays($expiraEm, false);
                
                // O acesso está ativo se a data de vencimento for no futuro E o status for 'ativa'
                if ($expiraEm->isFuture() && $assinatura->status === 'ativa') {
                    $statusAcesso = 'ativo';
                }
            }
        }

        // 4. Monta o array de resposta
        $statusAssinatura = [
            'plano_atual'     => $planoAtual,
            'status_acesso'   => $statusAcesso,
            'expira_em'       => $expiraEm ? $expiraEm->format('d/m/Y') : null,
            'dias_restantes'  => max(0, (int) $diasRestantes), // max(0) evita dias negativos
            'detalhes_fatura' => $assinatura
        ];

        // Se a requisição for JSON (via axios), retorna o JSON. Senão, retorna a View do Inertia.
        if (request()->wantsJson()) {
            return response()->json($statusAssinatura);
        }

        return Inertia::render('Cliente/StatusAssinatura', [
            'statusAssinatura' => $statusAssinatura
        ]);
    }

    
}