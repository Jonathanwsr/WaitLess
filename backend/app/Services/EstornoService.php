<?php

namespace App\Services;

use App\Models\Estorno;
use App\Models\Pagamento;
use App\Models\Agendamento;
use App\Models\DocumentoEstorno;
use App\Models\HistoricoEstorno;
use App\Models\NotificacaoEstorno;
use App\Models\MensagemEstorno;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail; // Adicionado para o envio de e-mails via Brevo
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

        // 1.3 Regra de Taxas
        $planoCliente = $cliente->plano_assinatura ?? 'gratuito';
        $taxaPercentual = 0.04; 

        if (in_array($planoCliente, ['cliente_flex', 'cliente_anual', 'basico'])) {
            $taxaPercentual = 0.02; 
        } elseif (in_array($planoCliente, ['full', 'premium', 'socio_anual'])) {
            $taxaPercentual = 0.00; 
        }

        $valorPago = $pagamento->valor_total ?? $pagamento->valor;
        $taxaPlataforma = $valorPago * $taxaPercentual;
        $valorEstornado = $valorPago - $taxaPlataforma; 

        // 1.4 Busca o Prestador/Responsável
        $responsavelPivot = DB::table('estabelecimento_usuario')
            ->where('estabelecimento_id', $pagamento->estabelecimento_id)
            ->whereIn('tipo', ['admin', 'socio', 'proprietario', 'gerente'])
            ->first() ?? DB::table('estabelecimento_usuario')
                ->where('estabelecimento_id', $pagamento->estabelecimento_id)
                ->first();

        if (!$responsavelPivot) {
            throw new Exception("Não foi possível localizar o responsável pelo estabelecimento para registrar este estorno.");
        }

        $prestadorId = $responsavelPivot->usuario_id;

        // Normaliza forma de pagamento
        $metodoOriginal = strtoupper($pagamento->metodo_pagamento ?? 'PIX');
        $formaPagamentoFinal = in_array($metodoOriginal, ['CARTAO', 'CARTÃO', 'CREDIT_CARD']) ? 'CREDIT_CARD' : ($metodoOriginal === 'BOLETO' ? 'BOLETO' : 'PIX');

        // 1.5 Transação
        DB::beginTransaction();
        try {
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
                'status' => 'PENDENTE', 
                'motivo' => $dados['motivo'],
                'descricao_cliente' => $dados['descricao'],
                'forma_pagamento' => $formaPagamentoFinal, 
                'tipo_estorno' => 'TOTAL',
                'id_transacao_asaas' => $pagamento->asaas_payment_id ?? $pagamento->id_transacao_gateway,
                'prazo_resposta' => now()->addDays(2), 
                'data_pagamento' => $dataRef,
                'data_solicitacao' => now(),
            ]);

            // 1.6 Upload de Imagens
            if (!empty($imagens)) {
                if (count($imagens) > 5) throw new Exception("Máximo de 5 imagens permitidas.");

                foreach ($imagens as $imagem) {
                    if ($imagem->getSize() > 3145728) throw new Exception("A imagem excede o limite de 3MB.");
                    if (!$this->analisarImagemHive($imagem)) throw new Exception("Uma das imagens foi bloqueada por conter conteúdo sensível.");

                    $path = $imagem->store('estornos/' . $estorno->id, 's3'); 
                    DocumentoEstorno::create([
                        'estorno_id' => $estorno->id,
                        'usuario_id' => $cliente->id,
                        'tipo' => 'IMAGEM',
                        'arquivo' => $path,
                    ]);
                }
            }

            // 1.7 Congela o dinheiro que estava RETIDO (Escrow) e joga para EM ANÁLISE
            DB::table('providers')
                ->where('user_id', $prestadorId)
                ->where('valor_retido', '>=', $valorPago)
                ->update([
                    'valor_retido' => DB::raw("valor_retido - {$valorPago}"),
                    'valor_em_analise' => DB::raw("valor_em_analise + {$valorPago}")
                ]);

            // 1.8 Logs e Notificações Locais
            HistoricoEstorno::create([
                'estorno_id' => $estorno->id,
                'usuario_id' => $cliente->id,
                'novo_status' => 'PENDENTE',
                'descricao' => 'Estorno solicitado. Valor congelado na carteira do prestador.',
                'ip' => request()->ip()
            ]);

            if ($estorno->prestador_id) {
                NotificacaoEstorno::create([
                    'estorno_id' => $estorno->id,
                    'usuario_id' => $estorno->prestador_id,
                    'titulo' => 'Nova Solicitação de Estorno',
                    'mensagem' => "O cliente {$cliente->name} solicitou um estorno. Você tem 48h para contestar."
                ]);
            }

            // ✉️ Envio de E-mail: Dispara notificação de solicitação
            $this->enviarEmailNotificacaoEstorno($estorno, 'SOLICITADO');

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
     * 3. ADMIN APROVA O ESTORNO (Devolve ao Cliente)
     */
    public function aprovarEstorno(Estorno $estorno, User $adminOuSistema)
    {
        if (in_array($estorno->status, ['ESTORNADO', 'CANCELADO', 'REPROVADO'])) {
            throw new Exception("Este estorno já foi finalizado ou cancelado.");
        }

        DB::transaction(function () use ($estorno, $adminOuSistema) {
            $idTransacao = $estorno->id_transacao_asaas ?? ($estorno->pagamento->id_transacao_gateway ?? null);

            if ($idTransacao) {
                // O pagamento tem Split e pertence à Conta Mãe!
                $asaasKey = config('services.asaas.key');
                $asaasUrl = rtrim(config('services.asaas.url'), '/');

                $payloadRefund = ['description' => 'Estorno aprovado via Plataforma WaitLess'];
                if ($estorno->tipo_estorno === 'PARCIAL' && $estorno->valor_estornado < $estorno->valor_pago) {
                    $payloadRefund['value'] = (float) $estorno->valor_estornado;
                }

                $asaasResponse = Http::withHeaders([
                    'access_token' => $asaasKey,
                    'Content-Type' => 'application/json',
                    'Accept' => 'application/json',
                    'User-Agent' => 'WaitLessPlatform/1.0'
                ])->post("{$asaasUrl}/payments/{$idTransacao}/refund", $payloadRefund);

                if ($asaasResponse->failed()) {
                    $statusCode = $asaasResponse->status();
                    $erroAsaas = $asaasResponse->json();
                    $mensagemErro = $erroAsaas['errors'][0]['description'] ?? "Falha de comunicação com o Asaas (Código {$statusCode}).";
                    
                    // Sincronização: Se o Asaas avisar que JÁ ESTÁ ESTORNANDO, tratamos como SUCESSO!
                    $mensagemEmMinusculo = strtolower($mensagemErro);
                    if (strpos($mensagemEmMinusculo, 'já está em andamento') !== false || strpos($mensagemEmMinusculo, 'já foi estornada') !== false) {
                        Log::info("Sincronizando: O Asaas confirmou que a transação {$idTransacao} já está em processo de estorno.");
                    } else {
                        $estorno->update(['status' => 'ERRO_ASAAS']);
                        Log::error("🔥 [DEBUG ASAAS] Erro {$statusCode} no Estorno da Transação: {$idTransacao}");
                        Log::error("🔥 [DEBUG ASAAS] Resposta: " . $asaasResponse->body());
                        throw new Exception("Asaas recusou o estorno: " . $mensagemErro);
                    }
                } else {
                    $respostaData = $asaasResponse->json();
                    $estorno->id_estorno_asaas = $respostaData['id'] ?? null;
                }
            }
            
            // Tira do valor "Em Análise" e registra como "Estornado" no banco
            DB::table('providers')->where('user_id', $estorno->prestador_id)->update([
                'valor_em_analise' => DB::raw("valor_em_analise - {$estorno->valor_pago}"),
                'valor_estornado' => DB::raw("valor_estornado + {$estorno->valor_pago}")
            ]);
            
            if (method_exists($estorno, 'processarEstornoConcluido')) {
                $estorno->processarEstornoConcluido();
            } elseif ($estorno->pagamento) {
                $estorno->pagamento->update(['status' => 'estornado']); // Atualiza tabela de pagamentos
            }

            if ($estorno->pagamento && $estorno->pagamento->agendamento_id) {
                $agendamento = Agendamento::where('id', $estorno->pagamento->agendamento_id)->first();
                if ($agendamento) {
                    $agendamento->update(['status_pagamento' => 'estornado']);
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
                'descricao' => 'Estorno aprovado e devolvido ao banco do cliente com sucesso.',
                'ip' => request()->ip()
            ]);

            // ✉️ Envio de E-mail: Dispara notificação de aprovação
            $this->enviarEmailNotificacaoEstorno($estorno, 'APROVADO');
        });
    }

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

            // Devolve o dinheiro congelado para o saldo Retido (Escrow) do prestador
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

            // ✉️ Envio de E-mail: Dispara notificação de reprovação
            $this->enviarEmailNotificacaoEstorno($estorno, 'REPROVADO');
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

    /**
     * 👉 SISTEMA DE NOTIFICAÇÕES POR E-MAIL PARA ESTORNOS (BREVO)
     */
    private function enviarEmailNotificacaoEstorno(Estorno $estorno, string $evento)
    {
        try {
            $cliente = $estorno->cliente;
            $prestador = $estorno->prestador;
            $estabelecimentoNome = DB::table('estabelecimentos')->where('id', $estorno->estabelecimento_id)->value('nome') ?? 'WaitLess';
            $valorStr = number_format($estorno->valor_pago, 2, ',', '.');
            
            $assuntoCliente = "";
            $mensagemCliente = "";
            
            $assuntoDono = "";
            $mensagemDono = "";

            switch ($evento) {
                case 'SOLICITADO':
                    // Para o Cliente
                    $assuntoCliente = "Recebemos sua solicitação de estorno - {$estabelecimentoNome}";
                    $mensagemCliente = "Olá, {$cliente->name}!\n\nRecebemos o seu pedido de estorno no valor de R$ {$valorStr} referente ao estabelecimento {$estabelecimentoNome}.\n\nAguarde, nossa equipe e o estabelecimento analisarão o caso em até 48 horas. Você será notificado sobre a decisão.\n\nEquipe WaitLess";
                    
                    // Para o Dono
                    $assuntoDono = "Disputa Aberta: Solicitação de Estorno";
                    $mensagemDono = "Olá, {$prestador->name}.\n\nO cliente {$cliente->name} abriu uma solicitação de estorno no valor de R$ {$valorStr}.\n\nMotivo alegado: {$estorno->motivo}\n\nO valor foi temporariamente retido por segurança. Acesse seu painel administrativo WaitLess em até 48 horas para enviar sua contestação e provas.";
                    break;

                case 'APROVADO':
                    // Para o Cliente
                    $assuntoCliente = "Seu Estorno foi Aprovado!";
                    $mensagemCliente = "Boa notícia, {$cliente->name}!\n\nO seu pedido de estorno no valor de R$ {$valorStr} (Referente a: {$estabelecimentoNome}) foi APROVADO.\n\nO valor já foi processado e será devolvido automaticamente para a mesma conta bancária ou cartão de crédito utilizado na compra.\n\nEquipe WaitLess";
                    
                    // Para o Dono
                    $assuntoDono = "Resolução de Disputa: Estorno Aprovado";
                    $mensagemDono = "Olá, {$prestador->name}.\n\nInformamos que a disputa do cliente {$cliente->name} foi julgada e o estorno de R$ {$valorStr} foi APROVADO e devolvido ao cliente.\n\nO valor correspondente foi debitado do seu saldo em análise. Acesse o painel para ver o parecer da administração.";
                    break;

                case 'REPROVADO':
                    // Para o Cliente
                    $assuntoCliente = "Atualização sobre sua solicitação de estorno";
                    $mensagemCliente = "Olá, {$cliente->name}.\n\nApós análise das evidências, a sua solicitação de estorno no valor de R$ {$valorStr} foi REPROVADA.\n\nParecer da administração:\n\"{$estorno->descricao_admin}\"\n\nEquipe WaitLess";
                    
                    // Para o Dono
                    $assuntoDono = "Disputa Vencida: Estorno Reprovado";
                    $mensagemDono = "Excelente notícia, {$prestador->name}!\n\nA solicitação de estorno do cliente {$cliente->name} foi REPROVADA pela nossa equipe.\n\nO valor de R$ {$valorStr} que estava bloqueado já retornou para o seu Saldo Retido (Custódia) e seguirá o fluxo normal de liberação.";
                    break;
            }

            // Disparo para o Cliente
            if ($cliente && $cliente->email && $mensagemCliente !== "") {
                Mail::raw($mensagemCliente, function ($mail) use ($cliente, $assuntoCliente) {
                    $mail->to($cliente->email)->subject($assuntoCliente);
                });
            }

            // Disparo para o Prestador (Dono)
            if ($prestador && $prestador->email && $mensagemDono !== "") {
                Mail::raw($mensagemDono, function ($mail) use ($prestador, $assuntoDono) {
                    $mail->to($prestador->email)->subject($assuntoDono);
                });
            }

        } catch (\Exception $e) {
            Log::error("Erro ao enviar emails de estorno (Brevo): " . $e->getMessage());
        }
    }
}