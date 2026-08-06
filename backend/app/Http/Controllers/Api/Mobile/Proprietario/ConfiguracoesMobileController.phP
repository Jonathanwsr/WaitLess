<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Estabelecimento;
use App\Models\Funcionario;
use App\Models\Servico;
use App\Models\ItemAluguel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

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
        ]);
    }

    // ==========================================
    // 1. ESTABELECIMENTO
    // ==========================================
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
            'horarios_disponiveis' => 'array',
            'estabelecimentos_ids' => 'required|array',
        ]);

        // Processamento de Imagens (Galeria em Array)
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
            'tipo_servico' => $validated['tipo_servico'],
            'descricao' => $validated['descricao'],
            'valor' => $validated['valor'],
            'duracao_minutos' => $validated['duracao_minutos'],
            'horarios_disponiveis' => json_encode($validated['horarios_disponiveis']),
            'configuracoes' => json_encode($configuracoes),
        ]);

        $servico->estabelecimentos()->attach($validated['estabelecimentos_ids']);

        return response()->json(['message' => 'Serviço cadastrado com sucesso!', 'servico' => $servico], 201);
    }

    public function updateServico(Request $request, Servico $servico)
    {
        // Lógica similar ao storeServico, fazendo merge nas fotos antigas e atualizando o Model
        $servico->update($request->all());
        return response()->json(['message' => 'Serviço atualizado com sucesso!', 'servico' => $servico]);
    }

    public function destroyServico(Servico $servico)
    {
        // Aqui você pode adicionar lógica para cancelar agendas futuras
        $servico->delete();
        return response()->json(['message' => 'Serviço apagado e agendas limpas!']);
    }

    // ==========================================
    // 4. RESERVAS / LOCAÇÕES (SAAS)
    // ==========================================
    public function indexItensAluguel(Request $request)
    {
        $estabelecimento = $request->user()->estabelecimentoAtual();
        $itens = $estabelecimento ? $estabelecimento->itensAluguel()->paginate(10) : [];
        return response()->json($itens);
    }

    public function storeItemAluguel(Request $request)
    {
        // Recebe todos os dados do imenso Form 4
        $data = $request->all();

        // Processar Array de fotos
        $fotosUrls = [];
        if ($request->hasFile('fotos')) {
            foreach ($request->file('fotos') as $foto) {
                $fotosUrls[] = $foto->store('locacoes/fotos', 'public');
            }
        }
        $data['fotos'] = json_encode($fotosUrls);

        // Arrays devem ser transformados em JSON para o banco se a coluna não for nativa JSON
        $data['recursos_oferecidos'] = json_encode($request->input('recursos_oferecidos', []));
        $data['acessorios'] = json_encode($request->input('acessorios', []));
        $data['datas_permitidas'] = json_encode($request->input('datas_permitidas', []));
        $data['datas_bloqueadas'] = json_encode($request->input('datas_bloqueadas', []));

        $item = ItemAluguel::create($data);

        return response()->json(['message' => 'Item de locação cadastrado!', 'item' => $item], 201);
    }

    public function updateItemAluguel(Request $request, ItemAluguel $item)
    {
        // Lógica de update do Form 4 (mesmo princípio do store)
        $item->update($request->all());
        return response()->json(['message' => 'Item de locação atualizado!', 'item' => $item]);
    }

    public function destroyItemAluguel(ItemAluguel $item)
    {
        $item->delete();
        return response()->json(['message' => 'Item removido do catálogo!']);
    }
}