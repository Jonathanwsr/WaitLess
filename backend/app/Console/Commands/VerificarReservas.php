<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Aluguel;
use App\Models\Agendamento; // Model de serviços
use App\Models\Pagamento; // Tabela financeira central
use Illuminate\Support\Facades\Http;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

class VerificarReservas extends Command
{
    protected $signature = 'financeiro:processar-diario'; // Mudei o nome para abranger tudo
    protected $description = 'Verifica estornos, auto-conclusões e faz os repasses financeiros (Split) de 88% via Asaas.';

    public function handle()
    {
        $hoje = Carbon::today()->toDateString();
        $this->info("Iniciando rotina financeira para o dia: {$hoje}");

        // ========================================================================
        // 1. AUTO-CONCLUSÃO (Aluguéis e Serviços que passaram da data e não foram confirmados)
        // ========================================================================
        
        // Para Aluguéis
        $alugueisParaConcluir = Aluguel::where('status', 'confirmado')
            ->whereDate('data_fim', '<', $hoje)
            ->get();

        foreach ($alugueisParaConcluir as $aluguel) {
            $aluguel->update(['status' => 'concluido']);
            $this->liberarPagamentoParaRepasse($aluguel->id, 'aluguel');
            $this->info("Aluguel {$aluguel->id} auto-concluído.");
        }

        // Para Serviços (Agendamentos)
        $servicosParaConcluir = Agendamento::where('status', 'confirmado')
            ->whereDate('data_servico', '<', $hoje) // ajuste para o nome da sua coluna de data
            ->get();

        foreach ($servicosParaConcluir as $servico) {
            $servico->update(['status' => 'concluido']);
            $this->liberarPagamentoParaRepasse($servico->id, 'servico');
            $this->info("Serviço {$servico->id} auto-concluído.");
        }

        // ========================================================================
        // 2. ESTORNO AUTOMÁTICO VIA ASAAS (Cliente pagou, mas nunca usou/confirmou)
        // ========================================================================
        
        // Buscar pagamentos que passaram do prazo limite (Exemplo: mais de 7 dias aguardando e nunca concluiu)
        $pagamentosParaEstorno = Pagamento::where('status', 'RECEIVED')
            ->where('status_repasse', 'aguardando')
            ->whereDate('created_at', '<=', Carbon::today()->subDays(7)) // Se ficou 7 dias parado
            ->get();

        foreach ($pagamentosParaEstorno as $pagamento) {
            $response = Http::withHeaders([
                'access_token' => env('ASAAS_API_KEY'),
            ])->post(env('ASAAS_URL') . "/payments/{$pagamento->transacao_id}/refund", [
                'value' => $pagamento->valor_total,
                'description' => 'Estorno automático: O serviço/aluguel não foi confirmado no prazo estipulado.'
            ]);

            if ($response->successful()) {
                $pagamento->update(['status_repasse' => 'estornado']);
                $this->info("Pagamento {$pagamento->id} estornado com sucesso.");
            } else {
                $this->error("Falha ao estornar pagamento {$pagamento->id}: " . $response->body());
                Log::error("Falha ao estornar Asaas: " . $response->body());
            }
        }

        // ========================================================================
        // 3. REPASSE FINANCEIRO (Transferindo os 88% para a carteira do proprietário)
        // ========================================================================
        
        // Busca o dinheiro que já deu os 7 dias de "quarentena" após a conclusão
        $pagamentosParaRepasse = Pagamento::where('status_repasse', 'liberado')
            ->whereDate('data_liberacao_repasse', '<=', $hoje)
            ->get();

        foreach ($pagamentosParaRepasse as $pagamento) {
            
            // Lógica para descobrir a carteira do Asaas de quem vai receber
            // Adapte as relações abaixo conforme o seu banco de dados
            $walletId = null;
            if ($pagamento->agendamento_id) {
                // Exemplo: Pagamento -> Agendamento -> Estabelecimento -> Provider (Dono)
                $walletId = $pagamento->agendamento->estabelecimento->provider->asaas_wallet_id ?? null;
            }

            if (!$walletId) {
                $this->error("Carteira Asaas não encontrada para o repasse do Pagamento {$pagamento->id}");
                continue; // Pula para o próximo se não achar a carteira
            }

            // Faz a transferência interna no Asaas (Da sua conta para a subconta)
            $responseTransfer = Http::withHeaders([
                'access_token' => env('ASAAS_API_KEY'),
            ])->post(env('ASAAS_URL') . "/transfers", [
                'value' => $pagamento->valor_prestador, // Envia apenas os 88%
                'walletId' => $walletId, // Destino do dinheiro
                'description' => "Repasse do serviço/aluguel #" . ($pagamento->agendamento_id ?? 'N/A')
            ]);

            if ($responseTransfer->successful()) {
                $pagamento->update(['status_repasse' => 'repassado']);
                $this->info("Repasse de R$ {$pagamento->valor_prestador} enviado para a carteira {$walletId}");
            } else {
                $this->error("Erro no repasse do Pagamento {$pagamento->id}: " . $responseTransfer->body());
                Log::error("Erro Transferência Asaas: " . $responseTransfer->body());
            }
        }

        $this->info('Rotina financeira finalizada com sucesso!');
    }

    /**
     * Função auxiliar para agendar o repasse para daqui a 7 dias quando o robô auto-conclui
     */
    private function liberarPagamentoParaRepasse($id, $tipo)
    {
        // Adapte a busca de acordo com o relacionamento que você usa
        $pagamento = Pagamento::where($tipo === 'aluguel' ? 'aluguel_id' : 'agendamento_id', $id)->first();
        
        if ($pagamento && $pagamento->status_repasse === 'aguardando') {
            $pagamento->update([
                'status_repasse' => 'liberado',
                'data_liberacao_repasse' => Carbon::today()->addDays(7)
            ]);
        }
    }
}