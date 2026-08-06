<?php

namespace App\Http\Controllers\Api\Mobile\Proprietario;

use App\Http\Controllers\Controller;
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
                ]
            ], 200);

        } catch (\Exception $e) {
            // SE ALGO DER ERRADO NO LARAVEL, ELE MANDA O ERRO EXATO PRO SEU CELULAR!
            Log::error('Erro no Dashboard: ' . $e->getMessage());
            return response()->json(['error' => 'Erro interno: ' . $e->getMessage()], 500);
        }
    }
}