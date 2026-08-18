<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Estabelecimento;
use App\Models\Funcionario;
use App\Models\Servico;
use App\Models\ItemAluguel;
use App\Models\Aluguel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ConfiguracoesMobileController extends Controller
{
    // ==========================================
    // DADOS INICIAIS DA TELA
    // ==========================================
    public function index(Request $request)
    {
        $estabelecimento = $request->user()->estabelecimentoAtual();
        
        return response()->json([
            'estabelecimento' => $estabelecimento,
            'meusEstabelecimentos' => $request->user()->estabelecimentos,
            'funcionarios' => $estabelecimento ? $estabelecimento->funcionarios : [],
            'servicos' => $estabelecimento ? $estabelecimento->servicos : [],
            'itens_aluguel' => $estabelecimento ? $estabelecimento->itensAluguel : [],
            'alugueis' => $estabelecimento ? Aluguel::where('estabelecimento_id', $estabelecimento->id)->get() : [],
        ]);
    }

    // ==========================================
    // 1. ESTABELECIMENTO
    // ==========================================
    public function storeEstabelecimento(Request $request)
    {
        $validated = $request->validate([
            'nome' => 'required|string|max:255',
            'ramo_atuacao' => 'nullable|string|max:255',
            'telefone' => 'nullable|string|max:20',
            'cep' => 'nullable|string|max:10',
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
            $validated['foto_perfil'] = $request->file('foto_perfil')->store('estabelecimentos/perfil', 'public');
        }

        if ($request->hasFile('foto_banner')) {
            $validated['foto_banner'] = $request->file('foto_banner')->store('estabelecimentos/banner', 'public');
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
            'ramo_atuacao' => 'nullable|string|max:255',
            'telefone' => 'nullable|string|max:20',
            'cep' => 'nullable|string|max:10',
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
            if ($estabelecimento->foto_perfil) Storage::disk('public')->delete($estabelecimento->foto_perfil);
            $validated['foto_perfil'] = $request->file('foto_perfil')->store('estabelecimentos/perfil', 'public');
        }

        if ($request->hasFile('foto_banner')) {
            if ($estabelecimento->foto_banner) Storage::disk('public')->delete($estabelecimento->foto_banner);
            $validated['foto_banner'] = $request->file('foto_banner')->store('estabelecimentos/banner', 'public');
        }

        $estabelecimento->update($validated);

        return response()->json(['message' => 'Configurações salvas com sucesso!', 'estabelecimento' => $estabelecimento]);
    }

    public function toggleStatusEstabelecimento(Estabelecimento $estabelecimento)
    {
        $estabelecimento->update(['ativo' => !$estabelecimento->ativo]);
        return response()->json(['message' => 'Status alterado', 'ativo' => $estabelecimento->ativo]);
    }

    // ==========================================
    // 2. FUNCIONÁRIOS
    // ==========================================
    public function storeFuncionario(Request $request, Estabelecimento $estabelecimento)
    {
        $validated = $request->validate([
            'nome' => 'required|string|max:255',
            'telefone' => 'nullable|string|max:20',
            'cargo' => 'required|string|max:50',
            'email' => 'required|email|unique:funcionarios,email',
            'password' => 'required|string|min:6',
        ]);

        $validated['password'] = Hash::make($validated['password']);
        $funcionario = $estabelecimento->funcionarios()->create($validated);

        return response()->json(['message' => 'Funcionário criado com sucesso!', 'funcionario' => $funcionario], 201);
    }

    public function updateFuncionario(Request $request, Funcionario $funcionario)
    {
        $validated = $request->validate([
            'nome' => 'required|string|max:255',
            'telefone' => 'nullable|string|max:20',
            'cargo' => 'required|string|max:50',
            'email' => 'nullable|email|unique:funcionarios,email,'.$funcionario->id,
            'password' => 'nullable|string|min:6',
        ]);

        if (!empty($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        } else {
            unset($validated['password']);
        }

        $funcionario->update($validated);

        return response()->json(['message' => 'Funcionário atualizado com sucesso!', 'funcionario' => $funcionario]);
    }

    public function destroyFuncionario(Funcionario $funcionario)
    {
        $funcionario->delete();
        return response()->json(['message' => 'Funcionário removido com sucesso!']);
    }

    // ==========================================
    // 3. SERVIÇOS
    // ==========================================
    public function storeServico(Request $request)
    {
        $validated = $request->validate([
            'nome' => 'required|string|max:255',
            'tipo_servico' => 'nullable|string',
            'descricao' => 'nullable|string',
            'valor' => 'required|numeric',
            'duracao_minutos' => 'required|integer',
            'horarios_disponiveis' => 'nullable|array',
            'estabelecimentos_ids' => 'required|array',
            'fotos' => 'nullable|array|max:10',
            'fotos.*' => 'image|mimes:jpg,jpeg,png,webp|max:2048',
        ]);

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
            'nome' => $validated['nome'],
            'tipo_servico' => $validated['tipo_servico'] ?? null,
            'descricao' => $validated['descricao'] ?? null,
            'valor' => $validated['valor'],
            'duracao_minutos' => $validated['duracao_minutos'],
            'horarios_disponiveis' => json_encode($validated['horarios_disponiveis'] ?? []),
            'configuracoes' => json_encode($configuracoes),
        ]);

        $servico->estabelecimentos()->attach($validated['estabelecimentos_ids']);

        return response()->json(['message' => 'Serviço cadastrado com sucesso!', 'servico' => $servico], 201);
    }

    public function updateServico(Request $request, Servico $servico)
    {
        $servico->update($request->all());
        return response()->json(['message' => 'Serviço atualizado com sucesso!', 'servico' => $servico]);
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
        $aluguel->update($request->all());

        return response()->json([
            'message' => 'Dados do aluguel atualizados com sucesso!',
            'aluguel' => $aluguel
        ]);
    }

    public function destroyAluguel(Aluguel $aluguel)
    {
        $aluguel->delete();
        return response()->json(['message' => 'Registro de aluguel removido com sucesso!']);
    }
}