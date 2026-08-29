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
        // 1.1 Regra de Status
        if (!in_array(strtoupper($pagamento->status), ['CONFIRMADO', 'RECEIVED', 'PAGO', 'CONCLUIDO'])) {
            throw new Exception("Espere o pagamento ser concluído antes de solicitar um estorno.");
        }

        // 1.2 Regra de Tempo
        $dataRef = $pagamento->data_pagamento ?? $pagamento->updated_at;
        $diasPassados = Carbon::parse($dataRef)->diffInDays(now());
        if ($diasPassados > 4) {
            throw new Exception("O tempo de solicitação de estorno passou. O limite é de até 4 dias após o pagamento.");
        }

        if (Estorno::where('pagamento_id', $pagamento->id)->whereNotIn('status', ['CANCELADO', 'REPROVADO'])->exists()) {
            throw new Exception("Já existe uma solicitação de estorno em andamento para este pagamento.");
        }

        // 1.3 Regra de Taxas por Assinatura do Cliente
        $planoCliente = $cliente->plano_assinatura ?? 'gratuito';
        $taxaPercentual = 0.04; // Padrão: 4%

        if (in_array($planoCliente, ['cliente_flex', 'cliente_anual', 'basico'])) {
            $taxaPercentual = 0.02; // 2%
        } elseif (in_array($planoCliente, ['full', 'premium', 'socio_anual'])) {
            $taxaPercentual = 0.00; // 100% devolvido
        }

        $valorPago = $pagamento->valor_total ?? $pagamento->valor;
        $taxaPlataforma = $valorPago * $taxaPercentual;
        $valorEstornado = $valorPago - $taxaPlataforma; 

        // 1.4 Busca o Prestador/Responsável através da tabela Pivot
        $responsavelPivot = DB::table('estabelecimento_usuario')
            ->where('estabelecimento_id', $pagamento->estabelecimento_id)
            ->whereIn('tipo', ['admin', 'socio', 'proprietario', 'gerente'])
            ->first();

        if (!$responsavelPivot) {
            $responsavelPivot = DB::table('estabelecimento_usuario')
                ->where('estabelecimento_id', $pagamento->estabelecimento_id)
                ->first();
        }

        if (!$responsavelPivot) {
            throw new Exception("Não foi possível localizar o responsável pelo estabelecimento para registrar este estorno.");
        }

        $prestadorId = $responsavelPivot->usuario_id;

        // Normaliza a forma de pagamento para respeitar o ENUM do banco de dados
        $metodoOriginal = strtoupper($pagamento->metodo_pagamento ?? 'PIX');
        $formaPagamentoFinal = 'PIX'; // Padrão seguro

        if (in_array($metodoOriginal, ['CARTAO', 'CARTÃO', 'CREDIT_CARD'])) {
            $formaPagamentoFinal = 'CREDIT_CARD';
        } elseif ($metodoOriginal === 'BOLETO') {
            $formaPagamentoFinal = 'BOLETO';
        }

        // 1.5 Inicia a Transação
        DB::beginTransaction();
        try {
            // Cria o registro principal do estorno
            $estorno = Estorno::create([
                'codigo_estorno' => 'EST-' . strtoupper(uniqid()),
                'usuario_id' => $cliente->id,
                'prestador_id' => $prestadorId, 
                'estabelecimento_id' => $pagamento->estabelecimento_id,
                'pagamento_id' => $pagamento->id,
                'categoria' => $dados['categoria'],
                'subcategoria' => $dados['subcategoria'] ?? null,
                'valor_pago' => $valorPago,
                'taxa_plataforma' => $taxaPlataforma,
                'valor_estornado' => $valorEstornado,
                'status' => 'AGUARDANDO_DOCUMENTOS', 
                'motivo' => $dados['motivo'],
                'descricao_cliente' => $dados['descricao'],
                'forma_pagamento' => $formaPagamentoFinal, 
                'tipo_estorno' => 'TOTAL',
                'id_transacao_asaas' => $pagamento->asaas_payment_id ?? $pagamento->id_transacao_gateway,
                'prazo_resposta' => now()->addDays(2), 
                'data_pagamento' => $dataRef,
                'data_solicitacao' => now(),
            ]);

            // 1.6 Processa as Imagens
            if (!empty($imagens)) {
                if (count($imagens) > 5) throw new Exception("Máximo de 5 imagens permitidas.");

                foreach ($imagens as $imagem) {
                    if ($imagem->getSize() > 3145728) throw new Exception("A imagem excede o limite de 3MB.");
                    
                    if (!$this->analisarImagemHive($imagem)) {
                        throw new Exception("Uma das imagens foi bloqueada pelas políticas de segurança (Conteúdo sensível detectado).");
                    }

                    $path = $imagem->store('estornos/' . $estorno->id, 's3'); 

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

            // 1.7 🐛 Congela o dinheiro na Wallet do Prestador usando a tabela 'providers'
            $providerWallet = DB::table('providers')->where('user_id', $prestadorId)->first(); 
            if ($providerWallet && $providerWallet->valor_retido >= $valorPago) {
                DB::table('providers')->where('user_id', $prestadorId)->update([
                    'valor_retido' => DB::raw("valor_retido - {$valorPago}"),
                    'valor_em_analise' => DB::raw("valor_em_analise + {$valorPago}")
                ]);
            }

            // 1.8 Histórico e Notificações
            HistoricoEstorno::create([
                'estorno_id' => $estorno->id,
                'usuario_id' => $cliente->id,
                'novo_status' => 'PENDENTE',
                'descricao' => 'Estorno solicitado pelo cliente.',
                'ip' => request()->ip()
            ]);

            if ($estorno->prestador_id) {
                NotificacaoEstorno::create([
                    'estorno_id' => $estorno->id,
                    'usuario_id' => $estorno->prestador_id,
                    'titulo' => 'Nova Solicitação de Estorno',
                    'mensagem' => "O cliente {$cliente->name} solicitou um estorno. Você tem 48 horas para apresentar uma defesa."
                ]);
            }

            if (class_exists(\App\Services\NotificacaoService::class) && $estorno->prestador) {
                $notificacaoService = new \App\Services\NotificacaoService();
                $notificacaoService->notificarEventoEstorno($cliente, $estorno->prestador, 'SOLICITADO', $estorno->id);
            }

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
            MensagemEstorno::create([
                'estorno_id' => $estorno->id,
                'usuario_id' => $prestador->id,
                'tipo_usuario' => 'PRESTADOR',
                'mensagem' => $dados['descricao'],
            ]);

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
     * 3. ADMIN APROVA O ESTORNO
     */
   /**
     * 3. ADMIN APROVA O ESTORNO
     */
   /**
     * 3. ADMIN APROVA O ESTORNO
     */
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
                // 🐛 CORREÇÃO MÁXIMA: O pagamento tem Split e pertence à Conta Mãe!
                // Usamos as mesmas credenciais globais do PagamentoService
                $asaasKey = config('services.asaas.key');
                $asaasUrl = rtrim(config('services.asaas.url'), '/');

                $asaasResponse = Http::withHeaders([
                    'access_token' => $asaasKey,
                    'Content-Type' => 'application/json',
                    'Accept' => 'application/json',
                    'User-Agent' => 'WaitLessPlatform/1.0'
                ])->post("{$asaasUrl}/payments/{$idTransacao}/refund", [
                    'value' => (float) $estorno->valor_estornado,
                    'description' => 'Estorno aprovado via Plataforma WaitLess'
                ]);

                if ($asaasResponse->failed()) {
                    $estorno->update(['status' => 'ERRO_ASAAS']);
                    $statusCode = $asaasResponse->status();
                    $erroAsaas = $asaasResponse->json();
                    
                    Log::error("🔥 [DEBUG ASAAS] Erro {$statusCode} no Estorno da Transação: {$idTransacao}");
                    Log::error("🔥 [DEBUG ASAAS] Resposta: " . $asaasResponse->body());
                    
                    $mensagemErro = $erroAsaas['errors'][0]['description'] ?? "Falha de comunicação com o Asaas (Código {$statusCode}).";
                    throw new Exception("Asaas recusou o estorno: " . $mensagemErro);
                }

                $respostaData = $asaasResponse->json();
                $estorno->id_estorno_asaas = $respostaData['id'] ?? null;
            }
            
        });}
    /**
     * 4. ADMIN REPROVA O ESTORNO
     */
    public function reprovarEstorno(Estorno $estorno, User $admin, string $motivoReprovacao)
    {
        DB::transaction(function () use ($estorno, $admin, $motivoReprovacao) {
            $estorno->update([
                'status' => 'REPROVADO',
                'descricao_admin' => $motivoReprovacao,
                'data_cancelamento' => now()
            ]);

            // 🐛 Devolve o dinheiro de 'em_analise' para 'retido' na tabela providers
            DB::table('providers')->where('user_id', $estorno->prestador_id)->update([
                'valor_em_analise' => DB::raw("valor_em_analise - {$estorno->valor_pago}"),
                'valor_retido' => DB::raw("valor_retido + {$estorno->valor_pago}")
            ]);

            HistoricoEstorno::create([
                'estorno_id' => $estorno->id,
                'usuario_id' => $admin->id,
                'novo_status' => 'REPROVADO',
                'descricao' => "Estorno reprovado pelo administrador. Motivo: {$motivoReprovacao}",
                'ip' => request()->ip()
            ]);

            if (class_exists(\App\Services\NotificacaoService::class) && $estorno->prestador) {
                $notificacaoService = new \App\Services\NotificacaoService();
                $notificacaoService->notificarEventoEstorno($estorno->cliente, $estorno->prestador, 'REPROVADO', $estorno->id);
            }
        });
    }

    /**
     * INTEGRAÇÃO HIVE AI (MODERAÇÃO DE IMAGENS)
     */
    private function analisarImagemHive(UploadedFile $imagem): bool
    {
        if (!env('HIVE_API_KEY')) return true;

        try {
            $response = Http::withHeaders([
                'authorization' => 'token ' . env('HIVE_API_KEY'),
            ])->attach(
                'media', file_get_contents($imagem->getRealPath()), $imagem->getClientOriginalName()
            )->post('https://api.thehive.ai/api/v2/task/sync', [
                'classes' => 'general_nsfw,gore,weapons,drugs,hate_symbols,child_safety'
            ]);

            if ($response->successful()) {
                $statusList = $response->json('status');
                
                $classesProibidas = [
                    'general_nsfw', 'yes_female_nudity', 'yes_male_nudity', 'yes_sexual_activity', 
                    'yes_sexual_intent', 'yes_child_abuse', 'yes_drugs', 'yes_pills', 'yes_marijuana',
                    'yes_weapon_in_hand', 'yes_gore', 'very_gory', 'yes_nazi', 'yes_kkk', 
                    'yes_terrorist', 'yes_animal_abuse'
                ];

                if (!empty($statusList[0]['response']['output'][0]['classes'])) {
                    foreach ($statusList[0]['response']['output'][0]['classes'] as $classe) {
                        if (in_array($classe['class'], $classesProibidas) && $classe['score'] > 0.8) {
                            Log::warning("Hive AI bloqueou a imagem. Categoria: [{$classe['class']}] | Score: [{$classe['score']}]");
                            return false; 
                        }
                    }
                }
                return true;
            }
            
            return true; 
            
        } catch (Exception $e) {
            Log::error('Erro na conexão com a Hive AI: ' . $e->getMessage());
            return true; 
        }
    }
}