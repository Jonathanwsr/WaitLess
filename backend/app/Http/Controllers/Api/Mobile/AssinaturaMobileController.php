<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Models\Assinatura;
use App\Services\AsaasAssinaturaService;
use App\Services\PlanoService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Carbon\Carbon;

/**
 * Equivalente mobile do Api\AssinaturaController (web/Inertia): mesma
 * regra de negócio (catálogo de planos premium por papel, 7 dias grátis,
 * janela de troca/cancelamento), reaproveitada via PlanoService para que
 * as duas camadas nunca fiquem com preços/ciclos divergentes, mas com um
 * controller próprio do app — a tela backend/mobile/app/assinatura/index.tsx
 * nunca deve depender de rotas ou controllers do web.
 */
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
     * 🔵 STATUS DA ASSINATURA
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

        return response()->json([
            'plano_atual'     => $planoAtual,
            'status_acesso'   => $statusAcesso,
            'expira_em'       => $expiraEm ? $expiraEm->format('d/m/Y') : 'N/A',
            'dias_restantes'  => max(0, (int) $diasRestantes),
            'detalhes_fatura' => $assinatura,
            'dados_usuario'   => [
                'pontos_saldo'              => $user->pontos_saldo ?? 0,
                'asaas_subscription_id'     => $user->asaas_subscription_id,
                'asaas_subscription_status' => $user->asaas_subscription_status,
                'plano_assinatura'          => $user->plano_assinatura,
                'plano_expira_em'           => $user->plano_expira_em ? Carbon::parse($user->plano_expira_em)->format('d/m/Y') : 'N/A',
            ],
        ]);
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
            'metodo' => 'required|string|in:pix,credit_card',
        ]);

        $planoEscolhido = $request->plano;

        ['valor' => $valorPlano, 'tipo_publico' => $tipoPublico, 'ciclo' => $ciclo] =
            $this->planoService->resolverDetalhesPlano($user->papel, $planoEscolhido);

        $dataPrimeiraCobranca = now()->addDays(7);

        $detalhesPlano = [
            'nome'          => $planoEscolhido,
            'valor'         => $valorPlano,
            'ciclo'         => $ciclo,
            'data_cobranca' => $dataPrimeiraCobranca,
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
                'status'          => 'pendente',
            ]);

            $gatewayData = $this->asaasService->criarCobranca($assinatura, $user, $detalhesPlano, $request->metodo);

            $assinatura->update([
                'gateway_assinatura_id' => $gatewayData['id'],
            ]);

            $user->update([
                'asaas_subscription_id'     => $gatewayData['id'],
                'asaas_subscription_status' => 'PENDING',
                'plano_assinatura'          => $planoEscolhido,
            ]);

            DB::commit();

            try {
                $nomePlanoFormatado = strtoupper($planoEscolhido);
                $mensagemEmail = "Olá, {$user->name}!\n\nSua assinatura do Plano {$nomePlanoFormatado} foi iniciada com sucesso na Lokyva.\n\nVocê ganhou 7 dias de teste totalmente gratuitos! Sua primeira cobrança de R$ " . number_format($valorPlano, 2, ',', '.') . " ocorrerá apenas no dia " . $dataPrimeiraCobranca->format('d/m/Y') . ".\n\nAproveite todos os seus benefícios!\nEquipe Lokyva.";

                Mail::raw($mensagemEmail, function ($mail) use ($user, $nomePlanoFormatado) {
                    $mail->to($user->email)->subject("Bem-vindo ao Plano {$nomePlanoFormatado} - 7 Dias Grátis!");
                });
            } catch (\Exception $e) {
                Log::error('Erro ao enviar email de assinatura (mobile): ' . $e->getMessage());
            }

            return response()->json([
                'message'      => 'Assinatura gerada com sucesso! Você tem 7 dias grátis.',
                'gateway_link' => $gatewayData['invoiceUrl'] ?? null,
                'assinatura'   => $assinatura,
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

            if (now()->diffInDays($dataVencimento, false) < 1) {
                return response()->json(['error' => 'A mudança deve ser solicitada com pelo menos 1 dia de antecedência do próximo vencimento.'], 403);
            }
        }

        $request->validate([
            'novo_plano' => 'required|string|in:' . implode(',', $this->planoService->planosPermitidos($user->papel)),
            'metodo'     => 'required|string|in:pix,credit_card',
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
            'data_cobranca' => $proximaCobranca,
        ];

        DB::beginTransaction();
        try {
            if ($assinaturaAtual->gateway_assinatura_id) {
                $this->asaasService->cancelarNoGateway($assinaturaAtual->gateway_assinatura_id);
            }

            $assinaturaAtual->update([
                'status'       => 'cancelada',
                'cancelada_em' => now(),
            ]);

            $novaAssinatura = Assinatura::create([
                'user_id'         => $user->id,
                'nome_plano'      => $novoPlano,
                'tipo_publico'    => $tipoPublico,
                'valor_mensal'    => $valorPlano,
                'data_vencimento' => $proximaCobranca,
                'data_inicio'     => null,
                'status'          => 'pendente',
            ]);

            $gatewayData = $this->asaasService->criarCobranca($novaAssinatura, $user, $detalhesPlano, $request->metodo);

            $novaAssinatura->update([
                'gateway_assinatura_id' => $gatewayData['id'],
            ]);

            $user->update([
                'asaas_subscription_id'     => $gatewayData['id'],
                'asaas_subscription_status' => 'PENDING',
            ]);

            DB::commit();

            return response()->json([
                'message'      => "Mudança agendada com sucesso! Seu novo plano começará automaticamente no dia {$proximaCobranca->format('d/m/Y')}.",
                'gateway_link' => $gatewayData['invoiceUrl'] ?? null,
                'assinatura'   => $novaAssinatura,
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
                'cancelada_em' => now(),
            ]);

            $user->update([
                'asaas_subscription_status' => 'CANCELLED',
            ]);

            return response()->json([
                'message' => 'Plano cancelado com sucesso. O acesso será mantido até o fim do ciclo pago atual.',
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Falha de comunicação com o provedor de pagamentos.'], 500);
        }
    }

    /**
     * 🟢 EDIÇÃO DO PERFIL FINANCEIRO (Trava de 30 dias)
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
