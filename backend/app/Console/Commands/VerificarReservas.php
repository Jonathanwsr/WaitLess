<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Aluguel;
use App\Models\Agendamento;
use App\Models\Pagamento;
use App\Services\PagamentoService;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class VerificarReservas extends Command
{
    protected $signature = 'financeiro:processar-diario';
    protected $description = 'Verifica serviços não concluídos após 3 dias e processa os estornos automáticos da Custódia (Escrow) do Asaas.';

    public function handle(PagamentoService $pagamentoService)
    {
        $hoje = Carbon::today()->toDateString();
        // A regra é clara: 3 dias após a data agendada sem conclusão = Estorno
        $limiteDias = Carbon::today()->subDays(3)->toDateString(); 

        $this->info("Iniciando rotina financeira para o dia: {$hoje}");
        $this->info("Buscando serviços não concluídos desde: {$limiteDias}");

        // ========================================================================
        // 1. ESTORNO AUTOMÁTICO DE SERVIÇOS (Agendamentos)
        // ========================================================================
        $servicosParaEstorno = Agendamento::whereIn('status_pagamento', ['pago', 'pago_online'])
            ->where('status', '!=', 'concluido')
            ->where('status', '!=', 'cancelado')
            ->whereDate('data_agendamento', '<=', $limiteDias)
            ->get();

        foreach ($servicosParaEstorno as $agendamento) {
            $pagamento = Pagamento::where('agendamento_id', $agendamento->id)->first();

            if ($pagamento && $pagamento->id_transacao_gateway && $pagamento->status !== 'estornado') {
                try {
                    DB::transaction(function () use ($pagamentoService, $pagamento, $agendamento) {
                        
                        // Executa o estorno no Asaas (Devolve o dinheiro retido na custódia ao cliente)
                        $pagamentoService->estornarPagamento($pagamento->id_transacao_gateway);

                        // Atualiza as tabelas locais
                        $pagamento->update(['status' => 'estornado']);
                        $agendamento->update(['status' => 'cancelado', 'status_pagamento' => 'estornado']);

                        // Identifica o Provider para deduzir o saldo
                        $provider = DB::table('providers')
                            ->join('estabelecimento_usuario', 'providers.user_id', '=', 'estabelecimento_usuario.usuario_id')
                            ->where('estabelecimento_usuario.estabelecimento_id', $pagamento->estabelecimento_id)
                            ->select('providers.id')
                            ->first();

                        if ($provider) {
                            DB::table('providers')->where('id', $provider->id)->decrement('saldo', $pagamento->valor_liquido);

                            // Grava a movimentação de estorno no extrato
                            DB::table('extrato_providers')->insert([
                                'provider_id'      => $provider->id,
                                'usuario_id'       => $pagamento->usuario_id,
                                'origem_type'      => 'App\Models\Agendamento',
                                'origem_id'        => $agendamento->id,
                                'tipo'             => 'estorno',
                                'valor_bruto'      => $pagamento->valor,
                                'taxa_plataforma'  => $pagamento->taxa,
                                'valor_liquido'    => $pagamento->valor_liquido * -1,
                                'descricao'        => 'Estorno automático: Serviço não fornecido após 3 dias',
                                'status'           => 'estornado',
                                'codigo_transacao' => $pagamento->id_transacao_gateway,
                                'metodo_pagamento' => $pagamento->metodo_pagamento === 'cartao' ? 'cartao_credito' : $pagamento->metodo_pagamento,
                                'created_at'       => now()
                            ]);
                        }
                    });

                    $this->info("Serviço {$agendamento->id} estornado com sucesso.");
                } catch (\Exception $e) {
                    $this->error("Falha ao estornar Serviço {$agendamento->id}: " . $e->getMessage());
                    Log::error("Falha no estorno automático do agendamento #{$agendamento->id}: " . $e->getMessage());
                }
            }
        }

        // ========================================================================
        // 2. ESTORNO AUTOMÁTICO DE ALUGUÉIS (Reservas de Itens)
        // ========================================================================
        $alugueisParaEstorno = Aluguel::where('status', 'pago')
            ->whereDate('data_fim', '<=', $limiteDias)
            ->get();

        foreach ($alugueisParaEstorno as $aluguel) {
            $pagamento = Pagamento::where('aluguel_id', $aluguel->id)->first();

            if ($pagamento && $pagamento->id_transacao_gateway && $pagamento->status !== 'estornado') {
                try {
                    DB::transaction(function () use ($pagamentoService, $pagamento, $aluguel) {
                        
                        $pagamentoService->estornarPagamento($pagamento->id_transacao_gateway);

                        $pagamento->update(['status' => 'estornado']);
                        $aluguel->update(['status' => 'cancelado']);

                        $provider = DB::table('providers')
                            ->join('estabelecimento_usuario', 'providers.user_id', '=', 'estabelecimento_usuario.usuario_id')
                            ->where('estabelecimento_usuario.estabelecimento_id', $pagamento->estabelecimento_id)
                            ->select('providers.id')
                            ->first();

                        if ($provider) {
                            DB::table('providers')->where('id', $provider->id)->decrement('saldo', $pagamento->valor_liquido);

                            DB::table('extrato_providers')->insert([
                                'provider_id'      => $provider->id,
                                'usuario_id'       => $pagamento->usuario_id,
                                'origem_type'      => 'App\Models\Aluguel',
                                'origem_id'        => $aluguel->id,
                                'tipo'             => 'estorno',
                                'valor_bruto'      => $pagamento->valor,
                                'taxa_plataforma'  => $pagamento->taxa,
                                'valor_liquido'    => $pagamento->valor_liquido * -1,
                                'descricao'        => 'Estorno automático: Reserva de item não usufruída após 3 dias',
                                'status'           => 'estornado',
                                'codigo_transacao' => $pagamento->id_transacao_gateway,
                                'metodo_pagamento' => $pagamento->metodo_pagamento === 'cartao' ? 'cartao_credito' : $pagamento->metodo_pagamento,
                                'created_at'       => now()
                            ]);
                        }
                    });

                    $this->info("Aluguel {$aluguel->id} estornado com sucesso.");
                } catch (\Exception $e) {
                    $this->error("Falha ao estornar Aluguel {$aluguel->id}: " . $e->getMessage());
                    Log::error("Falha no estorno automático do aluguel #{$aluguel->id}: " . $e->getMessage());
                }
            }
        }

        $this->info('Rotina financeira finalizada com sucesso!');
    }
}