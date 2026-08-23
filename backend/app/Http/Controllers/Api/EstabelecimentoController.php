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
        if ($request->filled('cnpj')) {
            $request->merge(['cnpj' => preg_replace('/[^0-9]/', '', $request->cnpj)]);
        }
        if ($request->filled('cep')) {
            $request->merge(['cep' => preg_replace('/[^0-9]/', '', $request->cep)]);
        }
        if ($request->filled('telefone')) {
            $request->merge(['telefone' => preg_replace('/[^0-9]/', '', $request->telefone)]);
        }

        $validated = $request->validate([
            'nome'         => 'required|string|max:255',
            'razao_social' => 'nullable|string|max:255',
            'cnpj'         => 'nullable|string|max:14',
            'site'         => 'nullable|url|max:255',
            'ramo_atuacao' => 'nullable|string|max:255',
            'telefone'     => 'nullable|string|max:15',
            'cep'          => 'nullable|string|max:8',
            'rua'          => 'nullable|string|max:255',
            'numero'       => 'nullable|string|max:50',
            'complemento'  => 'nullable|string|max:255',
            'bairro'       => 'nullable|string|max:255',
            'cidade'       => 'nullable|string|max:255',
            'estado'       => 'nullable|string|size:2',
            'latitude'     => 'nullable|numeric',
            'longitude'    => 'nullable|numeric',
            'foto_perfil'  => 'nullable|image|max:2048',
            'foto_banner'  => 'nullable|image|max:4096',
            'bio'          => 'nullable|string|max:1000', // Nova coluna
            'seguidores'   => 'nullable|integer|min:0',   // Nova coluna
        ], [
            'nome.required' => 'O nome do estabelecimento é obrigatório.',
            'site.url'      => 'O site deve ser um link válido.',
            'estado.size'   => 'A UF do estado deve conter exatamente 2 letras.',
        ]);

        try {
            if ($request->hasFile('foto_perfil')) {
                $validated['foto_perfil'] = ImageKitService::upload($request->file('foto_perfil'), '/waitless/estabelecimentos');
            }

            if ($request->hasFile('foto_banner')) {
                $validated['foto_banner'] = ImageKitService::upload($request->file('foto_banner'), '/waitless/estabelecimentos/banners');
            }

            $estabelecimento = Estabelecimento::create($validated);
            $estabelecimento->proprietarios()->attach(Auth::id(), ['tipo' => 'proprietario']);

            return redirect()->route('dashboard')
                ->with('success', 'Estabelecimento cadastrado com sucesso!');

        } catch (\Exception $e) {
            \Log::error('Erro ao salvar estabelecimento: ' . $e->getMessage());
            return back()->with('error', 'Erro no servidor. Tente novamente.');
        }
    }

    public function update(Request $request, Estabelecimento $estabelecimento)
    {
        $validated = $request->validate([
            'nome'              => 'required|string|max:255',
            'cnpj'              => 'nullable|string|max:18',
            'razao_social'      => 'nullable|string|max:255',
            'site'              => 'nullable|url|max:255',
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
            'bio'               => 'nullable|string|max:1000', // Nova coluna
            'seguidores'        => 'nullable|integer|min:0',   // Nova coluna
        ]);

        if ($request->hasFile('foto_perfil')) {
            $validated['foto_perfil'] = ImageKitService::upload($request->file('foto_perfil'), '/waitless/estabelecimentos');
        } else {
            unset($validated['foto_perfil']); 
        }

        if ($request->hasFile('foto_banner')) {
            $validated['foto_banner'] = ImageKitService::upload($request->file('foto_banner'), '/waitless/estabelecimentos/banners');
        } else {
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
        $user = Auth::user();

        // 1. Liberação de acesso por papel
        if (!in_array($user->papel, ['admin', 'socio', 'gerente', 'proprietario', 'funcionario', 'atendente'])) {
            abort(403, 'Acesso não autorizado. Papel inválido.');
        }

        // 2. Validação se o usuário tem vínculo com ESTE estabelecimento (ignora se for admin)
        if ($user->papel !== 'admin') {
            $isLinked = false;
            
            if (in_array($user->papel, ['proprietario', 'socio', 'gerente'])) {
                // É dono ou tem vínculo na pivot
                $isLinked = $estabelecimento->user_id === $user->id || $estabelecimento->proprietarios()->where('user_id', $user->id)->exists();
            } else {
                // É funcionário/atendente deste local
                $isLinked = \App\Models\Funcionario::where('user_id', $user->id)->where('estabelecimento_id', $estabelecimento->id)->exists();
            }

            if (!$isLinked) {
                abort(403, 'Você não tem permissão para acessar a fila deste estabelecimento específico.');
            }
        }

        $hoje = \Carbon\Carbon::today()->toDateString();
        
        $filtros = [
            'data_inicio'      => $request->input('data_inicio', $hoje),
            'data_fim'         => $request->input('data_fim', $hoje),
            'ordem'            => $request->input('ordem', 'asc'),
            'status'           => $request->input('status', 'todos'),
            'status_pagamento' => $request->input('status_pagamento', 'todos'),
            'per_page'         => $request->input('per_page', 10),
        ];

        // 3. Busca a lista de estabelecimentos do menu (trata a diferença de dono vs atendente)
        if (in_array($user->papel, ['atendente', 'funcionario'])) {
            $est_id_vinculado = \App\Models\Funcionario::where('user_id', $user->id)->value('estabelecimento_id');
            $estabelecimentos = $est_id_vinculado ? Estabelecimento::where('id', $est_id_vinculado)->get() : collect();
        } else {
            $estabelecimentos = $user->estabelecimentos()->get();
        }

        // 4. Aplica ImageKit no estabelecimento atual e na lista
        $imageKitBaseUrl = env('IMAGEKIT_URL', 'https://ik.imagekit.io/seu_id');
        
        $estabelecimentos->transform(function ($est) use ($imageKitBaseUrl) {
            $est->foto_perfil_url = !empty($est->foto_perfil) ? rtrim($imageKitBaseUrl, '/') . '/' . ltrim($est->foto_perfil, '/') : null;
            return $est;
        });

        // Prepara os dados do estabelecimento atual que vão pro frontend
        $estabelecimentoAtual = $estabelecimento->only(['id', 'nome', 'foto_perfil']);
        $estabelecimentoAtual['foto_perfil_url'] = !empty($estabelecimentoAtual['foto_perfil']) 
            ? rtrim($imageKitBaseUrl, '/') . '/' . ltrim($estabelecimentoAtual['foto_perfil'], '/') 
            : null;

        $funcionarios = \App\Models\Funcionario::select('id', 'nome', 'cargo')
            ->where('estabelecimento_id', $estabelecimento->id)
            ->get();

        $query = Agendamento::with(['usuario:id,name,foto_perfil', 'servico:id,nome,valor', 'pagamento:id,agendamento_id,status'])
            ->where('estabelecimento_id', $estabelecimento->id)
            ->whereBetween('data_agendamento', [$filtros['data_inicio'], $filtros['data_fim']]);

        if ($filtros['status'] !== 'todos') {
            $query->where('status', $filtros['status']);
        }

        if ($filtros['status_pagamento'] !== 'todos') {
            $query->whereExists(function ($subQuery) use ($filtros) {
                $subQuery->select(\Illuminate\Support\Facades\DB::raw(1))
                    ->from('pagamentos')
                    ->whereRaw('pagamentos.id::text = agendamentos.pagamento_id::text')
                    ->where('pagamentos.status', (string) $filtros['status_pagamento']);
            });
        }

        $direcao = $filtros['ordem'] === 'desc' ? 'desc' : 'asc';
        $query->orderBy('data_agendamento', $direcao)
              ->orderBy('hora_agendamento', $direcao);

        $agendamentos = $query->paginate($filtros['per_page'])->withQueryString();

        return \Inertia\Inertia::render('Estabelecimentos/Fila', [
            'estabelecimento'  => $estabelecimentoAtual,
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

                // Aplica o ImageKit aqui também para a lista
                $imageKitBaseUrl = env('IMAGEKIT_URL', 'https://ik.imagekit.io/seu_id');
                $fotoPerfilUrl = !empty($loja->foto_perfil) ? rtrim($imageKitBaseUrl, '/') . '/' . ltrim($loja->foto_perfil, '/') : null;

                return [
                    'id'          => $loja->id,
                    'nome'        => $loja->nome,
                    'foto_perfil' => $loja->foto_perfil, 
                    'foto_perfil_url' => $fotoPerfilUrl,
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
                    'ativos' => 0, 'faturamento' => 'R$ 0,00', 'crescimento_faturamento' => '0%',
                    'aguardando' => 0, 'funcionarios_ativos' => 0
                ],
                'flash' => ['error' => 'Problema ao carregar dados. Tente atualizar.']
            ]);
        }
    }
}