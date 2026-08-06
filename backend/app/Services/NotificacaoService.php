<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class NotificacaoService
{
    /**
     * 📱 DISPARA A NOTIFICAÇÃO PUSH VIA EXPO
     */
    public function enviarPush(User $user, $titulo, $mensagem, $dadosExtras = [])
    {
        if (!$user->expo_push_token) {
            return; // Usuário não tem o app instalado ou não aceitou permissões
        }

        try {
            Http::post('https://exp.host/--/api/v2/push/send', [
                'to' => $user->expo_push_token,
                'sound' => 'default',
                'title' => $titulo,
                'body' => $mensagem,
                'data' => $dadosExtras,
                '_displayInForeground' => true,
            ]);
        } catch (\Exception $e) {
            Log::error('Erro ao enviar Push Expo: ' . $e->getMessage());
        }
    }

    /**
     * 📧 DISPARA O E-MAIL VIA BREVO
     */
    public function enviarEmailBrevo(User $user, $assunto, $htmlContent)
    {
        $apiKey = env('BREVO_API_KEY');
        if (!$apiKey) return;

        try {
            Http::withHeaders([
                'api-key' => $apiKey,
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
            ])->post('https://api.brevo.com/v3/smtp/email', [
                'sender' => ['name' => 'WaitLess', 'email' => 'suporte@waitless.com.br'],
                'to' => [['email' => $user->email, 'name' => $user->name]],
                'subject' => $assunto,
                'htmlContent' => $htmlContent,
            ]);
        } catch (\Exception $e) {
            Log::error('Erro Brevo: ' . $e->getMessage());
        }
    }

    /**
     * 🔔 FUNÇÃO MESTRE: Notifica Ambos (Cliente e Proprietário) de uma só vez
     */
    public function notificarEventoEstorno($cliente, $prestador, $tipoEvento, $estornoId)
    {
        $dadosPush = ['rota' => 'Estornos', 'estorno_id' => $estornoId];

        if ($tipoEvento === 'SOLICITADO') {
            // Para o Cliente
            $this->enviarPush($cliente, 'Estorno Solicitado ⏳', 'Sua solicitação está em análise.', $dadosPush);
            $this->enviarEmailBrevo($cliente, 'Recebemos seu pedido de estorno', "Olá {$cliente->name}, recebemos seu pedido de estorno. Prazo de resposta: 5 dias úteis.");

            // Para o Proprietário
            $this->enviarPush($prestador, 'Atenção: Novo Estorno ⚠️', "O cliente {$cliente->name} pediu estorno. Responda em até 48h.", $dadosPush);
            $this->enviarEmailBrevo($prestador, 'Ação Necessária: Pedido de Estorno', "Olá {$prestador->name}, o cliente {$cliente->name} contestou um pagamento. Acesse o app para enviar sua defesa.");
        }

        if ($tipoEvento === 'APROVADO') {
            // Para o Cliente
            $this->enviarPush($cliente, 'Estorno Aprovado! 🎉', 'Seu dinheiro foi devolvido para a conta/cartão.', $dadosPush);
            $this->enviarEmailBrevo($cliente, 'Estorno Aprovado', "Excelente notícia! Aprovamos seu estorno e o valor já foi devolvido.");

            // Para o Proprietário
            $this->enviarPush($prestador, 'Estorno Deferido 📉', 'O sistema deu razão ao cliente. O valor foi debitado.', $dadosPush);
            $this->enviarEmailBrevo($prestador, 'Resultado da Disputa', "Informamos que o estorno do cliente {$cliente->name} foi aprovado. O valor foi debitado do seu saldo retido.");
        }

        if ($tipoEvento === 'REPROVADO') {
            // Para o Cliente
            $this->enviarPush($cliente, 'Estorno Negado ', 'Sua solicitação foi indeferida pela equipe.', $dadosPush);
            $this->enviarEmailBrevo($cliente, 'Estorno Reprovado', "Após análise, sua solicitação de estorno não atendeu aos critérios necessários e foi negada.");

            // Para o Proprietário
            $this->enviarPush($prestador, 'Disputa Vencida! ', 'O estorno foi negado e seu saldo foi mantido.', $dadosPush);
            $this->enviarEmailBrevo($prestador, 'Disputa Vencida', "Boas notícias! A contestação do estorno foi aceita e seu dinheiro está seguro.");
        }
    }
}