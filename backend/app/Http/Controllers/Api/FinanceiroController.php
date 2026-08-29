<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\ExtratoProvider;
use App\Models\EstabelecimentoUsuario;
use App\Models\Estabelecimento;
use App\Models\Funcionario;
use App\Models\Provider;
use Carbon\Carbon;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\View;
use Inertia\Inertia;
use PDF; 

class FinanceiroController extends Controller
{
    /**
     * Renderiza a tela do Extrato Financeiro Geral (Dashboard) via Inertia
     */
    public function dashboard(Request $request)
    {
        try {
            $user = $request->user();

            if (strtolower($user->plano_assinatura ?? '') !== 'premium') {
                return back()->withErrors(['erro' => 'Esta funcionalidade é exclusiva para assinantes Premium. Faça o upgrade para acessar o controle financeiro.']);
            }

            $papeisPermitidos = ['admin', 'socio', 'proprietario', 'gerente'];
            $vinculos = EstabelecimentoUsuario::where('usuario_id', $user->id)
                ->whereIn('tipo', $papeisPermitidos)
                ->get();

            $isAdmin = $vinculos->where('tipo', 'admin')->isNotEmpty() || ($user->tipo ?? '') === 'admin';

            if (!$isAdmin && $vinculos->isEmpty()) {
                return back()->withErrors(['erro' => 'Seu perfil atual não tem permissão de gerente ou sócio para visualizar estes dados.']);
            }

            $estabelecimentosIds = $isAdmin 
                ? Estabelecimento::pluck('id')->toArray() 
                : $vinculos->pluck('estabelecimento_id')->toArray();

            $dataInicio = $request->filled('data_inicio') ? Carbon::parse($request->data_inicio)->startOfDay() : Carbon::now()->subDays(30)->startOfDay();
            $dataFim = $request->filled('data_fim') ? Carbon::parse($request->data_fim)->endOfDay() : Carbon::now()->endOfDay();
            $filtroEstabelecimento = $request->get('estabelecimento_id');
            $filtroFuncionario = $request->get('funcionario_id');
            $filtroTipo = $request->get('tipo');
            $filtroPagamento = $request->get('metodo_pagamento');

            $query = ExtratoProvider::with(['provider', 'usuario', 'origem.estabelecimento'])
                ->whereBetween('created_at', [$dataInicio, $dataFim]);

            $usuariosEstabelecimentoIds = EstabelecimentoUsuario::whereIn('estabelecimento_id', $estabelecimentosIds)
                ->pluck('usuario_id')->toArray();
            
            $query->whereHas('provider', function($q) use ($usuariosEstabelecimentoIds) {
                $q->whereIn('user_id', $usuariosEstabelecimentoIds);
            });

            if ($filtroPagamento) $query->where('metodo_pagamento', $filtroPagamento);
            if ($filtroTipo) {
                $tipos = $filtroTipo === 'receita' ? ['credito', 'repasse'] : ['debito', 'estorno'];
                $query->whereIn('tipo', $tipos);
            }
            if ($filtroEstabelecimento) {
                $query->whereHasMorph('origem', ['App\Models\Agendamento'], function($q) use ($filtroEstabelecimento) {
                    $q->where('estabelecimento_id', $filtroEstabelecimento);
                });
            }
            if ($filtroFuncionario) {
                $query->whereHasMorph('origem', ['App\Models\Agendamento'], function($q) use ($filtroFuncionario) {
                    $q->where('funcionario_id', $filtroFuncionario);
                });
            }

            $extratosAgrupados = (clone $query)->get();

            $estabelecimentosBase = Estabelecimento::whereIn('id', $filtroEstabelecimento ? [$filtroEstabelecimento] : $estabelecimentosIds)->get();
            $saldoDevedorTotal = $estabelecimentosBase->sum('saldo_devedor') ?? 0;
            
            $estornosTotal = $extratosAgrupados->where('tipo', 'estorno')->where('status', '!=', 'cancelado')->sum('valor_bruto') ?? 0;
            
            $despesasTotais = $saldoDevedorTotal + $estornosTotal;
            $receitaTotal = $extratosAgrupados->whereIn('tipo', ['credito', 'repasse'])->where('status', '!=', 'cancelado')->sum('valor_liquido') ?? 0;
            
            $lucroLiquido = $receitaTotal - $despesasTotais;
            $totalTransacoes = $extratosAgrupados->count() ?? 0;
            $ticketMedio = $totalTransacoes > 0 ? ($receitaTotal / $totalTransacoes) : 0;

            $saldoAsaas = 0;
            $provedorUsuario = Provider::where('user_id', $user->id)->first();
            
            if ($provedorUsuario && $provedorUsuario->asaas_api_key) {
                $responseAsaas = Http::withHeaders(['access_token' => $provedorUsuario->asaas_api_key])->get('https://api.asaas.com/v3/finance/balance');
                if ($responseAsaas->successful()) {
                    $saldoAsaas = $responseAsaas->json('balance') ?? 0;
                }
            }

            $receitasPorPagamento = $extratosAgrupados->whereIn('tipo', ['credito', 'repasse'])
                ->groupBy('metodo_pagamento')
                ->map(fn($items) => $items->sum('valor_liquido'))->toArray();

            $receitasPorEstabelecimento = $extratosAgrupados->whereIn('tipo', ['credito', 'repasse'])
                ->groupBy(function($extrato) {
                    return $extrato->origem?->estabelecimento?->nome ?? 'Outros';
                })
                ->map(fn($items) => $items->sum('valor_liquido'))->toArray();

            $funcionariosQuery = Funcionario::where('ativo', true)->whereIn('estabelecimento_id', $estabelecimentosIds);
            $metasFuncionarios = $funcionariosQuery->get(['id', 'nome', 'meta_mensal', 'cargo']);
            $listaEstabelecimentos = $estabelecimentosBase->map->only(['id', 'nome']);

            $paginaAtual = $request->get('pagina', 1);
            $movimentacoes = $query->orderBy('created_at', 'desc')->paginate(10, ['*'], 'page', $paginaAtual);

            $primeiroNome = explode(' ', trim($user->name))[0];
            $mensagemProprietario = "Olá, {$primeiroNome}! Aqui está o resumo financeiro atualizado dos seus estabelecimentos. Continue crescendo!";

            return Inertia::render('Estabelecimentos/FinanceiroExtrato', [
                'dados' => [
                    'periodo' => ['inicio' => $dataInicio->format('d/m/Y'), 'fim' => $dataFim->format('d/m/Y')],
                    'kpis' => [
                        'receita_total' => round($receitaTotal, 2),
                        'despesas_totais' => round($despesasTotais, 2),
                        'lucro_liquido' => round($lucroLiquido, 2),
                        'transacoes' => $totalTransacoes,
                        'ticket_medio' => round($ticketMedio, 2),
                        'saldo_asaas' => round($saldoAsaas, 2),
                    ],
                    'graficos' => [
                        'receitas_por_pagamento' => empty($receitasPorPagamento) ? ['Nenhum dado' => 0] : $receitasPorPagamento,
                        'receitas_por_estabelecimento' => empty($receitasPorEstabelecimento) ? ['Nenhum dado' => 0] : $receitasPorEstabelecimento,
                    ],
                    'filtros_disponiveis' => [
                        'estabelecimentos' => $listaEstabelecimentos,
                        'funcionarios' => $metasFuncionarios,
                    ],
                    'movimentacoes' => $movimentacoes,
                    'mensagem_proprietario' => $mensagemProprietario
                ],
                'filtros_atuais' => $request->only(['data_inicio', 'data_fim', 'pagina', 'estabelecimento_id', 'funcionario_id', 'tipo', 'metodo_pagamento'])
            ]);

        } catch (\Exception $e) {
            return back()->withErrors(['erro' => 'Erro interno no Servidor: ' . $e->getMessage()]);
        }
    }

    /**
     * Exportação Dinâmica (Excel CSV ou PDF)
     */
    public function exportar(Request $request)
    {
        $formato = $request->get('formato', 'csv');
        $user = $request->user();

        $papeisPermitidos = ['admin', 'socio', 'proprietario', 'gerente'];
        $vinculos = EstabelecimentoUsuario::where('usuario_id', $user->id)->whereIn('tipo', $papeisPermitidos)->get();
        $isAdmin = $vinculos->where('tipo', 'admin')->isNotEmpty() || ($user->tipo ?? '') === 'admin';
        $estabelecimentosIds = $isAdmin ? Estabelecimento::pluck('id')->toArray() : $vinculos->pluck('estabelecimento_id')->toArray();

        $dataInicio = $request->filled('data_inicio') ? Carbon::parse($request->data_inicio)->startOfDay() : Carbon::now()->subDays(30)->startOfDay();
        $dataFim = $request->filled('data_fim') ? Carbon::parse($request->data_fim)->endOfDay() : Carbon::now()->endOfDay();
        $filtroEstabelecimento = $request->get('estabelecimento_id');
        $filtroFuncionario = $request->get('funcionario_id');
        $filtroTipo = $request->get('tipo');
        $filtroPagamento = $request->get('metodo_pagamento');

        $query = ExtratoProvider::with(['usuario', 'origem.estabelecimento'])
            ->whereBetween('created_at', [$dataInicio, $dataFim]);

        $usuariosEstabelecimentoIds = EstabelecimentoUsuario::whereIn('estabelecimento_id', $estabelecimentosIds)
            ->pluck('usuario_id')->toArray();
        
        $query->whereHas('provider', function($q) use ($usuariosEstabelecimentoIds) {
            $q->whereIn('user_id', $usuariosEstabelecimentoIds);
        });

        if ($filtroPagamento) $query->where('metodo_pagamento', $filtroPagamento);
        if ($filtroTipo) {
            $tipos = $filtroTipo === 'receita' ? ['credito', 'repasse'] : ['debito', 'estorno'];
            $query->whereIn('tipo', $tipos);
        }
        if ($filtroEstabelecimento) {
            $query->whereHasMorph('origem', ['App\Models\Agendamento'], function($q) use ($filtroEstabelecimento) {
                $q->where('estabelecimento_id', $filtroEstabelecimento);
            });
        }
        if ($filtroFuncionario) {
            $query->whereHasMorph('origem', ['App\Models\Agendamento'], function($q) use ($filtroFuncionario) {
                $q->where('funcionario_id', $filtroFuncionario);
            });
        }

        $extratos = $query->orderBy('created_at', 'desc')->get();

        $estabelecimentosBase = Estabelecimento::whereIn('id', $filtroEstabelecimento ? [$filtroEstabelecimento] : $estabelecimentosIds)->get();
        $saldoDevedorTotal = $estabelecimentosBase->sum('saldo_devedor') ?? 0;
        $estornosTotal = $extratos->where('tipo', 'estorno')->where('status', '!=', 'cancelado')->sum('valor_bruto') ?? 0;
        
        $despesasTotais = $saldoDevedorTotal + $estornosTotal;
        $receitaTotal = $extratos->whereIn('tipo', ['credito', 'repasse'])->where('status', '!=', 'cancelado')->sum('valor_liquido') ?? 0;
        $lucroLiquido = $receitaTotal - $despesasTotais;
        $totalTransacoes = $extratos->count() ?? 0;
        $ticketMedio = $totalTransacoes > 0 ? ($receitaTotal / $totalTransacoes) : 0;

        $saldoAsaas = 0;
        $provedorUsuario = Provider::where('user_id', $user->id)->first();
        if ($provedorUsuario && $provedorUsuario->asaas_api_key) {
            $responseAsaas = Http::withHeaders(['access_token' => $provedorUsuario->asaas_api_key])->get('https://api.asaas.com/v3/finance/balance');
            if ($responseAsaas->successful()) $saldoAsaas = $responseAsaas->json('balance') ?? 0;
        }

        $nomeFiltro = $filtroEstabelecimento ? Estabelecimento::find($filtroEstabelecimento)->nome ?? 'Específico' : 'Todos os estabelecimentos';

        if ($formato === 'pdf') {
            // Ajustado para 'pdfs.extrato'
            if (!View::exists('pdfs.extrato')) {
                return back()->withErrors(['erro' => 'O layout do PDF não foi encontrado. Certifique-se de criar o arquivo em resources/views/pdfs/extrato.blade.php']);
            }

            $dadosPdf = [
                'titulo' => 'Extrato Financeiro Geral',
                'data_inicio' => $dataInicio->format('d/m/Y'),
                'data_fim' => $dataFim->format('d/m/Y'),
                'primeiro_nome' => explode(' ', trim($user->name))[0],
                'filtro_estabelecimento' => $nomeFiltro,
                'receita_total' => $receitaTotal,
                'despesas_totais' => $despesasTotais,
                'lucro_liquido' => $lucroLiquido,
                'saldo_asaas' => $saldoAsaas,
                'transacoes' => $totalTransacoes,
                'ticket_medio' => $ticketMedio,
                'movimentacoes' => $extratos
            ];
            
            // Ajustado para 'pdfs.extrato'
            $pdf = PDF::loadView('pdfs.extrato', $dadosPdf);
            return $pdf->download('extrato_financeiro.pdf');
        }

        if ($formato === 'csv') {
            $filename = "extrato_financeiro_" . date('Y_m_d_H_i') . ".csv";
            $headers = [
                "Content-type" => "text/csv", "Content-Disposition" => "attachment; filename=$filename",
                "Pragma" => "no-cache", "Cache-Control" => "must-revalidate, post-check=0, pre-check=0", "Expires" => "0"
            ];
            $callback = function() use($extratos) {
                $file = fopen('php://output', 'w');
                fputs($file, $bom =( chr(0xEF) . chr(0xBB) . chr(0xBF) ));
                fputcsv($file, ['Data/Hora', 'Tipo', 'Descricao', 'Estabelecimento', 'Cliente', 'Pagamento', 'Valor Bruto', 'Valor Liquido', 'Status'], ';');

                foreach ($extratos as $mov) {
                    fputcsv($file, [
                        $mov->created_at->format('d/m/Y H:i'), strtoupper($mov->tipo), $mov->descricao,
                        $mov->origem?->estabelecimento?->nome ?? 'Sem Vínculo', $mov->usuario?->name ?? 'Cliente Avulso',
                        strtoupper($mov->metodo_pagamento ?? ''), number_format($mov->valor_bruto, 2, ',', ''), number_format($mov->valor_liquido, 2, ',', ''), strtoupper($mov->status)
                    ], ';');
                }
                fclose($file);
            };
            return response()->stream($callback, 200, $headers);
        }

        return back()->withErrors(['erro' => 'Formato de exportação inválido.']);
    }

    /**
     * Envia Relatório Semanal em PDF via Email (Brevo)
     */
    public function enviarRelatorioSemanal(Request $request)
    {
        return $this->gerarEEnviarRelatorio($request, 'semanal');
    }

    /**
     * Envia Relatório Mensal em PDF via Email (Brevo)
     */
    public function enviarRelatorioMensal(Request $request)
    {
        return $this->gerarEEnviarRelatorio($request, 'mensal');
    }

    /**
     * Lógica centralizada para gerar PDF e enviar via Brevo
     */
    private function gerarEEnviarRelatorio(Request $request, $tipo)
    {
        try {
            $user = $request->user();

            if (strtolower($user->plano_assinatura ?? '') !== 'premium') {
                return response()->json(['erro' => 'Apenas usuários premium podem receber relatórios automáticos.'], 403);
            }

            $filtroEstabelecimento = $request->get('estabelecimento_id');

            // Lógica de Datas: Dia 1 envia o mês fechado anterior.
            if ($tipo === 'semanal') {
                $dataInicio = Carbon::now()->subWeek()->startOfWeek();
                $dataFim = Carbon::now()->subWeek()->endOfWeek();
                $titulo = 'Relatório Financeiro Semanal';
                $referenciaFiltro = 'semana de ' . $dataInicio->format('d/m') . ' a ' . $dataFim->format('d/m');
            } else {
                $dataInicio = Carbon::now()->subMonthNoOverflow()->startOfMonth();
                $dataFim = Carbon::now()->subMonthNoOverflow()->endOfMonth();
                $titulo = 'Relatório Financeiro Mensal';
                
                $meses = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
                $referenciaFiltro = $meses[$dataInicio->month] . ' de ' . $dataInicio->year;
            }

            $papeisPermitidos = ['admin', 'socio', 'proprietario', 'gerente'];
            $vinculos = EstabelecimentoUsuario::where('usuario_id', $user->id)->whereIn('tipo', $papeisPermitidos)->get();
            $isAdmin = $vinculos->where('tipo', 'admin')->isNotEmpty() || ($user->tipo ?? '') === 'admin';
            $estabelecimentosIds = $isAdmin ? Estabelecimento::pluck('id')->toArray() : $vinculos->pluck('estabelecimento_id')->toArray();

            $query = ExtratoProvider::whereBetween('created_at', [$dataInicio, $dataFim]);

            $usuariosEstabelecimentoIds = EstabelecimentoUsuario::whereIn('estabelecimento_id', $estabelecimentosIds)
                ->pluck('usuario_id')->toArray();

            $query->whereHas('provider', function($q) use ($usuariosEstabelecimentoIds) {
                $q->whereIn('user_id', $usuariosEstabelecimentoIds);
            });

            // Filtra por um estabelecimento específico se for passado na requisição, senão manda o geral
            if ($filtroEstabelecimento) {
                $query->whereHasMorph('origem', ['App\Models\Agendamento'], function($q) use ($filtroEstabelecimento) {
                    $q->where('estabelecimento_id', $filtroEstabelecimento);
                });
            }

            $extratos = $query->get();

            $estabelecimentosBase = Estabelecimento::whereIn('id', $filtroEstabelecimento ? [$filtroEstabelecimento] : $estabelecimentosIds)->get();
            $despesasTotal = ($estabelecimentosBase->sum('saldo_devedor') ?? 0) + ($extratos->where('tipo', 'estorno')->where('status', '!=', 'cancelado')->sum('valor_bruto') ?? 0);
            $receitaTotal = $extratos->whereIn('tipo', ['credito', 'repasse'])->where('status', '!=', 'cancelado')->sum('valor_liquido') ?? 0;
            
            $primeiroNome = explode(' ', trim($user->name))[0];

            // Ajustado para 'pdfs.relatorio'
            if (!View::exists('pdfs.relatorio')) {
                return response()->json(['erro' => 'O layout do relatório não foi encontrado. Verifique se existe em resources/views/pdfs/relatorio.blade.php'], 500);
            }

            $dadosPdf = [
                'titulo' => $titulo,
                'data_inicio' => $dataInicio->format('d/m/Y'),
                'data_fim' => $dataFim->format('d/m/Y'),
                'receita' => $receitaTotal,
                'despesa' => $despesasTotal,
                'transacoes' => $extratos->count() ?? 0,
                'usuario_nome' => $user->name,
                'primeiro_nome' => $primeiroNome
            ];

            // Ajustado para 'pdfs.relatorio'
            $pdf = PDF::loadView('pdfs.relatorio', $dadosPdf);

            // Tenta enviar 1 vez e faz mais 2 retentativas caso a API de email falhe
            retry(3, function () use ($user, $pdf, $titulo, $referenciaFiltro, $primeiroNome) {
                Mail::send([], [], function ($message) use ($user, $pdf, $titulo, $referenciaFiltro, $primeiroNome) {
                    $message->to($user->email)
                            ->subject("{$titulo} - Lokyva 💙")
                            ->attachData($pdf->output(), 'relatorio_lokyva_' . Carbon::now()->format('d_m_Y') . '.pdf', [
                                'mime' => 'application/pdf',
                            ]);
                    
                    // HTML Moderno, responsivo e super amigável
                    $html = "
                        <div style='background-color: #f3f4f6; padding: 40px 20px; font-family: Helvetica, Arial, sans-serif;'>
                            <div style='max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);'>
                                
                                <!-- Cabeçalho Azul/Indigo -->
                                <div style='background-color: #4f46e5; padding: 30px; text-align: center;'>
                                    <h1 style='color: #ffffff; margin: 0; font-size: 26px; font-weight: bold; letter-spacing: 1px;'>Lokyva</h1>
                                </div>
                                
                                <!-- Corpo do Email -->
                                <div style='padding: 40px 30px; color: #374151; line-height: 1.6; font-size: 15px;'>
                                    <h2 style='color: #111827; margin-top: 0; font-size: 20px;'>Olá, {$primeiroNome}! 👋</h2>
                                    <p>Esperamos que este e-mail o encontre bem e cheio de energia!</p>
                                    
                                    <p>A equipe do <strong>Lokyva</strong> preparou o seu <strong>{$titulo}</strong> com muito carinho e atenção aos detalhes.</p>
                                    
                                    <p>Em anexo, você encontrará o consolidado financeiro referente a <strong>{$referenciaFiltro}</strong>. Criamos este material para que você tenha total clareza dos seus resultados e possa tomar as melhores decisões para a sua operação.</p>
                                    
                                    <p>Desejamos que esses números tragam ótimas notícias e insights valiosos para você decolar ainda mais!</p>
                                    
                                    <hr style='border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;'>
                                    
                                    <!-- Rodapé do Email -->
                                    <p style='margin: 0; font-size: 14px; color: #6b7280;'>
                                        Um abraço caloroso,<br>
                                        <strong style='color: #111827; font-size: 15px;'>Equipe Lokyva 🚀</strong>
                                    </p>
                                </div>
                            </div>
                        </div>
                    ";
                    
                    $message->html($html);
                });
            }, 2000);

            return response()->json(['sucesso' => true, 'mensagem' => 'Relatório enviado com sucesso para ' . $user->email]);

        } catch (\Exception $e) {
            return response()->json(['erro' => 'Falha ao enviar o email após 3 tentativas: ' . $e->getMessage()], 500);
        }
    }
}