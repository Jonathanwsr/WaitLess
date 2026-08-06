<?php

namespace App\Services;

use App\Models\Estorno;
use App\Models\Pagamento;
use App\Models\Agendamento;
use App\Models\DocumentoEstorno;
use App\Models\HistoricoEstorno;
use App\Models\NotificacaoEstorno;
use App\Models\LogFinanceiro;
use App\Models\MensagemEstorno;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Illuminate\Http\UploadedFile;
use Carbon\Carbon;
use Exception;

class EstornoService
{
    /**
     * 1. CLIENTE SOLICITA O ESTORNO
     */
    public function solicitarEstorno(User $cliente, Pagamento $pagamento, array $dados, array $imagens = [])
    {
        // 1.1 Regra de Tempo e Status
        if (!in_array($pagamento->status, ['CONFIRMADO', 'RECEIVED', 'PAGO'])) {
            throw new Exception("Espere o pagamento ser concluído antes de solicitar um estorno.");
        }

        $diasPassados = Carbon::parse($pagamento->data_pagamento)->diffInDays(now());
        if ($diasPassados > 3) {
            throw new Exception("O tempo de solicitação de estorno passou. O limite é de até 3 dias após o pagamento.");
        }

        if (Estorno::where('pagamento_id', $pagamento->id)->whereNotIn('status', ['CANCELADO', 'REPROVADO'])->exists()) {
            throw new Exception("Já existe uma solicitação de estorno em andamento para este pagamento.");
        }

        // 1.2 Regra de Taxas por Assinatura do Cliente
        $planoCliente = $cliente->plano_assinatura ?? 'gratuito';
        $taxaPercentual = 0.04; // Padrão: 4%

        if (in_array($planoCliente, ['cliente_flex', 'cliente_anual', 'basico'])) {
            $taxaPercentual = 0.02; // 2%
        } elseif (in_array($planoCliente, ['full', 'premium', 'socio_anual'])) {
            $taxaPercentual = 0.00; // 100% devolvido
        }

        $valorPago = $pagamento->valor;
        $taxaPlataforma = $valorPago * $taxaPercentual;
        $valorEstornado = $valorPago - $taxaPlataforma; // O que volta pro cliente

        // 1.3 Inicia a Transação para evitar dados órfãos (Proteção máxima)
        DB::beginTransaction();
        try {
            // Cria o registro principal
            $estorno = Estorno::create([
                'codigo_estorno' => 'EST-' . strtoupper(uniqid()),
                'usuario_id' => $cliente->id,
                'prestador_id' => $pagamento->estabelecimento->user_id, // Dono do local
                'estabelecimento_id' => $pagamento->estabelecimento_id,
                'pagamento_id' => $pagamento->id,
                'categoria' => $dados['categoria'], // SERVICO ou ALUGUEL
                'subcategoria' => $dados['subcategoria'] ?? null,
                'valor_pago' => $valorPago,
                'taxa_plataforma' => $taxaPlataforma,
                'valor_estornado' => $valorEstornado,
                'status' => 'AGUARDANDO_DOCUMENTOS', // Muda pra pendente após o upload das fotos
                'motivo' => $dados['motivo'],
                'descricao_cliente' => $dados['descricao'],
                'forma_pagamento' => $pagamento->metodo_pagamento,
                'tipo_estorno' => 'TOTAL',
                'id_transacao_asaas' => $pagamento->asaas_payment_id,
                'prazo_resposta' => now()->addDays(2), // 48 horas para o prestador contestar
                'data_pagamento' => $pagamento->data_pagamento,
                'data_solicitacao' => now(),
            ]);

            // 1.4 Processa as Imagens (Max 5, 3MB) e Moderacao HIVE AI
            if (!empty($imagens)) {
                if (count($imagens) > 5) throw new Exception("Máximo de 5 imagens permitidas.");

                foreach ($imagens as $imagem) {
                    // Validação de Tamanho e Segurança do Arquivo
                    if ($imagem->getSize() > 3145728) throw new Exception("A imagem excede o limite de 3MB.");
                    
                    // Moderação Hive AI
                    if (!$this->analisarImagemHive($imagem)) {
                        throw new Exception("Uma das imagens foi bloqueada pelas políticas de segurança (Conteúdo sensível detectado).");
                    }

                    // Salva na Cloudflare R3
                    $path = $imagem->store('estornos/' . $estorno->id, 's3'); // Driver S3 configurado para Cloudflare R3

                    DocumentoEstorno::create([
                        'estorno_id' => $estorno->id,
                        'usuario_id' => $cliente->id,
                        'tipo' => 'IMAGEM',
                        'arquivo' => $path,
                    ]);
                }
            }

            // Atualiza Estorno para Pendente
            $estorno->update(['status' => 'PENDENTE']);

            // 1.5 Congela o dinheiro na Wallet do Prestador (Move de Retido para Em Análise)
            $wallet = $estorno->prestador->provider; // Tabela providers agindo como wallet
            if ($wallet && $wallet->valor_retido >= $valorPago) {
                $wallet->decrement('valor_retido', $valorPago);
                $wallet->increment('valor_em_analise', $valorPago);
            }

            // 1.6 Histórico e Notificações
            HistoricoEstorno::create([
                'estorno_id' => $estorno->id,
                'usuario_id' => $cliente->id,
                'novo_status' => 'PENDENTE',
                'descricao' => 'Estorno solicitado pelo cliente.',
                'ip' => request()->ip()
            ]);

            NotificacaoEstorno::create([
                'estorno_id' => $estorno->id,
                'usuario_id' => $estorno->prestador_id,
                'titulo' => 'Nova Solicitação de Estorno',
                'mensagem' => "O cliente {$cliente->name} solicitou um estorno. Você tem 48 horas para apresentar uma defesa."
            ]);

            // Chamada do novo NotificacaoService
            $notificacaoService = new \App\Services\NotificacaoService();
            $notificacaoService->notificarEventoEstorno($cliente, $estorno->prestador, 'SOLICITADO', $estorno->id);

            DB::commit();
            return $estorno;

        } catch (Exception $e) {
            DB::rollBack();
            Log::error("Erro ao solicitar estorno: " . $e->getMessage());
            throw $e;
        }
    }

    /**
     * 2. PRESTADOR CONTESTA O ESTORNO
     */
    public function contestarEstorno(User $prestador, Estorno $estorno, array $dados, array $midias = [])
    {
        if ($estorno->prestador_id !== $prestador->id) {
            throw new Exception("Você não tem permissão para contestar este estorno.");
        }

        if (now()->greaterThan($estorno->prazo_resposta)) {
            throw new Exception("O prazo de 2 dias para contestação já expirou.");
        }

        DB::transaction(function () use ($prestador, $estorno, $dados, $midias) {
            // Cria a mensagem de defesa
            $mensagem = MensagemEstorno::create([
                'estorno_id' => $estorno->id,
                'usuario_id' => $prestador->id,
                'tipo_usuario' => 'PRESTADOR',
                'mensagem' => $dados['descricao'],
            ]);

            // Salva Mídias de Defesa
            if (!empty($midias)) {
                foreach ($midias as $midia) {
                    if ($midia->getSize() > 3145728) throw new Exception("Arquivo excede 3MB.");
                    if (!$this->analisarImagemHive($midia)) throw new Exception("Conteúdo sensível detectado.");
                    
                    $path = $midia->store('estornos/contestacoes/' . $estorno->id, 's3');
                    DocumentoEstorno::create([
                        'estorno_id' => $estorno->id,
                        'usuario_id' => $prestador->id,
                        'tipo' => 'CONTESTACAO',
                        'arquivo' => $path,
                    ]);
                }
            }

            // Atualiza status do Estorno
            $estorno->update([
                'status' => 'EM_ANALISE',
                'prestador_respondeu' => true,
                'data_resposta_prestador' => now()
            ]);

            HistoricoEstorno::create([
                'estorno_id' => $estorno->id,
                'usuario_id' => $prestador->id,
                'status_anterior' => 'PENDENTE',
                'novo_status' => 'EM_ANALISE',
                'descricao' => 'O prestador enviou uma contestação com evidências.',
                'ip' => request()->ip()
            ]);
        });
    }

    /**
     * 3. ADMIN APROVA O ESTORNO (Devolve ao Cliente)
     */
    public function aprovarEstorno(Estorno $estorno, User $adminOuSistema)
    {
        if (in_array($estorno->status, ['ESTORNADO', 'CANCELADO', 'REPROVADO'])) {
            throw new Exception("Este estorno já foi finalizado ou cancelado.");
        }

        DB::transaction(function () use ($estorno, $adminOuSistema) {
            // 3.1 Chamada na API do Asaas para efetuar o estorno no cartão/pix do cliente
            $asaasResponse = Http::withHeaders(['access_token' => env('ASAAS_API_KEY')])
                ->post(env('ASAAS_API_URL') . "/payments/{$estorno->id_transacao_asaas}/refund", [
                    'value' => $estorno->valor_estornado,
                    'description' => 'Estorno aprovado via Plataforma WaitLess'
                ]);

            if ($asaasResponse->failed()) {
                $estorno->update(['status' => 'ERRO_ASAAS']);
                Log::error("Erro Asaas Estorno: " . $asaasResponse->body());
                throw new Exception("Falha ao comunicar com o banco/Asaas. O status foi alterado para Erro.");
            }

            $respostaData = $asaasResponse->json();
            $estorno->id_estorno_asaas = $respostaData['id'] ?? null;
            
            // 3.2 Executa Regra Financeira da Model (Tira da Wallet, Tira Pontos)
            $estorno->processarEstornoConcluido();

            // 3.3 Altera o Status do Agendamento associado
            $agendamento = Agendamento::where('id', $estorno->pagamento->agendamento_id)->first();
            if ($agendamento) {
                $agendamento->update(['status' => 'estornado']); // Volta pra base
            }

            HistoricoEstorno::create([
                'estorno_id' => $estorno->id,
                'usuario_id' => $adminOuSistema->id,
                'status_anterior' => $estorno->status,
                'novo_status' => 'ESTORNADO',
                'descricao' => 'Estorno aprovado e enviado ao banco do cliente com sucesso.',
                'ip' => request()->ip()
            ]);

            NotificacaoEstorno::create([
                'estorno_id' => $estorno->id,
                'usuario_id' => $estorno->usuario_id,
                'titulo' => 'Estorno Aprovado',
                'mensagem' => 'Seu estorno foi aprovado e o valor foi enviado para sua conta/cartão original.'
            ]);

            // Chamada do novo NotificacaoService
            $notificacaoService = new \App\Services\NotificacaoService();
            $notificacaoService->notificarEventoEstorno($estorno->cliente, $estorno->prestador, 'APROVADO', $estorno->id);
        });
    }

    /**
     * 4. ADMIN REPROVA O ESTORNO (Devolve pra Wallet do Prestador)
     */
    public function reprovarEstorno(Estorno $estorno, User $admin, string $motivoReprovacao)
    {
        DB::transaction(function () use ($estorno, $admin, $motivoReprovacao) {
            $estorno->update([
                'status' => 'REPROVADO',
                'descricao_admin' => $motivoReprovacao,
                'data_cancelamento' => now()
            ]);

            // Devolve o dinheiro de 'em_analise' para 'retido' (ou 'disponivel' se o prazo já passou)
            $wallet = $estorno->prestador->provider;
            if ($wallet) {
                $wallet->decrement('valor_em_analise', $estorno->valor_pago);
                $wallet->increment('valor_retido', $estorno->valor_pago);
            }

            HistoricoEstorno::create([
                'estorno_id' => $estorno->id,
                'usuario_id' => $admin->id,
                'novo_status' => 'REPROVADO',
                'descricao' => "Estorno reprovado pelo administrador. Motivo: {$motivoReprovacao}",
                'ip' => request()->ip()
            ]);

            // Chamada do novo NotificacaoService
            $notificacaoService = new \App\Services\NotificacaoService();
            $notificacaoService->notificarEventoEstorno($estorno->cliente, $estorno->prestador, 'REPROVADO', $estorno->id);
        });
    }

    /**
     * INTEGRAÇÃO HIVE AI (MODERAÇÃO DE IMAGENS)
     * Retorna true se a imagem for segura, false se contiver violações (NSFW, Armas, Crianças, Drogas)
     */
    private function analisarImagemHive(UploadedFile $imagem): bool
    {
        // Se a chave não estiver no .env, assume-se que está seguro (Ambiente Local)
        if (!env('HIVE_API_KEY')) return true;

        try {
            $response = Http::withHeaders([
                'authorization' => 'token ' . env('HIVE_API_KEY'),
            ])->attach(
                'media', file_get_contents($imagem->getRealPath()), $imagem->getClientOriginalName()
            )->post('https://api.thehive.ai/api/v2/task/sync', [
                'classes' => 'general_nsfw,weapons,drugs,child_safety' // Classes de bloqueio
            ]);

            if ($response->successful()) {
                $statusList = $response->json('status');
                // Lógica de leitura das scores da Hive. 
                // Se o score de alguma violação for > 0.8 (80%), barra a imagem.
                foreach ($statusList[0]['response']['output'][0]['classes'] as $classe) {
                    if ($classe['score'] > 0.8) return false; 
                }
                return true;
            }
            return false; // Bloqueia por segurança se a API falhar
        } catch (Exception $e) {
            Log::error('Erro Hive AI: ' . $e->getMessage());
            return false; // Segurança em 1º lugar
        }
    }
}