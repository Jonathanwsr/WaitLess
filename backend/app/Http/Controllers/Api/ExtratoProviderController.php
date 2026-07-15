<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ExtratoProvider;
use App\Models\Estabelecimento;
use App\Models\Funcionario;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;
use Inertia\Inertia;

class ExtratoProviderController extends Controller
{
    /**
     * Exibe o painel financeiro com dados filtrados por regras de acesso (papel)
     */
    public function index(Request $request)
    {
        $user = Auth::user();

        // 1. Definição do escopo de estabelecimentos permitidos de acordo com o papel
        if ($user->papel === 'admin') {
            $estabelecimentosPermitidos = Estabelecimento::pluck('id')->toArray();
        } else {
            // Sócios e Gerentes só possuem acesso às suas filiais vinculadas
            $estabelecimentosPermitidos = DB::table('estabelecimento_usuario')
                ->where('usuario_id', $user->id)
                ->pluck('estabelecimento_id')
                ->toArray();
        }

        // Mapeia quais Provedores/Wallets pertencem a esses estabelecimentos
        $providersPermitidos = DB::table('providers')
            ->join('estabelecimento_usuario', 'providers.user_id', '=', 'estabelecimento_usuario.usuario_id')
            ->whereIn('estabelecimento_usuario.estabelecimento_id', $estabelecimentosPermitidos)
            ->pluck('providers.id')
            ->toArray();

        // 2. Criação da Query base do Extrato com relacionamentos adiantados (Eager Loading)
        $query = ExtratoProvider::with(['usuario'])
            ->whereIn('provider_id', $providersPermitidos);

        // --- APLICAÇÃO DOS FILTROS DA TELA ---
        if ($request->filled('data_inicio') && $request->filled('data_fim')) {
            $query->whereBetween('created_at', [
                Carbon::parse($request->data_inicio)->startOfDay(),
                Carbon::parse($request->data_fim)->endOfDay()
            ]);
        }

        if ($request->filled('estabelecimento_id') && $request->estabelecimento_id !== 'todos') {
            // Filtra os provedores pertencentes especificamente ao estabelecimento selecionado
            $providersDoFiltro = DB::table('providers')
                ->join('estabelecimento_usuario', 'providers.user_id', '=', 'estabelecimento_usuario.usuario_id')
                ->where('estabelecimento_usuario.estabelecimento_id', $request->estabelecimento_id)
                ->pluck('providers.id')
                ->toArray();

            $query->whereIn('provider_id', $providersDoFiltro);
        }

        if ($request->filled('tipo') && $request->tipo !== 'todos') {
            $query->where('tipo', $request->tipo);
        }

        if ($request->filled('metodo_pagamento') && $request->metodo_pagamento !== 'todos') {
            $query->where('metodo_pagamento', $request->metodo_pagamento);
        }

        // Clonamos a query para calcular os indicadores consolidados antes de paginar os registros
        $queryParaCards = clone $query;

        // Clonamos novamente para obter os dados de agrupamento dos gráficos (Donut)
        $queryParaGraficos = clone $query;

        // Paginação das movimentações (10 por página igual à imagem)
        $extratoPaginado = $query->latest()->paginate(10)->withQueryString();

        // 3. CÁLCULO DOS INDICADORES FINANCEIROS (KPIs)
        $receitaTotal = $queryParaCards->where('tipo', 'credito')->sum('valor_bruto');
        $despesasTotais = $queryParaCards->where('tipo', 'credito')->sum('taxa_plataforma') + abs($queryParaCards->where('tipo', 'estorno')->sum('valor_liquido'));
        $lucroLiquido = $receitaTotal - $despesasTotais;
        $totalTransacoes = $queryParaCards->where('tipo', 'credito')->count();
        $ticketMedio = $totalTransacoes > 0 ? ($receitaTotal / $totalTransacoes) : 0;

        // 4. ALIMENTAÇÃO DINÂMICA DOS COMPONENTES DE FILTRO DO FRONT-END
        $estabelecimentosFiltro = Estabelecimento::whereIn('id', $estabelecimentosPermitidos)->get(['id', 'nome']);
        $funcionariosFiltro = Funcionario::whereIn('estabelecimento_id', $estabelecimentosPermitidos)->get(['id', 'nome']);

        // 5. PROCESSAMENTO DE DADOS PARA OS GRÁFICOS (Agrupamentos)
        $receitasPorFormaPgto = $queryParaGraficos->where('tipo', 'credito')
            ->select('metodo_pagamento', DB::raw('SUM(valor_bruto) as total'))
            ->groupBy('metodo_pagamento')
            ->get();

        // Alterado o caminho do render para a pasta correta (resources/js/Pages/Estabelecimentos/DashboardFinanceiro.tsx)
        return Inertia::render('Estabelecimentos/DashboardFinanceiro', [
            'extrato' => $extratoPaginado,
            'resumoCards' => [
                'receita_total'    => number_format($receitaTotal, 2, ',', '.'),
                'despesas_totais'  => number_format($despesasTotais, 2, ',', '.'),
                'lucro_liquido'    => number_format($lucroLiquido, 2, ',', '.'),
                'transacoes_count' => $totalTransacoes,
                'ticket_medio'     => number_format($ticketMedio, 2, ',', '.'),
            ],
            'filtrosDados' => [
                'estabelecimentos' => $estabelecimentosFiltro,
                'funcionarios'     => $funcionariosFiltro,
            ],
            'dadosGraficos' => [
                'formas_pagamento' => $receitasPorFormaPgto
            ]
        ]);
    }

    /**
     * 3. EXPORTAR HISTÓRICO FINANCEIRO (Suporta downloads em CSV)
     */
    public function exportar(Request $request)
    {
        $user = Auth::user();

        if ($user->papel === 'admin') {
            $estabelecimentosPermitidos = Estabelecimento::pluck('id')->toArray();
        } else {
            $estabelecimentosPermitidos = DB::table('estabelecimento_usuario')->where('usuario_id', $user->id)->pluck('estabelecimento_id')->toArray();
        }

        $providersPermitidos = DB::table('providers')
            ->join('estabelecimento_usuario', 'providers.user_id', '=', 'estabelecimento_usuario.usuario_id')
            ->whereIn('estabelecimento_usuario.estabelecimento_id', $estabelecimentosPermitidos)
            ->pluck('providers.id')
            ->toArray();

        $fileName = 'extrato_financeiro_' . date('Y-m-d') . '.csv';
        
        $movimentacoes = ExtratoProvider::with('usuario')
            ->whereIn('provider_id', $providersPermitidos)
            ->latest()
            ->get();

        $headers = [
            "Content-type"        => "text/csv; charset=UTF-8",
            "Content-Disposition" => "attachment; filename=$fileName",
            "Pragma"              => "no-cache",
            "Cache-Control"       => "must-revalidate, post-check=0, pre-check=0",
            "Expires"             => "0"
        ];

        $columns = ['Data', 'Tipo', 'Descricao', 'Cliente', 'Valor Bruto', 'Taxa Plataforma', 'Valor Liquido', 'Status', 'Metodo Pagamento'];

        $callback = function() use($movimentacoes, $columns) {
            $file = fopen('php://output', 'w');
            // Insere o BOM para o Excel ler acentuações em UTF-8 perfeitamente
            fprintf($file, chr(0xEF).chr(0xBB).chr(0xBF));
            fputcsv($file, $columns, ';');

            foreach ($movimentacoes as $row) {
                fputcsv($file, [
                    $row->created_at->format('d/m/Y H:i'),
                    ucfirst($row->tipo),
                    $row->descricao,
                    $row->usuario->name ?? 'N/A',
                    'R$ ' . number_format($row->valor_bruto, 2, ',', '.'),
                    'R$ ' . number_format($row->taxa_plataforma, 2, ',', '.'),
                    'R$ ' . number_format($row->valor_liquido, 2, ',', '.'),
                    ucfirst($row->status),
                    strtoupper($row->metodo_pagamento)
                ], ';');
            }

            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }
}