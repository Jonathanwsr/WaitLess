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
        // Certifique-se de que o caminho da string bate com a estrutura de pastas do seu React.
        // Ex: resources/js/Pages/Estabelecimentos/Create.jsx
        return Inertia::render('Estabelecimentos/Create');
    }

    /**
     * Salva o novo estabelecimento no banco de dados.
     */
   public function store(Request $request)
    {
        // 1. Limpando as máscaras (deixando apenas números para o banco de dados)
        if ($request->filled('cnpj')) {
            $request->merge(['cnpj' => preg_replace('/[^0-9]/', '', $request->cnpj)]);
        }
        if ($request->filled('cep')) {
            $request->merge(['cep' => preg_replace('/[^0-9]/', '', $request->cep)]);
        }
        if ($request->filled('telefone')) {
            $request->merge(['telefone' => preg_replace('/[^0-9]/', '', $request->telefone)]);
        }

        // 2. Validação dos dados (agora com as fotos e tamanhos limpos)
        $validated = $request->validate([
            'nome'         => 'required|string|max:255',
            'razao_social' => 'nullable|string|max:255',
            'cnpj'         => 'nullable|string|max:14', // Sem máscara, tem 14 dígitos
            'site'         => 'nullable|url|max:255',
            'ramo_atuacao' => 'nullable|string|max:255',
            'telefone'     => 'nullable|string|max:15', // Sem máscara
            'cep'          => 'nullable|string|max:8',  // Sem máscara, tem 8 dígitos
            'rua'          => 'nullable|string|max:255',
            'numero'       => 'nullable|string|max:50',
            'complemento'  => 'nullable|string|max:255',
            'bairro'       => 'nullable|string|max:255',
            'cidade'       => 'nullable|string|max:255',
            'estado'       => 'nullable|string|size:2',
            'latitude'     => 'nullable|numeric',
            'longitude'    => 'nullable|numeric',
            'foto_perfil'  => 'nullable|image|max:2048', // Validação da foto de perfil
            'foto_banner'  => 'nullable|image|max:4096', // Validação da foto de banner
        ], [
            'nome.required' => 'O nome do estabelecimento é obrigatório.',
            'site.url'      => 'O site deve ser um link válido (ex: https://site.com).',
            'estado.size'   => 'A UF do estado deve conter exatamente 2 letras.',
        ]);

        try {
            // 3. Upload das Fotos (se o usuário enviou na criação)
            if ($request->hasFile('foto_perfil')) {
                $validated['foto_perfil'] = ImageKitService::upload($request->file('foto_perfil'), '/waitless/estabelecimentos');
            }

            if ($request->hasFile('foto_banner')) {
                $validated['foto_banner'] = ImageKitService::upload($request->file('foto_banner'), '/waitless/estabelecimentos/banners');
            }

            // 4. Cria o registro no banco de dados
            $estabelecimento = Estabelecimento::create($validated);

            // 5. Vincula o estabelecimento ao usuário logado na tabela pivot (estabelecimento_usuario)
            // Passamos o tipo 'proprietario' para a coluna pivot 'tipo', baseando na sua model
            $estabelecimento->proprietarios()->attach(Auth::id(), ['tipo' => 'proprietario']);

            // 6. Redireciona para o dashboard com mensagem de sucesso
            return redirect()->route('dashboard')
                ->with('success', 'Estabelecimento cadastrado com sucesso!');

        } catch (\Exception $e) {
            // Loga o erro interno para você debugar depois
            \Log::error('Erro ao salvar estabelecimento: ' . $e->getMessage());

            return back()->with('error', 'Não foi possível cadastrar o estabelecimento devido a um erro no servidor. Verifique os dados e tente novamente.');
        }
    }



    public function update(Request $request, Estabelecimento $estabelecimento)
    {
        $validated = $request->validate([
            'nome'              => 'required|string|max:255',
            'cnpj'              => 'nullable|string|max:18',        // Novo campo
            'razao_social'      => 'nullable|string|max:255',       // Novo campo
            'site'              => 'nullable|url|max:255',          // Novo campo
            'ramo_atuacao'      => 'nullable|string|max:255',
            'telefone'          => 'nullable|string|max:20',
            'cep'               => 'nullable|string|max:10',  
            'rua'               => 'nullable|string|max:255',
            'numero'            => 'nullable|string|max:20',
            'complemento'       => 'nullable|string|max:255',
            'bairro'            => 'nullable|string|max:255',
            'cidade'            => 'nullable|string|max:255',
            'estado'            => 'nullable|string|size:2',
            'foto_perfil'       => 'nullable|image|max:2048', 
            'foto_banner'       => 'nullable|image|max:4096', 
            'token_mercadopago' => 'nullable|string', 
        ]);

        // Se o dono enviou uma foto de PERFIL nova na edição, fazemos o upload
        if ($request->hasFile('foto_perfil')) {
            $validated['foto_perfil'] = ImageKitService::upload($request->file('foto_perfil'), '/waitless/estabelecimentos');
        } else {
            // Se não enviou foto nova, removemos a chave do array para NÃO apagar a foto antiga do banco
            unset($validated['foto_perfil']); 
        }

        // Se o dono enviou um BANNER novo na edição, fazemos o upload
        if ($request->hasFile('foto_banner')) {
            $validated['foto_banner'] = ImageKitService::upload($request->file('foto_banner'), '/waitless/estabelecimentos/banners');
        } else {
            // Removemos a chave para NÃO apagar o banner antigo
            unset($validated['foto_banner']); 
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
                $query->whereDate('data_agendamento', '>=', now()->toDateString())
                      ->with(['usuario:id,name', 'funcionario:id,nome']); 
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

            $todasLojas = $query->get();
            
            $metricas = [
                'ativos'                  => $todasLojas->where('ativo', true)->count(),
                'faturamento'             => 'R$ ' . number_format((float) $todasLojas->sum('arrecadacao_total'), 2, ',', '.'),
                'crescimento_faturamento' => '+0%', 
                'aguardando'              => $todasLojas->sum('clientes_aguardando'),
                'funcionarios_ativos'     => 0 
            ];

            $estabelecimentos = $query->paginate(10)->through(function ($loja) {
                
                $enderecoPartes = array_filter([$loja->rua, $loja->numero, $loja->bairro, $loja->cidade, $loja->estado]);
                $enderecoFormatado = !empty($enderecoPartes) ? implode(', ', $enderecoPartes) : 'Endereço não informado';

                $totalFuncionarios = 0;
                try {
                    $totalFuncionarios = $loja->funcionarios()->count();
                } catch (\Exception $e) {
                    $totalFuncionarios = 0;
                }

                return [
                    'id'          => $loja->id,
                    'nome'        => $loja->nome,
                    'foto_perfil' => $loja->foto_perfil, 
                    'endereco'    => $enderecoFormatado,
                    'status'      => $loja->ativo ? 'Ativo' : 'Inativo',
                    'horario'     => '08:00 - 18:00', 
                    
                    'faturamento' => 'R$ ' . number_format((float) ($loja->arrecadacao_total ?? 0), 2, ',', '.'),
                    'aguardando'  => $loja->clientes_aguardando ?? 0,
                    
                    'funcionarios'=> $totalFuncionarios,
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
            \Log::error('Erro na tela Meus Estabelecimentos: ' . $e->getMessage());

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