<?php

namespace App\Http\Controllers\Api;

use Illuminate\Support\Facades\DB;

use App\Http\Controllers\Controller;
use App\Models\Estabelecimento;
use Illuminate\Http\Request;
use App\Models\Agendamento;
use App\Models\Produto;
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

    /**
     * Sem isso, `update()` e `toggleStatus()` não checavam dono nenhum —
     * qualquer usuário autenticado podia editar o perfil de QUALQUER
     * estabelecimento (inclusive sobrescrever o token_mercadopago, o que
     * redirecionaria os pagamentos daquele negócio pro atacante) ou
     * desativá-lo por completo.
     */
    private function garantirQueGerencia(Request $request, Estabelecimento $estabelecimento): void
    {
        $user = $request->user();
        $gerencia = $user->papel === 'admin'
            || $user->estabelecimentos()->where('estabelecimentos.id', $estabelecimento->id)->exists();

        abort_unless($gerencia, 403, 'Você não administra este estabelecimento.');
    }

    public function update(Request $request, Estabelecimento $estabelecimento)
    {
        $this->garantirQueGerencia($request, $estabelecimento);

        if ($request->filled('site') && !preg_match('#^https?://#i', trim((string) $request->input('site')))) {
            $request->merge(['site' => 'https://' . ltrim(trim((string) $request->input('site')), '/')]);
        }

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
            // A foto antiga nunca era removida do ImageKit ao trocar — ficava
            // órfã lá pra sempre toda vez que o sócio atualizava o logo.
            $fotoPerfilAntiga = $estabelecimento->foto_perfil;
            $validated['foto_perfil'] = ImageKitService::upload($request->file('foto_perfil'), '/waitless/estabelecimentos');
            if ($fotoPerfilAntiga) {
                ImageKitService::delete($fotoPerfilAntiga);
            }
        } else {
            unset($validated['foto_perfil']);
        }

        if ($request->hasFile('foto_banner')) {
            $fotoBannerAntiga = $estabelecimento->foto_banner;
            $validated['foto_banner'] = ImageKitService::upload($request->file('foto_banner'), '/waitless/estabelecimentos/banners');
            if ($fotoBannerAntiga) {
                ImageKitService::delete($fotoBannerAntiga);
            }
        } else {
            unset($validated['foto_banner']);
        }

        $estabelecimento->update($validated);

        return redirect()->back()->with('success', 'Configurações atualizadas com sucesso!');
    }

    public function toggleStatus(Request $request, Estabelecimento $estabelecimento)
    {
        $this->garantirQueGerencia($request, $estabelecimento);

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
                $isLinked = $estabelecimento->proprietarios()->where('users.id', $user->id)->exists();
            } else {
                // É funcionário/atendente deste local
                $isLinked = \App\Models\Funcionario::where('usuario_id', $user->id)
                    ->where('estabelecimento_id', $estabelecimento->id)
                    ->exists();
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
            $est_id_vinculado = \App\Models\Funcionario::where('usuario_id', $user->id)->value('estabelecimento_id');
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

        $query = Agendamento::with(['usuario:id,name,foto_perfil', 'servico:id,nome,valor', 'pagamento:id,agendamento_id,status', 'finalizadoPor:id,name'])
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
        $produtos = Produto::where('estabelecimento_id', $estabelecimento->id)
            ->select('id', 'nome', 'servico_id', 'aluguel_id', 'somente_premium', 'is_promocao', 'valor_final')
            ->orderBy('nome')
            ->get();
        $horariosFuncionamento = $estabelecimento->horariosFuncionamento()->get();

        return Inertia::render('Estabelecimentos/Configuracoes', [
            'estabelecimento'      => $estabelecimento,
            'meusEstabelecimentos' => $meusEstabelecimentos,
            'funcionarios'         => $funcionarios,
            'horariosFuncionamento' => $horariosFuncionamento,
            'servicos'             => $servicos,
            'produtos'             => $produtos,
            'categoriasServicos'   => \App\Support\Categorias::servicos(),
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

        // Reservas cadastradas neste local (hospedagens, veículos, equipamentos, espaços).
        $reservas = \App\Models\ItemAluguel::catalogo()->doLocal($estabelecimento->id)
            ->where('ativo', true)->orderBy('nome')->get()
            ->map(fn ($i) => [
                'id' => $i->id,
                'nome' => $i->nome,
                'categoria' => $i->categoria,
                'foto' => $i->foto_principal,
                'valor_diaria' => (float) $i->valor_diaria,
                'preco_final' => app(\App\Services\PrecificacaoService::class)->comPromocao((float) $i->valor_diaria, (bool) $i->tem_promocao, $i->tipo_desconto, $i->valor_desconto),
                'capacidade_pessoas' => $i->capacidade_pessoas,
                'unidade' => in_array($i->categoria, \App\Services\Viagem\CrossSellViagemService::CATEGORIAS_HOSPEDAGEM, true) ? 'noite' : 'dia',
            ]);

        return Inertia::render('Estabelecimentos/Loja', [
            'estabelecimento' => $estabelecimento,
            'servicosPaginados' => $servicos,
            'reservas' => $reservas,
            'statusFuncionamento' => \App\Support\StatusFuncionamento::de($estabelecimento->horariosFuncionamento()->get()),
            'produtosVendidos' => $estabelecimento->produtosVendidos(),
        ]);
    }

    public function cupons(Estabelecimento $estabelecimento)
    {
        $cupons = $estabelecimento->cupons()->with(['servico:id,nome', 'itemAluguel:id,nome'])->latest()->get();

        return Inertia::render('Estabelecimentos/Cupons', [
            'estabelecimento' => $estabelecimento,
            'cupons' => $cupons,
            'servicos' => $estabelecimento->servicos()->where('ativo', true)->orderBy('nome')->get(['id', 'nome']),
            'reservas' => \App\Models\ItemAluguel::catalogo()->doLocal($estabelecimento->id)->orderBy('nome')->get(['id', 'nome']),
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
            $ids = $todasLojas->pluck('id');

            // Números reais de hoje e de ontem por local (faturamento, fila e equipe).
            $fuso = 'America/Sao_Paulo';
            $hoje = now($fuso)->toDateString();
            $ontem = now($fuso)->subDay()->toDateString();
            $faturamentoDoDia = function (string $dia) use ($ids) {
                $online = DB::table('pagamentos')
                    ->whereIn('estabelecimento_id', $ids)
                    ->whereIn('status', ['pago', 'confirmado'])
                    ->whereRaw('DATE(COALESCE(data_pagamento, created_at)) = ?', [$dia])
                    ->selectRaw('estabelecimento_id, SUM(COALESCE(NULLIF(valor_total, 0), valor)) as total')
                    ->groupBy('estabelecimento_id')
                    ->pluck('total', 'estabelecimento_id');
                $noLocal = DB::table('agendamentos')
                    ->whereIn('estabelecimento_id', $ids)
                    ->where('status', 'finalizado')
                    ->whereIn('status_pagamento', ['presencial', 'local', 'pago_presencial'])
                    ->whereDate('data_agendamento', $dia)
                    ->selectRaw('estabelecimento_id, SUM(valor_final) as total')
                    ->groupBy('estabelecimento_id')
                    ->pluck('total', 'estabelecimento_id');

                return $ids->mapWithKeys(fn ($id) => [$id => (float) ($online[$id] ?? 0) + (float) ($noLocal[$id] ?? 0)]);
            };
            $fatHoje = $faturamentoDoDia($hoje);
            $fatOntem = $faturamentoDoDia($ontem);
            $aguardando = DB::table('agendamentos')
                ->whereIn('estabelecimento_id', $ids)
                ->whereDate('data_agendamento', $hoje)
                ->whereIn('status', ['pendente', 'confirmado'])
                ->selectRaw('estabelecimento_id, COUNT(*) as total')
                ->groupBy('estabelecimento_id')
                ->pluck('total', 'estabelecimento_id');
            $equipe = DB::table('funcionarios')
                ->whereIn('estabelecimento_id', $ids)
                ->selectRaw('estabelecimento_id, COUNT(*) as total, SUM(CASE WHEN ativo THEN 1 ELSE 0 END) as ativos')
                ->groupBy('estabelecimento_id')
                ->get()->keyBy('estabelecimento_id');
            $diaSemana = now($fuso)->dayOfWeek;
            $horarios = DB::table('horarios_funcionamento')
                ->whereIn('estabelecimento_id', $ids)
                ->where('dia_semana', $diaSemana)
                ->get()->keyBy('estabelecimento_id');

            $variacao = function (float $atual, float $anterior): ?float {
                if ($anterior <= 0) {
                    return $atual > 0 ? null : 0.0;
                }

                return round(($atual - $anterior) / $anterior * 100, 1);
            };
            $brl = fn (float $v) => 'R$ ' . number_format($v, 2, ',', '.');

            $totalHoje = (float) $fatHoje->sum();
            $metricas = [
                'ativos'                  => $todasLojas->where('ativo', true)->count(),
                'total'                   => $todasLojas->count(),
                'faturamento'             => $brl($totalHoje),
                'variacao_faturamento'    => $variacao($totalHoje, (float) $fatOntem->sum()),
                'aguardando'              => (int) $aguardando->sum(),
                'funcionarios_ativos'     => (int) $equipe->sum('ativos'),
            ];

            $estabelecimentos = $query->paginate(10)->through(function ($loja) use ($fatHoje, $fatOntem, $aguardando, $equipe, $horarios, $variacao, $brl) {
                $enderecoPartes = array_filter([$loja->rua, $loja->numero, $loja->bairro, $loja->cidade, $loja->estado]);
                $enderecoFormatado = !empty($enderecoPartes) ? implode(', ', $enderecoPartes) : 'Endereço não informado';
                $horario = $horarios[$loja->id] ?? null;
                $hoje = (float) ($fatHoje[$loja->id] ?? 0);

                return [
                    'id'                  => $loja->id,
                    'nome'                => $loja->nome,
                    'foto_perfil'         => $loja->foto_perfil,
                    'ramo_atuacao'        => $loja->ramo_atuacao,
                    'endereco'            => $enderecoFormatado,
                    'rua'                 => $loja->rua,
                    'numero'              => $loja->numero,
                    'ativo'               => (bool) $loja->ativo,
                    'status'              => $loja->ativo ? 'Ativo' : 'Inativo',
                    'horario_hoje'        => !$horario || $horario->fechado ? null : substr((string) $horario->hora_fechamento, 0, 5),
                    'fechado_hoje'        => $horario ? (bool) $horario->fechado : null,
                    'faturamento_hoje'    => $brl($hoje),
                    'variacao_hoje'       => $variacao($hoje, (float) ($fatOntem[$loja->id] ?? 0)),
                    'aguardando'          => (int) ($aguardando[$loja->id] ?? 0),
                    'funcionarios'        => (int) ($equipe[$loja->id]->total ?? 0),
                    'funcionarios_ativos' => (int) ($equipe[$loja->id]->ativos ?? 0),
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

    /** Vitrine do local do jeito que o cliente vê (prévia para o sócio). */
    /** Passo a passo para cadastrar local, serviço e reserva, com o progresso real do sócio. */
    public function tutoriais(Request $request)
    {
        $user = \Illuminate\Support\Facades\Auth::user();
        abort_unless(in_array($user->papel, ['admin', 'socio', 'proprietario', 'gerente'], true), 403);

        $locais = $user->estabelecimentosGerenciados()->get(['estabelecimentos.id', 'estabelecimentos.nome']);

        return Inertia::render('Estabelecimentos/Tutoriais', [
            'locais' => $locais->map(fn ($l) => ['id' => $l->id, 'nome' => $l->nome])->values(),
            'progresso' => [
                'local' => $locais->count() > 0,
                'servico' => \App\Models\Servico::whereIn('estabelecimento_id', $locais->pluck('id'))->exists(),
                'reserva' => \App\Models\ItemAluguel::catalogo()->where('estabelecimento_id', $user->id)->exists(),
                'produto' => \App\Models\ProdutoEntrega::where('usuario_id', $user->id)->exists(),
            ],
            'fluxoInicial' => in_array($request->query('fluxo'), ['local', 'servico', 'reserva', 'produto'], true) ? $request->query('fluxo') : 'local',
        ]);
    }

    public function vitrine(Request $request)
    {
        $user = \Illuminate\Support\Facades\Auth::user();
        abort_unless(in_array($user->papel, ['admin', 'socio', 'proprietario', 'gerente'], true), 403);

        $estabelecimentoAtual = $request->integer('estabelecimento_id')
            ? Estabelecimento::find($request->integer('estabelecimento_id'))
            : $user->estabelecimentos()->first();

        return Inertia::render('Estabelecimentos/Vitrine', [
            'produtosVendidos' => $estabelecimentoAtual?->produtosVendidos() ?? 0,
            'vitrine' => app(\App\Services\VitrineService::class)->montar($user, $request->integer('estabelecimento_id') ?: null),
            'divulgacao' => collect(\App\Http\Controllers\DivulgacaoController::dadosDoProprietario($user))
                ->firstWhere('id', $request->integer('estabelecimento_id') ?: null)
                ?? (\App\Http\Controllers\DivulgacaoController::dadosDoProprietario($user)[0] ?? null),
        ]);
    }
}
