<?php

namespace App\Http\Controllers\Api\Mobile\Proprietario;

use App\Http\Controllers\Controller;
use App\Models\Estabelecimento;
use App\Models\Funcionario;
use App\Models\Servico;
use App\Models\ItemAluguel;
use App\Models\Aluguel;
use App\Services\ImageKitService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Exception;

class ConfiguracoesMobileController extends Controller
{
    /**
     * Resposta padrão de erro para falhas inesperadas, sem vazar detalhes
     * internos (stacktrace/SQL) para o app.
     */
    private function respostaErro(Exception $e, string $contexto): \Illuminate\Http\JsonResponse
    {
        Log::error("[ConfiguracoesMobileController] {$contexto}: " . $e->getMessage(), ['exception' => $e]);

        return response()->json([
            'status'  => 'error',
            'message' => 'Não foi possível concluir a operação agora. Tente novamente em instantes.',
        ], 500);
    }

    // ==========================================
    // DADOS INICIAIS DA TELA
    // ==========================================
    public function index(Request $request)
    {
        try {
            $estabelecimento = $request->user()->estabelecimentoAtual();

            return response()->json([
                'estabelecimento' => $estabelecimento,
                'meusEstabelecimentos' => $request->user()->estabelecimentos,
                'funcionarios' => $estabelecimento ? $estabelecimento->funcionarios : [],
                'servicos' => $estabelecimento ? $estabelecimento->servicos : [],
                'itens_aluguel' => $estabelecimento ? $estabelecimento->itensAluguel : [],
                'produtos' => $estabelecimento ? $estabelecimento->produtos : [],
                'alugueis' => $estabelecimento ? Aluguel::where('estabelecimento_id', $estabelecimento->id)->get() : [],
                'podeGerenciarEquipeAvancada' => $request->user()->podeGerenciarEquipeAvancada(),
            ]);
        } catch (Exception $e) {
            return $this->respostaErro($e, 'index');
        }
    }

    /**
     * GET /mobile/configuracoes/{estabelecimento}
     * Usado pela tela de Configurações do app: o dono escolhe, no Dashboard,
     * qual dos seus estabelecimentos quer editar, e o app navega passando o
     * id explicitamente na URL (diferente de `index()`, que resolve um único
     * "estabelecimento atual" implícito).
     */
    public function mostrarPorEstabelecimento(Request $request, $estabelecimentoId)
    {
        try {
            $estabelecimento = Estabelecimento::find($estabelecimentoId);

            if (!$estabelecimento) {
                return response()->json(['status' => 'error', 'message' => 'Estabelecimento não encontrado.'], 404);
            }

            $temPermissao = $request->user()->estabelecimentos()
                ->where('estabelecimentos.id', $estabelecimento->id)
                ->exists();

            if (!$temPermissao) {
                return response()->json(['status' => 'error', 'message' => 'Você não tem permissão para editar esta loja.'], 403);
            }

            $atividadesRecentes = \App\Models\AtividadeEquipe::with('usuario:id,name')
                ->where('estabelecimento_id', $estabelecimento->id)
                ->latest('created_at')
                ->limit(30)
                ->get(['id', 'estabelecimento_id', 'usuario_id', 'papel', 'acao', 'descricao', 'created_at']);

            return response()->json([
                'estabelecimento' => $estabelecimento,
                'meusEstabelecimentos' => $request->user()->estabelecimentos,
                'funcionarios' => $estabelecimento->funcionarios,
                'servicos' => $estabelecimento->servicos,
                'itens_aluguel' => $estabelecimento->itensAluguel,
                'produtos' => $estabelecimento->produtos,
                'alugueis' => Aluguel::where('estabelecimento_id', $estabelecimento->id)->get(),
                'podeGerenciarEquipeAvancada' => $request->user()->podeGerenciarEquipeAvancada(),
                'atividadesRecentes' => $atividadesRecentes,
            ]);
        } catch (Exception $e) {
            return $this->respostaErro($e, 'mostrarPorEstabelecimento');
        }
    }

    // ==========================================
    // 1. ESTABELECIMENTO
    // ==========================================
    public function storeEstabelecimento(Request $request)
    {
        $validated = $request->validate([
            'nome' => 'required|string|max:255',
            'cnpj' => ['required', 'string', 'max:20', 'regex:/^[0-9.\-\/\s]+$/', 'unique:estabelecimentos,cnpj'],
            'razao_social' => 'nullable|string|max:255',
            'site' => 'nullable|string|max:255',
            'ramo_atuacao' => 'nullable|string|max:255',
            'telefone' => 'nullable|string|max:20|regex:/^[0-9()\-\s]+$/',
            'cep' => 'nullable|string|max:10|regex:/^[0-9\-\s]+$/',
            'rua' => 'nullable|string|max:255',
            'numero' => 'nullable|string|max:20',
            'complemento' => 'nullable|string|max:255',
            'bairro' => 'nullable|string|max:255',
            'cidade' => 'nullable|string|max:255',
            'estado' => 'nullable|string|max:2',
            'token_mercadopago' => 'nullable|string',
            'foto_perfil' => 'nullable|image|mimes:jpg,jpeg,png,webp|max:2048',
            'foto_banner' => 'nullable|image|mimes:jpg,jpeg,png,webp|max:2048',
        ]);

        if ($request->hasFile('foto_perfil')) {
            $validated['foto_perfil'] = ImageKitService::upload($request->file('foto_perfil'), '/waitless/estabelecimentos');
        }

        if ($request->hasFile('foto_banner')) {
            $validated['foto_banner'] = ImageKitService::upload($request->file('foto_banner'), '/waitless/estabelecimentos/banners');
        }

        $estabelecimento = Estabelecimento::create($validated);

        // Associa o usuário autenticado ao novo estabelecimento na tabela pivot com tipo 'admin'
        $request->user()->estabelecimentos()->attach($estabelecimento->id, [
            'tipo' => 'admin'
        ]);

        return response()->json([
            'message' => 'Estabelecimento criado com sucesso!',
            'estabelecimento' => $estabelecimento
        ], 201);
    }

    public function updateEstabelecimento(Request $request, Estabelecimento $estabelecimento)
    {
        $validated = $request->validate([
            'nome' => 'required|string|max:255',
            'cnpj' => ['required', 'string', 'max:20', 'regex:/^[0-9.\-\/\s]+$/', 'unique:estabelecimentos,cnpj,' . $estabelecimento->id],
            'razao_social' => 'nullable|string|max:255',
            'site' => 'nullable|string|max:255',
            'ramo_atuacao' => 'nullable|string|max:255',
            'telefone' => 'nullable|string|max:20|regex:/^[0-9()\-\s]+$/',
            'cep' => 'nullable|string|max:10|regex:/^[0-9\-\s]+$/',
            'rua' => 'nullable|string|max:255',
            'numero' => 'nullable|string|max:20',
            'complemento' => 'nullable|string|max:255',
            'bairro' => 'nullable|string|max:255',
            'cidade' => 'nullable|string|max:255',
            'estado' => 'nullable|string|max:2',
            'token_mercadopago' => 'nullable|string',
            'foto_perfil' => 'nullable|image|mimes:jpg,jpeg,png,webp|max:2048',
            'foto_banner' => 'nullable|image|mimes:jpg,jpeg,png,webp|max:2048',
        ]);

        if ($request->hasFile('foto_perfil')) {
            if ($estabelecimento->foto_perfil) ImageKitService::delete($estabelecimento->foto_perfil);
            $validated['foto_perfil'] = ImageKitService::upload($request->file('foto_perfil'), '/waitless/estabelecimentos');
        }

        if ($request->hasFile('foto_banner')) {
            if ($estabelecimento->foto_banner) ImageKitService::delete($estabelecimento->foto_banner);
            $validated['foto_banner'] = ImageKitService::upload($request->file('foto_banner'), '/waitless/estabelecimentos/banners');
        }

        $estabelecimento->update($validated);

        return response()->json(['message' => 'Configurações salvas com sucesso!', 'estabelecimento' => $estabelecimento]);
    }

    public function toggleStatusEstabelecimento(Request $request, Estabelecimento $estabelecimento)
    {
        $user = $request->user();
        $souGestorDoLocal = $user->papel === 'admin'
            || $user->estabelecimentos()->where('estabelecimentos.id', $estabelecimento->id)->exists();
        if (!$souGestorDoLocal) {
            return response()->json(['message' => 'Você não administra este estabelecimento.'], 403);
        }

        $estabelecimento->update(['ativo' => !$estabelecimento->ativo]);
        return response()->json(['message' => 'Status alterado', 'ativo' => $estabelecimento->ativo]);
    }

    // ==========================================
    // 2. FUNCIONÁRIOS
    // ==========================================
    /** Cargos que o app pode criar, e o papel/tipo real que cada um gera. */
    private const CARGOS_FUNCIONARIO_MOBILE = [
        'Atendente' => 'atendente',
        'Gerente'   => 'gerente',
    ];

    public function storeFuncionario(Request $request, Estabelecimento $estabelecimento)
    {
        $user = $request->user();
        $souGestorDoLocal = $user->papel === 'admin'
            || $user->estabelecimentos()->where('estabelecimentos.id', $estabelecimento->id)->exists();
        if (!$souGestorDoLocal) {
            return response()->json(['message' => 'Você não administra este estabelecimento.'], 403);
        }

        $validated = $request->validate([
            'nome' => 'required|string|max:255',
            'telefone' => 'nullable|string|max:20|regex:/^[0-9()\-\s]+$/',
            'cargo' => ['required', 'string', 'in:' . implode(',', array_keys(self::CARGOS_FUNCIONARIO_MOBILE))],
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:6',
        ], [
            'cargo.in' => 'Escolha Atendente ou Gerente.',
        ]);

        $papel = self::CARGOS_FUNCIONARIO_MOBILE[$validated['cargo']];

        if ($papel === 'gerente' && $user->papel !== 'admin' && !$user->podeGerenciarEquipeAvancada()) {
            return response()->json(['message' => 'Criar gerentes é um recurso exclusivo do plano Sócio Premium.'], 403);
        }

        // A tabela `funcionarios` guarda só o perfil (nome/cargo); login e
        // senha ficam na tabela `users`, ligada via usuario_id.
        $funcionario = \Illuminate\Support\Facades\DB::transaction(function () use ($validated, $estabelecimento, $papel) {
            $usuario = \App\Models\User::create([
                'name' => $validated['nome'],
                'email' => $validated['email'],
                'password' => Hash::make($validated['password']),
                'papel' => $papel,
            ]);

            $funcionario = $estabelecimento->funcionarios()->create([
                'usuario_id' => $usuario->id,
                'nome' => $validated['nome'],
                'telefone' => $validated['telefone'] ?? null,
                'cargo' => $validated['cargo'],
                'ativo' => true,
            ]);

            if ($papel === 'gerente') {
                $estabelecimento->proprietarios()->attach($usuario->id, ['tipo' => 'gerente']);
            }

            return $funcionario;
        });

        return response()->json(['message' => 'Funcionário criado com sucesso!', 'funcionario' => $funcionario->load('usuario')], 201);
    }

    /** Convida outro sócio (co-proprietário) — recurso exclusivo do plano Sócio Premium, sem limite. */
    public function storeSocio(Request $request, Estabelecimento $estabelecimento)
    {
        $user = $request->user();
        $souGestorDoLocal = $user->estabelecimentos()->where('estabelecimentos.id', $estabelecimento->id)->exists();
        if (!$souGestorDoLocal) {
            return response()->json(['message' => 'Você não administra este estabelecimento.'], 403);
        }

        if (!$user->podeGerenciarEquipeAvancada()) {
            return response()->json(['message' => 'Convidar outros sócios é um recurso exclusivo do plano Sócio Premium.'], 403);
        }

        $validated = $request->validate([
            'nome' => 'required|string|max:255',
            'telefone' => 'nullable|string|max:20|regex:/^[0-9()\-\s]+$/',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:6',
        ]);

        $novoSocio = \Illuminate\Support\Facades\DB::transaction(function () use ($validated, $estabelecimento) {
            $usuario = \App\Models\User::create([
                'name' => $validated['nome'],
                'email' => $validated['email'],
                'telefone' => $validated['telefone'] ?? null,
                'password' => Hash::make($validated['password']),
                'papel' => 'socio',
            ]);

            $estabelecimento->proprietarios()->attach($usuario->id, ['tipo' => 'socio']);

            return $usuario;
        });

        return response()->json(['message' => "{$novoSocio->name} agora é sócio(a) deste estabelecimento!"], 201);
    }

    public function updateFuncionario(Request $request, Funcionario $funcionario)
    {
        $user = $request->user();
        $souGestorDoLocal = $user->papel === 'admin'
            || $user->estabelecimentos()->where('estabelecimentos.id', $funcionario->estabelecimento_id)->exists();
        if (!$souGestorDoLocal) {
            return response()->json(['message' => 'Você não administra o estabelecimento deste funcionário.'], 403);
        }

        $validated = $request->validate([
            'nome' => 'required|string|max:255',
            'telefone' => 'nullable|string|max:20|regex:/^[0-9()\-\s]+$/',
            'cargo' => ['required', 'string', 'in:' . implode(',', array_keys(self::CARGOS_FUNCIONARIO_MOBILE))],
            'email' => 'nullable|email|unique:users,email,'.$funcionario->usuario_id,
            'password' => 'nullable|string|min:6',
        ], [
            'cargo.in' => 'Escolha Atendente ou Gerente.',
        ]);

        $papel = self::CARGOS_FUNCIONARIO_MOBILE[$validated['cargo']];
        if ($papel === 'gerente' && $user->papel !== 'admin' && !$user->podeGerenciarEquipeAvancada()) {
            return response()->json(['message' => 'Promover a gerente é um recurso exclusivo do plano Sócio Premium.'], 403);
        }

        if ($funcionario->usuario_id) {
            $usuarioFuncionario = $funcionario->usuario;
            if ($usuarioFuncionario) {
                $papelAntigo = $usuarioFuncionario->papel;
                $dadosUsuario = array_filter([
                    'email' => $validated['email'] ?? null,
                    'password' => !empty($validated['password']) ? Hash::make($validated['password']) : null,
                ]);
                $dadosUsuario['papel'] = $papel;
                $usuarioFuncionario->update($dadosUsuario);

                $estabelecimento = Estabelecimento::find($funcionario->estabelecimento_id);
                if ($papelAntigo === 'gerente' && $papel !== 'gerente') {
                    $estabelecimento?->proprietarios()->detach($usuarioFuncionario->id);
                } elseif ($papel === 'gerente' && $estabelecimento && !$estabelecimento->proprietarios()->where('users.id', $usuarioFuncionario->id)->exists()) {
                    $estabelecimento->proprietarios()->attach($usuarioFuncionario->id, ['tipo' => 'gerente']);
                }
            }
        }

        $funcionario->update([
            'nome' => $validated['nome'],
            'telefone' => $validated['telefone'] ?? null,
            'cargo' => $validated['cargo'],
        ]);

        return response()->json(['message' => 'Funcionário atualizado com sucesso!', 'funcionario' => $funcionario->load('usuario')]);
    }

    public function destroyFuncionario(Request $request, Funcionario $funcionario)
    {
        $user = $request->user();
        $souGestorDoLocal = $user->papel === 'admin'
            || $user->estabelecimentos()->where('estabelecimentos.id', $funcionario->estabelecimento_id)->exists();
        if (!$souGestorDoLocal) {
            return response()->json(['message' => 'Você não administra o estabelecimento deste funcionário.'], 403);
        }

        $funcionario->update(['ativo' => false]);
        return response()->json(['message' => 'Funcionário inativado com sucesso!']);
    }

    // ==========================================
    // 3. SERVIÇOS
    // ==========================================
    public function storeServico(Request $request)
    {
        $validated = $request->validate([
            'nome' => 'required|string|max:255',
            'tipo_servico' => ['required', 'string', Rule::in(\App\Support\Categorias::valores())],
            'descricao' => 'nullable|string',
            'valor' => 'required|numeric',
            'duracao_minutos' => 'required|integer',
            'vagas_por_horario'   => 'nullable|integer|min:1|max:100',
            'horarios_disponiveis' => 'nullable|array',
            'estabelecimentos_ids' => 'required|array|min:1',
            'estabelecimentos_ids.*' => 'integer|exists:estabelecimentos,id',
            'fotos' => 'nullable|array|max:10',
            'fotos.*' => 'image|mimes:jpg,jpeg,png,webp|max:2048',
        ], [
            'tipo_servico.required' => 'Escolha a categoria do serviço.',
            'tipo_servico.in' => 'Escolha uma categoria válida da lista.',
        ]);

        // `servicos.estabelecimento_id` é uma FK única (não uma pivot M2M) — o serviço pertence a
        // um só local. O formulário só oferece o local atual, então usa sempre o primeiro id.
        $estabelecimentoId = (int) $validated['estabelecimentos_ids'][0];
        if (!$request->user()->estabelecimentosGerenciados()->where('estabelecimentos.id', $estabelecimentoId)->exists()) {
            return response()->json(['message' => 'Você não tem permissão para cadastrar serviços neste estabelecimento.'], 403);
        }

        $fotosUrls = [];
        if ($request->hasFile('fotos')) {
            foreach ($request->file('fotos') as $foto) {
                $fotosUrls[] = $foto->store('servicos/fotos', 'public');
            }
        }

        $configuracoes = [
            'tipo_pagamento' => $request->input('tipo_pagamento', 'hibrido'),
            'funcionario_padrao' => $request->input('funcionario_id'),
            'dias_disponiveis' => $request->input('dias_disponiveis', []),
            'tem_cupom' => $request->boolean('tem_cupom'),
            'tipo_desconto_cupom' => $request->input('tipo_desconto_cupom', 'percentual'),
            'valor_cupom' => $request->input('valor_cupom'),
            'codigo_cupom' => $request->input('codigo_cupom'),
            'fotos' => $fotosUrls
        ];

        $servico = Servico::create([
            'estabelecimento_id' => $estabelecimentoId,
            'nome' => $validated['nome'],
            'tipo_servico' => $validated['tipo_servico'] ?? null,
            'descricao' => $validated['descricao'] ?? null,
            'valor' => $validated['valor'],
            'duracao_minutos' => $validated['duracao_minutos'],
            'vagas_por_horario'      => $validated['vagas_por_horario'] ?? 1,
            'ativo' => true,
            'horarios_disponiveis' => json_encode($validated['horarios_disponiveis'] ?? []),
            'configuracoes' => json_encode($configuracoes),
        ]);

        return response()->json(['message' => 'Serviço cadastrado com sucesso!', 'servico' => $servico], 201);
    }

    public function updateServico(Request $request, Servico $servico)
    {
        if (!$request->user()->estabelecimentos()->where('estabelecimentos.id', $servico->estabelecimento_id)->exists()) {
            return response()->json(['status' => 'error', 'message' => 'Você não tem permissão para editar este serviço.'], 403);
        }

        $validated = $request->validate([
            'nome'                      => 'sometimes|string|max:255',
            'tipo_servico'              => ['sometimes', 'string', Rule::in(\App\Support\Categorias::valores())],
            'descricao'                 => 'nullable|string',
            'valor'                     => 'sometimes|numeric|min:0',
            'duracao_minutos'           => 'sometimes|integer|min:1',
            'vagas_por_horario'         => 'sometimes|integer|min:1|max:100',
            'ativo'                     => 'sometimes|boolean',
            'somente_premium'           => 'sometimes|boolean',
            'tem_promocao'              => 'sometimes|boolean',
            'tipo_desconto'             => 'sometimes|in:percentual,fixo',
            'valor_desconto'            => 'nullable|numeric|min:0',
            'aceita_pontos'             => 'sometimes|boolean',
            'maximo_pontos_permitidos'  => 'nullable|integer|min:0',
        ], [
            'tipo_servico.in' => 'Escolha uma categoria válida da lista.',
        ]);

        try {
            $servico->update($validated);
            return response()->json(['message' => 'Serviço atualizado com sucesso!', 'servico' => $servico]);
        } catch (Exception $e) {
            return $this->respostaErro($e, 'updateServico');
        }
    }

    public function destroyServico(Servico $servico)
    {
        $servico->delete();
        return response()->json(['message' => 'Serviço apagado com sucesso!']);
    }

    // ==========================================
    // 4. ITENS DE ALUGUEL / LOCAÇÃO
    // ==========================================
    public function indexItensAluguel(Request $request)
    {
        $estabelecimento = $request->user()->estabelecimentoAtual();
        $itens = $estabelecimento ? $estabelecimento->itensAluguel()->paginate(10) : [];
        return response()->json($itens);
    }

    public function storeItemAluguel(Request $request)
    {
        $validated = $request->validate([
            'estabelecimento_id' => 'required|exists:users,id',
            'nome' => 'required|string|max:255',
            'descricao' => 'nullable|string',
            'valor_diaria' => 'nullable|numeric',
            'valor_semanal' => 'nullable|numeric',
            'valor_mensal' => 'nullable|numeric',
            'valor_caucao' => 'nullable|numeric',
            'disponivel' => 'nullable|boolean',
            'ativo' => 'nullable|boolean',
            'mobiliado' => 'nullable|boolean',
            'aceita_pet' => 'nullable|boolean',
            'possui_wifi' => 'nullable|boolean',
            'possui_ar_condicionado' => 'nullable|boolean',
            'piscina' => 'nullable|boolean',
            'churrasqueira' => 'nullable|boolean',
            'possui_seguro' => 'nullable|boolean',
            'sempre_disponivel' => 'nullable|boolean',
            'recursos_oferecidos' => 'nullable|array',
            'acessorios' => 'nullable|array',
            'dias_semana_disponiveis' => 'nullable|array',
            'dias_mes_disponiveis' => 'nullable|array',
            'datas_permitidas' => 'nullable|array',
            'datas_bloqueadas' => 'nullable|array',
            'horarios_bloqueados' => 'nullable|array',
            'fotos' => 'nullable|array|max:10',
            'fotos.*' => 'image|mimes:jpg,jpeg,png,webp|max:2048',
        ]);

        $fotosUrls = [];
        if ($request->hasFile('fotos')) {
            foreach ($request->file('fotos') as $foto) {
                $fotosUrls[] = $foto->store('locacoes/fotos', 'public');
            }
        }

        $validated['fotos'] = json_encode($fotosUrls);

        $item = ItemAluguel::create($validated);

        return response()->json(['message' => 'Item de locação cadastrado!', 'item' => $item], 201);
    }

    public function updateItemAluguel(Request $request, ItemAluguel $item)
    {
        $validated = $request->validate([
            'fotos' => 'nullable|array|max:10',
            'fotos.*' => 'image|mimes:jpg,jpeg,png,webp|max:2048',
        ]);

        $data = $request->except(['fotos']);

        if ($request->hasFile('fotos')) {
            // Apaga fotos antigas se existirem
            if (!empty($item->fotos)) {
                $fotosAntigas = is_array($item->fotos) ? $item->fotos : json_decode($item->fotos, true);
                if ($fotosAntigas) {
                    foreach ($fotosAntigas as $fotoAntiga) {
                        Storage::disk('public')->delete($fotoAntiga);
                    }
                }
            }

            $fotosUrls = [];
            foreach ($request->file('fotos') as $foto) {
                $fotosUrls[] = $foto->store('locacoes/fotos', 'public');
            }
            $data['fotos'] = json_encode($fotosUrls);
        }

        $item->update($data);

        return response()->json(['message' => 'Item de locação atualizado!', 'item' => $item]);
    }

    public function destroyItemAluguel(ItemAluguel $item)
    {
        if (!empty($item->fotos)) {
            $fotos = is_array($item->fotos) ? $item->fotos : json_decode($item->fotos, true);
            if ($fotos) {
                foreach ($fotos as $foto) {
                    Storage::disk('public')->delete($foto);
                }
            }
        }

        $item->delete();
        return response()->json(['message' => 'Item removido do catálogo!']);
    }

    // ==========================================
    // 5. GESTÃO DE ALUGUÉIS / CONTRATOS
    // ==========================================
    public function indexAlugueis(Request $request)
    {
        $estabelecimento = $request->user()->estabelecimentoAtual();

        $alugueis = Aluguel::with(['item', 'locatario', 'proprietario'])
            ->when($estabelecimento, function ($query) use ($estabelecimento) {
                $query->where('estabelecimento_id', $estabelecimento->id);
            })
            ->orderBy('created_at', 'desc')
            ->paginate(15);

        return response()->json($alugueis);
    }

    public function storeAluguel(Request $request)
    {
        $validated = $request->validate([
            'estabelecimento_id' => 'required|exists:users,id',
            'item_aluguel_id' => 'required|exists:itens_aluguel,id',
            'servico_id' => 'nullable|exists:servicos,id',
            'proprietario_id' => 'required|exists:users,id',
            'locatario_id' => 'required|exists:users,id',
            'contrato_id' => 'nullable|integer',
            'numero_contracto' => 'nullable|string|max:255',
            'tipo_periodo' => 'required|in:diaria,semanal,mensal',
            'quantidade_periodos' => 'required|integer|min:1',
            'data_inicio' => 'required|date',
            'data_fim' => 'required|date|after_or_equal:data_inicio',
            'quantidade' => 'nullable|integer|min:1',
            'valor_unitario' => 'required|numeric',
            'desconto' => 'nullable|numeric',
            'taxa_servico' => 'nullable|numeric',
            'valor_caucao' => 'nullable|numeric',
            'valor_multa_atraso' => 'nullable|numeric',
            'valor_danos' => 'nullable|numeric',
            'multa_cancelamento' => 'nullable|numeric',
            'valor_total' => 'required|numeric',
            'forma_pagamento' => 'required|string|max:50',
            'pagamento_confirmado' => 'nullable|boolean',
            'contrato_assinado' => 'nullable|boolean',
            'renovacao_automatica' => 'nullable|boolean',
            'permitir_cancelamento' => 'nullable|boolean',
            'dias_antecedencia_cancelamento' => 'nullable|integer',
            'seguro_contratado' => 'nullable|boolean',
            'status' => 'nullable|in:pendente,aguardando_pagamento,aguardando_assinatura,confirmado,em_andamento,finalizado,cancelado',
            'status_vistoria' => 'nullable|in:nao_realizada,aprovada,reprovada,com_ressalvas',
            'observacoes' => 'nullable|string',

            // Endereço de Retirada
            'cep_retirada' => 'nullable|string|max:10',
            'rua_retirada' => 'nullable|string|max:255',
            'numero_retirada' => 'nullable|string|max:20',
            'complemento_retirada' => 'nullable|string|max:255',
            'bairro_retirada' => 'nullable|string|max:255',
            'cidade_retirada' => 'nullable|string|max:255',
            'estado_retirada' => 'nullable|string|max:2',
            'latitude_retirada' => 'nullable|numeric',
            'longitude_retirada' => 'nullable|numeric',

            // Endereço de Entrega
            'cep_entrega' => 'nullable|string|max:10',
            'rua_entrega' => 'nullable|string|max:255',
            'numero_entrega' => 'nullable|string|max:20',
            'complemento_entrega' => 'nullable|string|max:255',
            'bairro_entrega' => 'nullable|string|max:255',
            'cidade_entrega' => 'nullable|string|max:255',
            'estado_entrega' => 'nullable|string|max:2',
            'latitude_entrega' => 'nullable|numeric',
            'longitude_entrega' => 'nullable|numeric',
        ]);

        // Gera o código único da reserva automaticamente
        $validated['codigo_reserva'] = 'RES-' . strtoupper(Str::random(8));

        $aluguel = Aluguel::create($validated);

        return response()->json([
            'message' => 'Aluguel registrado com sucesso!',
            'aluguel' => $aluguel->load(['item', 'locatario', 'proprietario'])
        ], 201);
    }

    public function showAluguel(Aluguel $aluguel)
    {
        return response()->json($aluguel->load(['item', 'locatario', 'proprietario', 'contratoDocumento']));
    }

    public function updateAluguel(Request $request, Aluguel $aluguel)
    {
        if (!$request->user()->estabelecimentos()->where('estabelecimentos.id', $aluguel->estabelecimento_id)->exists()) {
            return response()->json(['status' => 'error', 'message' => 'Você não tem permissão para editar este aluguel.'], 403);
        }

        $validated = $request->validate([
            'status'                => 'sometimes|in:pendente,aguardando_pagamento,aguardando_assinatura,confirmado,em_andamento,finalizado,cancelado',
            'status_vistoria'       => 'sometimes|in:nao_realizada,aprovada,reprovada,com_ressalvas',
            'pagamento_confirmado'  => 'sometimes|boolean',
            'contrato_assinado'     => 'sometimes|boolean',
            'data_inicio'           => 'sometimes|date',
            'data_fim'              => 'sometimes|date|after_or_equal:data_inicio',
            'observacoes'           => 'nullable|string',
        ]);

        try {
            $aluguel->update($validated);

            return response()->json([
                'message' => 'Dados do aluguel atualizados com sucesso!',
                'aluguel' => $aluguel
            ]);
        } catch (Exception $e) {
            return $this->respostaErro($e, 'updateAluguel');
        }
    }

    public function destroyAluguel(Aluguel $aluguel)
    {
        $aluguel->delete();
        return response()->json(['message' => 'Registro de aluguel removido com sucesso!']);
    }
}