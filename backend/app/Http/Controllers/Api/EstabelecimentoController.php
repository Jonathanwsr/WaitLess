<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Estabelecimento;
use Illuminate\Http\Request;
use App\Models\Agendamento;
use Illuminate\Support\Facades\Auth;
use App\Services\ImageKitService;
use Inertia\Inertia;

class EstabelecimentoController extends Controller
{
    public function create()
    {
        return Inertia::render('Estabelecimentos/Create');
    }

    public function store(Request $request)
    {
        $user = Auth::user();

        if (!in_array($user->papel, ['admin', 'socio', 'gerente'])) {
            abort(403, 'Acesso negado. Apenas administradores, sócios ou gerentes podem criar um estabelecimento.');
        }

        $validated = $request->validate([
            'nome'         => 'required|string|max:255',
            'ramo_atuacao' => 'nullable|string|max:255',
            'telefone'     => 'nullable|string|max:20',
            'cep'          => 'nullable|string|max:10',  
            'rua'          => 'nullable|string|max:255',
            'numero'       => 'nullable|string|max:20',
            'complemento'  => 'nullable|string|max:255',
            'bairro'       => 'nullable|string|max:255',
            'cidade'       => 'nullable|string|max:255',
            'estado'       => 'nullable|string|size:2',  
            'foto_perfil'  => 'nullable|image|max:2048', 
            'ativo'        => 'nullable|boolean',
        ]);

       
        if ($request->hasFile('foto_perfil')) {
            $validated['foto_perfil'] = ImageKitService::upload($request->file('foto_perfil'), '/waitless/estabelecimentos');
        } else {
            $validated['foto_perfil'] = null; 
        }

        $estabelecimento = Estabelecimento::create($validated);

        $estabelecimento->proprietarios()->attach($user->id, [
            'tipo' => $user->papel 
        ]);
        
        return redirect()->route('dashboard')->with('success', 'Estabelecimento criado com sucesso!');
    }
    
    public function update(Request $request, Estabelecimento $estabelecimento)
    {
        $validated = $request->validate([
            'nome'              => 'required|string|max:255',
            'ramo_atuacao'      => 'nullable|string|max:255',
            'telefone'          => 'nullable|string|max:20',
            'cep'               => 'nullable|string|max:10',  
            'rua'               => 'nullable|string|max:255',
            'numero'            => 'nullable|string|max:20',
            'complemento'       => 'nullable|string|max:255',
            'bairro'            => 'nullable|string|max:255',
            'cidade'            => 'nullable|string|max:255',
            'estado'            => 'nullable|string|size:2',
            'foto_perfil'       => 'nullable|image|max:2048', // Validando a imagem
            'token_mercadopago' => 'nullable|string', 
        ]);

        // Se o dono enviou uma foto nova na edição, fazemos o upload
        if ($request->hasFile('foto_perfil')) {
            $validated['foto_perfil'] = ImageKitService::upload($request->file('foto_perfil'), '/waitless/estabelecimentos');
        } else {
            // Se não enviou foto nova, removemos a chave do array para NÃO apagar a foto antiga do banco
            unset($validated['foto_perfil']); 
        }

        $estabelecimento->update($validated);
        
        return redirect()->back()->with('success', 'Configurações atualizadas com sucesso!');
    }

    public function toggleStatus(Estabelecimento $estabelecimento)
    {
        $estabelecimento->update(['ativo' => !$estabelecimento->ativo]);
        
        $mensagem = $estabelecimento->ativo ? 'Estabelecimento reativado!' : 'Estabelecimento desativado temporariamente.';
        return redirect()->back()->with('success', $mensagem);
    }

     public function fila(Request $request, Estabelecimento $estabelecimento)
{
    // 1. Validação de segurança: Garante que o estabelecimento pertence ao usuário logado
    if ($estabelecimento->user_id !== \Illuminate\Support\Facades\Auth::id()) {
        abort(403, 'Acesso não autorizado.');
    }

    // 2. Capturar as datas vinda do Front-end (React) ou usar o dia atual como padrão
    $hoje = \Carbon\Carbon::today()->toDateString();
    
    $filtros = [
        'data_inicio'      => $request->input('data_inicio', $hoje),
        'data_fim'         => $request->input('data_fim', $hoje),
        'ordem'            => $request->input('ordem', 'asc'),
        'status'           => $request->input('status', 'todos'),
        'status_pagamento' => $request->input('status_pagamento', 'todos'),
        'per_page'         => $request->input('per_page', 10),
    ];

    // 3. Buscar TODOS os estabelecimentos do lojista para alimentar o seletor do topo
    $estabelecimentos = \Illuminate\Support\Facades\Auth::user()->estabelecimentos()->get();

    // 4. Buscar os profissionais cadastrados para ESTE estabelecimento atual
    $funcionarios = \App\Models\Funcionario::select('id', 'nome', 'cargo')
        ->where('estabelecimento_id', $estabelecimento->id)
        ->get();

    // 5. Construir a Query Principal filtrando pelo intervalo correto de datas (whereBetween)
    $query = Agendamento::with(['usuario:id,name', 'servico:id,nome,valor', 'pagamento:id,agendamento_id,status'])
        ->where('estabelecimento_id', $estabelecimento->id)
        ->whereBetween('data_agendamento', [$filtros['data_inicio'], $filtros['data_fim']]);

    // 6. Aplicar filtro por Status do Atendimento
    if ($filtros['status'] !== 'todos') {
        $query->where('status', $filtros['status']);
    }

    // 7. Aplicar filtro por Status do Pagamento 
    // CORREÇÃO POSTGRESQL: Para contornar a incompatibilidade de tipos (VARCHAR vs BIGINT)
    // na chave de relacionamento, usamos um whereExists com conversão explícita (::text)
    if ($filtros['status_pagamento'] !== 'todos') {
        $query->whereExists(function ($subQuery) use ($filtros) {
            $subQuery->select(\Illuminate\Support\Facades\DB::raw(1))
                ->from('pagamentos')
                ->whereRaw('pagamentos.id::text = agendamentos.pagamento_id::text')
                ->where('pagamentos.status', (string) $filtros['status_pagamento']);
        });
    }

    // 8. Aplicar Ordenação da fila por Data e por Horário
    $direcao = $filtros['ordem'] === 'desc' ? 'desc' : 'asc';
    $query->orderBy('data_agendamento', $direcao)
          ->orderBy('hora_agendamento', $direcao);

    // 9. Paginar os resultados mantendo os parâmetros na URL
    $agendamentos = $query->paginate($filtros['per_page'])->withQueryString();

    // 10. Retornar os dados estruturados para a View do Inertia
    return \Inertia\Inertia::render('Estabelecimentos/Fila', [
        'estabelecimento'  => $estabelecimento->only(['id', 'nome']),
        'estabelecimentos' => $estabelecimentos, 
        'agendamentos'     => $agendamentos,
        'funcionarios'     => $funcionarios,     
        'filtros'          => $filtros
    ]);
}

    public function configuracoes(Estabelecimento $estabelecimento)
    {
        $user = Auth::user();
        $meusEstabelecimentos = $user->estabelecimentosGerenciados()->select('estabelecimentos.id', 'nome', 'ativo', 'token_mercadopago')->get();
        $funcionarios = $estabelecimento->funcionarios()->select('id', 'nome', 'cargo', 'usuario_id', 'telefone', 'ativo')->get();
        $servicos = $estabelecimento->servicos()->latest()->get();

        return Inertia::render('Estabelecimentos/Configuracoes', [
            'estabelecimento'      => $estabelecimento,
            'meusEstabelecimentos' => $meusEstabelecimentos,
            'funcionarios'         => $funcionarios,
            'servicos'             => $servicos
        ]);
    }

     public function loja(Estabelecimento $estabelecimento)
    {
        
        $user = \Illuminate\Support\Facades\Auth::user();
        
        
        $servicos = $estabelecimento->servicos()
            ->with(['agendamentos' => function ($query) {
                // Traz apenas agendamentos de hoje para frente
                $query->whereDate('data_agendamento', '>=', now()->toDateString())
                      ->with(['usuario:id,name', 'funcionario:id,nome']); // Traz o nome do cliente e do funcionário
            }])
            ->paginate(12);

        return Inertia::render('Estabelecimentos/Loja', [
            'estabelecimento' => $estabelecimento,
            'servicosPaginados' => $servicos
        ]);
    }


    public function cupons(Estabelecimento $estabelecimento)
    {
        $cupons = $estabelecimento->cupons()->latest()->get();
        
        return Inertia::render('Estabelecimentos/Cupons', [
            'estabelecimento' => $estabelecimento,
            'cupons' => $cupons
        ]);
    }


 public function index(Request $request)
    {
        try {
            $user = Auth::user();

            // Inicia a query baseada na relação do usuário com os estabelecimentos
            $query = $user->estabelecimentosGerenciados();

            // --- FILTROS ---
            if ($request->filled('busca')) {
                $query->where('nome', 'like', '%' . $request->busca . '%')
                      ->orWhere('cidade', 'like', '%' . $request->busca . '%');
            }

            if ($request->filled('status') && $request->status !== 'Todos os status') {
                $ativo = $request->status === 'Ativos' ? 1 : 0;
                $query->where('ativo', $ativo);
            }

            // Puxa todos os estabelecimentos do usuário para calcular as métricas GLOBAIS do topo da tela
            $todasLojas = $query->get();
            
            $metricas = [
                'ativos'                  => $todasLojas->where('ativo', true)->count(),
                // Puxa direto da coluna arrecadacao_total do banco
                'faturamento'             => 'R$ ' . number_format((float) $todasLojas->sum('arrecadacao_total'), 2, ',', '.'),
                'crescimento_faturamento' => '+0%', // Ajuste futuramente para comparar com o dia anterior
                // Puxa direto da coluna clientes_aguardando do banco
                'aguardando'              => $todasLojas->sum('clientes_aguardando'),
                'funcionarios_ativos'     => 0 // Ajuste caso tenha a tabela/relação de funcionários depois
            ];

            // Faz a paginação e mapeia os dados EXATAMENTE com as colunas do seu banco
            $estabelecimentos = $query->paginate(10)->through(function ($loja) {
                
                // Formatação limpa do endereço (junta as colunas caso existam)
                $enderecoPartes = array_filter([$loja->rua, $loja->numero, $loja->bairro, $loja->cidade, $loja->estado]);
                $enderecoFormatado = !empty($enderecoPartes) ? implode(', ', $enderecoPartes) : 'Endereço não informado';

                // Tenta puxar a quantidade de funcionários. Se o relacionamento não existir ainda, ele retorna 0 sem quebrar a tela.
                $totalFuncionarios = 0;
                try {
                    $totalFuncionarios = $loja->funcionarios()->count();
                } catch (\Exception $e) {
                    $totalFuncionarios = 0;
                }

                return [
                    'id'          => $loja->id,
                    'nome'        => $loja->nome,
                    // A URL do ImageKit vem diretamente desta coluna do banco
                    'foto_perfil' => $loja->foto_perfil, 
                    'endereco'    => $enderecoFormatado,
                    'status'      => $loja->ativo ? 'Ativo' : 'Inativo',
                    'horario'     => '08:00 - 18:00', // Fixo provisoriamente
                    
                    // Lendo as colunas exatas que estão na sua tabela
                    'faturamento' => 'R$ ' . number_format((float) ($loja->arrecadacao_total ?? 0), 2, ',', '.'),
                    'aguardando'  => $loja->clientes_aguardando ?? 0,
                    
                    'funcionarios'=> $totalFuncionarios,
                    // Dados para o Modal (Olho)
                    'funcionarios_ativos'      => $totalFuncionarios,
                    'funcionarios_trabalhando' => $totalFuncionarios,
                ];
            });

            return Inertia::render('Estabelecimentos/MeusEstabelecimentos', [
                'estabelecimentos' => $estabelecimentos,
                'metricas'         => $metricas,
                'filtros'          => $request->only(['busca', 'status'])
            ]);

        } catch (\Exception $e) {
            // Em caso de falha (banco fora, erro de sintaxe, coluna faltando), 
            // Registramos o erro no log para você (desenvolvedor) ver
            \Log::error('Erro na tela Meus Estabelecimentos: ' . $e->getMessage());

            // E retornamos a tela de forma HUMANIZADA, com tudo zerado para o usuário não tomar um susto (Error 500)
            return Inertia::render('Estabelecimentos/MeusEstabelecimentos', [
                'estabelecimentos' => ['data' => []],
                'metricas' => [
                    'ativos' => 0,
                    'faturamento' => 'R$ 0,00',
                    'crescimento_faturamento' => '0%',
                    'aguardando' => 0,
                    'funcionarios_ativos' => 0
                ],
                
                'flash' => [
                    'error' => 'Tivemos um problema técnico ao carregar os dados. Tente atualizar a página.'
                ]
            ]);
        }
    }
}