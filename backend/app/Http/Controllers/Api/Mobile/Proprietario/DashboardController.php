<?php

namespace App\Http\Controllers\Api\Mobile\Proprietario;

use App\Http\Controllers\Controller;
use App\Models\Agendamento;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class DashboardController extends Controller
{
    public function index(Request $request)
    {
        try {
            $user = $request->user();

            // 1. CORREÇÃO: Adicionado 'proprietario' na lista de permissões
            if (!in_array($user->papel, ['admin', 'socio', 'proprietario', 'gerente'])) {
                return response()->json(['error' => 'Acesso não autorizado para o papel: ' . $user->papel], 403);
            }

            // 2. BUSCA SEGURA: Puxa os dados sem forçar nomes de colunas que podem não existir no banco
            $estabelecimentos = $user->estabelecimentosGerenciados()->get();

            // 3. MAPEAMENTO: Monta os dados de forma blindada contra quebras de relacionamento
            $dadosEstabelecimentos = $estabelecimentos->map(function ($est) {
                
                // Tenta contar a fila, se o relacionamento existir
                $filaAgora = 0;
                if (method_exists($est, 'agendamentos')) {
                    $filaAgora = $est->agendamentos()
                        ->whereDate('data_agendamento', now()->toDateString())
                        ->whereIn('status', ['pendente', 'confirmado'])
                        ->count();
                }

                // Tenta contar os funcionários, se o relacionamento existir
                $funcionariosCount = 0;
                if (method_exists($est, 'funcionarios')) {
                    $funcionariosCount = $est->funcionarios()->count();
                }

                return [
                    'id' => $est->id,
                    'nome' => $est->nome ?? 'Sem nome',
                    'foto_perfil' => $est->foto_perfil ?? null,
                    'avaliacao_media' => $est->avaliacao_media ?? 0,
                    'arrecadacao_total' => $est->arrecadacao_total ?? 0,
                    'ativo' => $est->ativo ?? true,
                    'fila_agora' => $filaAgora,
                    'funcionarios_count' => $funcionariosCount,
                ];
            });

            // Retorna o JSON certinho como o React Native está esperando
            return response()->json([
                'estabelecimentos' => $dadosEstabelecimentos,
                'metricas' => [
                    'total_fila' => $dadosEstabelecimentos->sum('fila_agora'),
                    'total_arrecadado' => $dadosEstabelecimentos->sum('arrecadacao_total'),
                    'ativos' => $dadosEstabelecimentos->where('ativo', true)->count(),
                ],
                'financeiro' => $this->resumoFinanceiro($user),
                'onboarding' => $this->progressoInicial($user, $estabelecimentos->pluck('id')),
                'premium' => $user->papel === 'admin' || $user->isPremium(),
            ], 200);

        } catch (\Exception $e) {
            // SE ALGO DER ERRADO NO LARAVEL, ELE MANDA O ERRO EXATO PRO SEU CELULAR!
            Log::error('Erro no Dashboard: ' . $e->getMessage());
            return response()->json(['error' => 'Erro interno: ' . $e->getMessage()], 500);
        }
    }

    /** Quantos locais, serviços e reservas (locações) o sócio já cadastrou — alimenta o passo a passo do painel. */
    private function progressoInicial($user, $idsLocais): array
    {
        $servicos = \App\Models\Servico::whereIn('estabelecimento_id', $idsLocais)->count();
        $reservas = \App\Models\ItemAluguel::catalogo()->where('estabelecimento_id', $user->id)->count();

        return [
            'locais' => $idsLocais->count(),
            'servicos' => $servicos,
            'reservas' => $reservas,
        ];
    }

    /** Saldo da carteira do sócio + receita dos últimos 30 dias (mesma base do extrato). */
    private function resumoFinanceiro($user): array
    {
        $carteira = \App\Models\Provider::where('user_id', $user->id)->first();

        $providerIds = \Illuminate\Support\Facades\DB::table('providers')
            ->join('estabelecimento_usuario', 'providers.user_id', '=', 'estabelecimento_usuario.usuario_id')
            ->whereIn('estabelecimento_usuario.estabelecimento_id', \Illuminate\Support\Facades\DB::table('estabelecimento_usuario')->where('usuario_id', $user->id)->pluck('estabelecimento_id'))
            ->pluck('providers.id');

        $receita30 = (float) \App\Models\ExtratoProvider::whereIn('provider_id', $providerIds)
            ->where('tipo', 'credito')
            ->where('created_at', '>=', now()->subDays(30))
            ->sum('valor_bruto');

        return [
            'carteira_configurada' => (bool) $carteira,
            'saldo_disponivel' => (float) ($carteira->valor_disponivel ?? 0),
            'receita_30_dias' => $receita30,
        ];
    }

    /**
     * 📍 MAPA DE RASTREAMENTO UNIFICADO
     * Lista os agendamentos ativos de hoje dos estabelecimentos do
     * sócio/gerente logado, para alimentar a tela
     * backend/mobile/app/Proprietario/MapaRastreamento.tsx (seleção de
     * qual cliente acompanhar em tempo real no mapa).
     */
    public function rastreamento(Request $request)
    {
        $user = $request->user();

        if (!in_array($user->papel, ['admin', 'socio', 'gerente'])) {
            return response()->json(['error' => 'Acesso não autorizado para o papel: ' . $user->papel], 403);
        }

        // Ver os clientes a caminho do local é um recurso Premium (mesma regra do web).
        if (!($user->papel === 'admin' || $user->isPremium())) {
            return response()->json([
                'error' => 'Seja Premium para ver seus clientes a caminho do seu local.',
                'premium_necessario' => true,
            ], 403);
        }

        $meusEstabelecimentosIds = $user->estabelecimentos()->pluck('estabelecimentos.id');

        $agendamentosDeHoje = Agendamento::with(['usuario:id,name,foto_perfil', 'estabelecimento:id,nome,latitude,longitude', 'servico:id,nome'])
            ->whereIn('estabelecimento_id', $meusEstabelecimentosIds)
            ->whereDate('data_agendamento', now()->toDateString())
            ->whereIn('status', ['pendente', 'confirmado', 'aguardando_pagamento'])
            ->orderBy('hora_agendamento', 'asc')
            ->get();

        return response()->json([
            'agendamentos_ativos' => $agendamentosDeHoje->map(fn (Agendamento $agendamento) => [
                'id' => $agendamento->id,
                'status' => $agendamento->status,
                'hora_agendamento' => $agendamento->hora_agendamento,
                'usuario' => [
                    'name' => $agendamento->usuario?->name,
                    'foto_perfil' => $agendamento->usuario?->foto_perfil,
                ],
                'estabelecimento' => [
                    'id' => $agendamento->estabelecimento?->id,
                    'nome' => $agendamento->estabelecimento?->nome,
                    'latitude' => $agendamento->estabelecimento?->latitude,
                    'longitude' => $agendamento->estabelecimento?->longitude,
                ],
                'servico' => $agendamento->servico?->nome,
                'ultima_localizacao' => $agendamento->ultima_localizacao_em ? [
                    'latitude' => (float) $agendamento->ultima_latitude,
                    'longitude' => (float) $agendamento->ultima_longitude,
                    'heading' => $agendamento->ultimo_heading !== null ? (float) $agendamento->ultimo_heading : null,
                    'velocidade' => $agendamento->ultima_velocidade !== null ? (float) $agendamento->ultima_velocidade : null,
                    'atualizado_em' => $agendamento->ultima_localizacao_em->toIso8601String(),
                ] : null,
            ]),
        ]);
    }
}