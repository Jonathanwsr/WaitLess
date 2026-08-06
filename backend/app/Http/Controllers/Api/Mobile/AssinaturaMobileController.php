<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Models\Assinatura;
use App\Services\AsaasAssinaturaService;
use App\Services\PlanoService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Carbon\Carbon;

class AssinaturaMobileController extends Controller
{
    protected $asaasService;
    protected $planoService;

    public function __construct(AsaasAssinaturaService $asaasService, PlanoService $planoService)
    {
        $this->asaasService = $asaasService;
        $this->planoService = $planoService;
    }

    /**
     * 🟢 ASSINAR PLANO (Avulso, Mensal ou Anual)
     * Retorna o link de pagamento ou o QRCode do PIX.
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

        // Bloqueia se o usuário já tiver este exato plano ativo
        $assinaturaAtiva = $user->assinaturas()->where('status', 'ativa')->first();
        if ($assinaturaAtiva && $assinaturaAtiva->nome_plano === $planoEscolhido) {
            return response()->json([
                'status' => 'error',
                'message' => 'Você já possui este plano ativo.'
            ], 400);
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
                'status'           => 'pendente' // Permanece pendente até o pagamento ser confirmado
            ]);

            // Chama o Gateway (Asaas)
            $gatewayData = $this->asaasService->criarCobranca($assinatura, $user, $detalhesPlano, $request->metodo);

            $linkPagamento = null;
            $pixQrCode = null;

            if ($detalhesPlano['ciclo'] === 'avulso') {
                $assinatura->update(['fatura_id' => $gatewayData['id']]);
                $linkPagamento = $gatewayData['invoiceUrl'];
            } else {
                $assinatura->update(['gateway_assinatura_id' => $gatewayData['id']]);
                $linkPagamento = $gatewayData['invoiceUrl'] ?? null; 
            }

            // 🎯 CAPTURA O PIX QR CODE PARA MANDAR PARA A TELA DO APP
            if ($request->metodo === 'pix') {
                // Dependendo de como o Asaas retorna, geralmente é 'pixQrCode' ou 'payload'
                $pixQrCode = $gatewayData['pixQrCode'] ?? ($gatewayData['payload'] ?? null);
            }

            DB::commit();

            // 📧 DISPARA O E-MAIL VIA BREVO INFORMANDO SOBRE O PAGAMENTO PENDENTE
            $this->enviarEmailBrevo($user, 'pendente', $planoEscolhido, $linkPagamento, $pixQrCode);

            return response()->json([
                'status' => 'success',
                'message' => 'Cobrança gerada com sucesso! Aguardando pagamento.',
                'link_pagamento' => $linkPagamento,
                'pix_qr_code' => $pixQrCode, // O Frontend vai usar isso para mostrar a tela de Copia e Cola
                'assinatura' => $assinatura
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status' => 'error',
                'message' => 'Falha ao processar assinatura: ' . $e->getMessage()
            ], 422);
        }
    }

    /**
     * 🟢 ATUALIZAR DADOS FINANCEIROS (Endereço, etc)
     */
    public function atualizarDadosFinanceiros(Request $request)
    {
        $user = Auth::user();

        if ($user->last_asaas_update && $user->last_asaas_update->diffInDays(now()) < 30) {
            $diasRestantes = 30 - $user->last_asaas_update->diffInDays(now());
            return response()->json([
                'status' => 'error',
                'message' => "Ação bloqueada. Você só pode alterar seus dados financeiros novamente em {$diasRestantes} dias."
            ], 403);
        }

        $validated = $request->validate([
            'address'        => 'required|string|max:255',
            'address_number' => 'required|string|max:20',
            'postal_code'    => 'required|string|max:10',
            'city'           => 'required|string',
            'province'       => 'required|string',
            'state'          => 'required|string|size:2',
        ]);

        $validated['last_asaas_update'] = now();
        $user->update($validated);

        return response()->json([
            'status' => 'success',
            'message' => 'Dados atualizados no sistema e na processadora de pagamentos.'
        ], 200);
    }

    /**
     * 🔴 CANCELAR ASSINATURA ATUAL
     */
    public function cancelar()
    {
        $user = Auth::user();
        $assinatura = $user->assinaturaAtiva;

        if (!$assinatura) {
            return response()->json([
                'status' => 'error',
                'message' => 'Nenhuma assinatura ativa encontrada.'
            ], 404);
        }

        try {
            if ($assinatura->gateway_assinatura_id) {
                $this->asaasService->cancelarNoGateway($assinatura->gateway_assinatura_id);
            }
            
            $assinatura->update([
                'status' => 'cancelada', 
                'cancelada_em' => now()
            ]);

            $dataExpiracao = $user->plano_expira_em ? $user->plano_expira_em->format('d/m/Y') : 'o fim do ciclo atual';

            return response()->json([
                'status' => 'success',
                'message' => "Assinatura cancelada com sucesso. Seus benefícios permanecem ativos até {$dataExpiracao}."
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Falha de comunicação com o provedor de pagamentos.'
            ], 500);
        }
    }

    /**
     * 🔵 STATUS DA ASSINATURA (Mobile)
     */
    public function status()
    {
        $user = Auth::user();
        
        $assinatura = $user->assinaturaAtiva ?? $user->assinaturas()->latest()->first();
        $expiraEm = $user->plano_expira_em;
        
        $diasRestantes = $expiraEm ? Carbon::now()->diffInDays($expiraEm, false) : 0;
        $isAtivo = $expiraEm && $expiraEm->isFuture();

        $dados = [
            'plano_atual' => $user->plano_assinatura ?? 'gratuito',
            'status_acesso' => $isAtivo ? 'ativo' : 'inativo',
            'expira_em' => $expiraEm ? $expiraEm->format('Y-m-d H:i:s') : null,
            'dias_restantes' => max(0, (int) $diasRestantes),
            'detalhes_fatura' => $assinatura ? [
                'id' => $assinatura->id,
                'ciclo' => $assinatura->ciclo,
                'valor' => $assinatura->valor_mensal,
                'metodo' => $assinatura->metodo_pagamento,
                'status_pagamento' => $assinatura->status,
                'cancelada_em' => $assinatura->cancelada_em ? $assinatura->cancelada_em->format('Y-m-d H:i:s') : null,
            ] : null,
        ];

        return response()->json([
            'status' => 'success',
            'data' => $dados
        ], 200);
    }

    /**
     * 📧 INTEGRAÇÃO COM BREVO (Envio de E-mails)
     * Utiliza o e-mail do usuário logado ($user->email)
     */
    private function enviarEmailBrevo($user, $tipo, $planoNome, $linkPagamento = null, $pixCode = null)
    {
        $apiKey = env('BREVO_API_KEY'); // 🚨 Lembre-se de adicionar isso no seu arquivo .env
        
        if (!$apiKey) {
            \Illuminate\Support\Facades\Log::warning('Chave do Brevo não configurada no .env');
            return;
        }

        $nomeFormatado = ucfirst(str_replace('_', ' ', $planoNome));
        $assunto = $tipo === 'pendente' ? "Finalize sua assinatura do plano {$nomeFormatado}!" : "🎉 Bem-vindo ao plano {$nomeFormatado}!";
        
        // Monta o HTML do E-mail
        $htmlContent = "<div style='font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;'>";
        $htmlContent .= "<h1 style='color: #FF5A00;'>Olá, {$user->name}! 👋</h1>";
        
        if ($tipo === 'pendente') {
            $htmlContent .= "<p>Falta muito pouco para você aproveitar todos os benefícios premium do plano <strong>{$nomeFormatado}</strong>.</p>";
            
            if ($pixCode) {
                $htmlContent .= "<p>Para garantir seu acesso imediato, pague via PIX usando o código Copia e Cola abaixo:</p>";
                $htmlContent .= "<div style='background-color: #F3F4F6; padding: 15px; border-radius: 8px; word-break: break-all; font-family: monospace;'><strong>{$pixCode}</strong></div>";
                $htmlContent .= "<p><em>A aprovação é instantânea!</em></p>";
            } elseif ($linkPagamento) {
                $htmlContent .= "<p><a href='{$linkPagamento}' style='background-color: #0F172A; color: #fff; padding: 12px 20px; text-decoration: none; border-radius: 8px; display: inline-block;'>Clique aqui para efetuar o pagamento</a></p>";
            }
        } else {
            $htmlContent .= "<p>Parabéns! O seu pagamento foi aprovado e a sua assinatura <strong>{$nomeFormatado}</strong> já está ativa.</p>";
            $htmlContent .= "<p>Acesse o aplicativo agora mesmo para aproveitar todas as vantagens.</p>";
        }

        $htmlContent .= "<br><p>Abraços,<br><strong>Equipe WaitLess</strong></p>";
        $htmlContent .= "</div>";

        // Faz a requisição POST diretamente para a API do Brevo
        try {
            Http::withHeaders([
                'api-key' => $apiKey,
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
            ])->post('https://api.brevo.com/v3/smtp/email', [
                'sender' => ['name' => 'WaitLess', 'email' => 'suporte@waitless.com.br'], // Substitua pelo seu remetente verificado no Brevo
                'to' => [['email' => $user->email, 'name' => $user->name]],
                'subject' => $assunto,
                'htmlContent' => $htmlContent,
            ]);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Erro ao enviar e-mail pelo Brevo: ' . $e->getMessage());
        }
    }
}