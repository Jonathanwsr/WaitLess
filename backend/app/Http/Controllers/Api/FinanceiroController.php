<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\ExtratoProvider;
use App\Models\EstabelecimentoUsuario;
use App\Models\Funcionario;
use Carbon\Carbon;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Mail;
use PDF; 

class FinanceiroController extends Controller
{
    /**
     * Retorna os dados consolidados para o Extrato Financeiro Geral (Dashboard)
     */
    public function dashboard(Request $request)
    {
        try {
            $user = $request->user();

            // 1. VALIDAÇÕES AMIGÁVEIS
            $validator = Validator::make($request->all(), [
                'data_inicio' => 'nullable|date',
                'data_fim' => 'nullable|date|after_or_equal:data_inicio',
            ], [
                'data_inicio.date' => 'A data de início informada não é válida.',
                'data_fim.date' => 'A data final informada não é válida.',
                'data_fim.after_or_equal' => 'A data final não pode ser anterior à data de início. Por favor, verifique o período.',
            ]);

            if ($validator->fails()) {
                return response()->json(['erro' => $validator->errors()->first()], 422);
            }

            // Verificação segura da coluna plano_assinatura
            if (strtolower($user->plano_assinatura ?? '') !== 'premium') {
                return response()->json(['erro' => 'Esta funcionalidade é exclusiva para assinantes Premium. Faça o upgrade para acessar o controle financeiro.'], 403);
            }

            // 2. VERIFICAÇÃO DE ACESSO (Papéis)
            $papeisPermitidos = ['admin', 'socio', 'proprietario', 'gerente'];
            $vinculos = EstabelecimentoUsuario::where('usuario_id', $user->id)
                ->whereIn('tipo', $papeisPermitidos)
                ->get();

            $isAdmin = $vinculos->where('tipo', 'admin')->isNotEmpty() || ($user->tipo ?? '') === 'admin';

            if (!$isAdmin && $vinculos->isEmpty()) {
                return response()->json(['erro' => 'Seu perfil atual não tem permissão de gerente ou sócio para visualizar estes dados.'], 403);
            }

            // 3. DATAS E QUERY BASE
            $dataInicio = $request->filled('data_inicio') ? Carbon::parse($request->data_inicio)->startOfDay() : Carbon::now()->subDays(30)->startOfDay();
            $dataFim = $request->filled('data_fim') ? Carbon::parse($request->data_fim)->endOfDay() : Carbon::now()->endOfDay();

            // Ajustado para carregar a origem (Agendamento/Aluguel) em vez de provider.estabelecimento
            $query = ExtratoProvider::with(['provider', 'usuario', 'origem.estabelecimento'])
                ->whereBetween('created_at', [$dataInicio, $dataFim]);

            if (!$isAdmin) {
                $estabelecimentosIds = $vinculos->pluck('estabelecimento_id')->toArray();
                
                $usuariosEstabelecimentoIds = EstabelecimentoUsuario::whereIn('estabelecimento_id', $estabelecimentosIds)
                    ->pluck('usuario_id')
                    ->toArray();

                $query->whereHas('provider', function($q) use ($usuariosEstabelecimentoIds) {
                    $q->whereIn('user_id', $usuariosEstabelecimentoIds);
                });
            }

            $extratosAgrupados = (clone $query)->get();

            // 4. KPIs
            $receitaTotal = $extratosAgrupados->whereIn('tipo', ['credito', 'repasse'])->where('status', '!=', 'cancelado')->sum('valor_liquido') ?? 0;
            $despesasTotais = $extratosAgrupados->whereIn('tipo', ['debito', 'estorno'])->where('status', '!=', 'cancelado')->sum('valor_bruto') ?? 0;
            
            $lucroLiquido = $receitaTotal - $despesasTotais;
            $totalTransacoes = $extratosAgrupados->count() ?? 0;
            $ticketMedio = $totalTransacoes > 0 ? ($receitaTotal / $totalTransacoes) : 0;

            // 5. GRÁFICOS E AGRUPAMENTOS
            $receitasPorPagamento = $extratosAgrupados->whereIn('tipo', ['credito', 'repasse'])
                ->groupBy('metodo_pagamento')
                ->map(fn($items) => $items->sum('valor_liquido'))
                ->toArray();

            // Obtendo o nome do estabelecimento através da origem da transação (Agendamento/Aluguel)
            $receitasPorEstabelecimento = $extratosAgrupados->whereIn('tipo', ['credito', 'repasse'])
                ->groupBy(function($extrato) {
                    return $extrato->origem?->estabelecimento?->nome ?? 'Outros';
                })
                ->map(fn($items) => $items->sum('valor_liquido'))
                ->toArray();

            // Funcionários
            $funcionariosQuery = Funcionario::where('ativo', true);
            if (!$isAdmin) {
                $estabelecimentosIds = $vinculos->pluck('estabelecimento_id')->toArray();
                $funcionariosQuery->whereIn('estabelecimento_id', $estabelecimentosIds);
            }
            $metasFuncionarios = $funcionariosQuery->get(['nome', 'meta_mensal', 'cargo']);

            $paginaAtual = $request->get('pagina', 1);
            $movimentacoes = $query->orderBy('created_at', 'desc')->paginate(10, ['*'], 'page', $paginaAtual);

            // 6. RETORNO JSON
            return response()->json([
                'sucesso' => true,
                'periodo' => [
                    'inicio' => $dataInicio->format('d/m/Y'),
                    'fim' => $dataFim->format('d/m/Y')
                ],
                'kpis' => [
                    'receita_total' => round($receitaTotal, 2),
                    'despesas_totais' => round($despesasTotais, 2),
                    'lucro_liquido' => round($lucroLiquido, 2),
                    'transacoes' => $totalTransacoes,
                    'ticket_medio' => round($ticketMedio, 2),
                ],
                'graficos' => [
                    'receitas_por_pagamento' => empty($receitasPorPagamento) ? ['Nenhum dado' => 0] : $receitasPorPagamento,
                    'receitas_por_estabelecimento' => empty($receitasPorEstabelecimento) ? ['Nenhum dado' => 0] : $receitasPorEstabelecimento,
                ],
                'funcionarios_metas' => $metasFuncionarios,
                'movimentacoes' => $movimentacoes
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'erro' => 'Erro interno no Servidor: ' . $e->getMessage(),
                'arquivo' => $e->getFile(),
                'linha' => $e->getLine()
            ], 500);
        }
    }

    public function enviarRelatorioSemanal(Request $request)
    {
        return $this->gerarEEnviarRelatorio($request, 'semanal');
    }

    public function enviarRelatorioMensal(Request $request)
    {
        return $this->gerarEEnviarRelatorio($request, 'mensal');
    }

    private function gerarEEnviarRelatorio(Request $request, $tipo)
    {
        try {
            $user = $request->user();

            if (strtolower($user->plano_assinatura ?? '') !== 'premium') {
                return response()->json(['erro' => 'Apenas usuários premium podem receber relatórios automáticos.'], 403);
            }

            if ($tipo === 'semanal') {
                $dataInicio = Carbon::now()->subWeek()->startOfDay();
                $titulo = 'Relatório Financeiro Semanal';
            } else {
                $dataInicio = Carbon::now()->subMonth()->startOfDay();
                $titulo = 'Relatório Financeiro Mensal';
            }
            $dataFim = Carbon::now()->endOfDay();

            $extratos = ExtratoProvider::whereBetween('created_at', [$dataInicio, $dataFim])->get();
            
            $dadosPdf = [
                'titulo' => $titulo,
                'data_inicio' => $dataInicio->format('d/m/Y'),
                'data_fim' => $dataFim->format('d/m/Y'),
                'receita' => $extratos->whereIn('tipo', ['credito', 'repasse'])->sum('valor_liquido') ?? 0,
                'despesa' => $extratos->whereIn('tipo', ['debito', 'estorno'])->sum('valor_bruto') ?? 0,
                'transacoes' => $extratos->count() ?? 0,
                'usuario_nome' => $user->name
            ];

            $pdf = PDF::loadView('pdf.relatorio', $dadosPdf);

            Mail::send([], [], function ($message) use ($user, $pdf, $titulo) {
                $message->to($user->email)
                        ->subject($titulo . ' - Lokyva')
                        ->attachData($pdf->output(), 'relatorio_'. Carbon::now()->format('d_m_Y') .'.pdf', [
                            'mime' => 'application/pdf',
                        ]);
                $message->html('<p>Olá, segue em anexo o seu ' . $titulo . '.</p>');
            });

            return response()->json(['sucesso' => true, 'mensagem' => 'Relatório enviado para ' . $user->email]);

        } catch (\Exception $e) {
            return response()->json(['erro' => 'Falha ao enviar o email: ' . $e->getMessage()], 500);
        }
    }
}