<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ItemAluguel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class ItemAluguelController extends Controller
{
    /**
     * Retorna a lista de itens de locação para popular o catálogo dinamicamente.
     */
    public function index(Request $request)
    {
        $user = Auth::user();
        
        // Pega o ID do estabelecimento atual do usuário (ajuste conforme a sua lógica de relacionamento)
        $estabelecimentoId = $user->estabelecimentos()->first()->id ?? null;

        if (!$estabelecimentoId) {
            return response()->json([]);
        }

        $itens = ItemAluguel::where('estabelecimento_id', $estabelecimentoId)
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($item) {
                // Garante que as strings JSON sejam decodificadas para o Frontend ler corretamente como Array
                $item->fotos = json_decode($item->fotos) ?? [];
                $item->recursos_oferecidos = json_decode($item->recursos_oferecidos) ?? [];
                $item->acessorios = json_decode($item->acessorios) ?? [];
                $item->funcionarios_responsaveis = json_decode($item->funcionarios_responsaveis) ?? [];
                return $item;
            });

        return response()->json($itens);
    }



    public function buscarVitrineCliente(Request $request)
    {
        $query = ItemAluguel::query()
            ->where('ativo', true) // Considerando que exista controle de status geral
            ->with('estabelecimento:id,nome,foto_perfil,cidade,estado');

        // Filtro por Categoria
        if ($request->filled('categoria')) {
            $query->where('categoria', $request->categoria);
        }

        // Filtro: Apenas Promoções
        if ($request->boolean('apenas_promocoes')) {
            $query->where('tem_promocao', true);
        }

        // Filtro: Aceita Pontos
        if ($request->boolean('aceita_pontos')) {
            $query->where('aceita_pontos', true);
        }

        // Busca por Nome, Marca ou Modelo
        if ($request->filled('busca')) {
            $termo = '%' . $request->busca . '%';
            $query->where(function($q) use ($termo) {
                $q->where('nome', 'like', $termo)
                  ->orWhere('marca', 'like', $termo)
                  ->orWhere('modelo', 'like', $termo);
            });
        }

        // Ordenação
        if ($request->ordem === 'menor_preco') {
            $query->orderBy('valor_diaria', 'asc');
        } elseif ($request->ordem === 'maior_desconto') {
            $query->where('tem_promocao', true)->orderBy('valor_desconto', 'desc');
        } else {
            $query->latest(); 
        }

        $itens = $query->paginate(20);

        return response()->json($itens);
    }

    /**
     * Regras de Validação Centralizadas para reutilizar no Store e Update
     */
    private function regrasValidacao()
    {
        return [
            'estabelecimento_id' => 'required|integer',
            'nome' => 'required|string|max:255',
            'categoria' => 'required|string|max:50',
            'quantidade' => 'required|integer|min:1',
            'marca' => 'nullable|string|max:100',
            'modelo' => 'nullable|string|max:100',
            'tipo' => 'nullable|string|max:100',
            'descricao' => 'nullable|string|max:1000',
            'especificacoes' => 'nullable|string|max:1000',
            'sempre_disponivel' => 'boolean',
          'tipo_disponibilidade' => 'required|in:todos,datas_especificas,dias_semana,dias_mes,personalizado',
         'data_inicio_disponibilidade' => 'nullable|date',
'data_fim_disponibilidade' => 'nullable|date',
'datas_permitidas' => 'nullable|array',
'dias_semana_disponiveis' => 'nullable|array',
'dias_mes_disponiveis' => 'nullable|array',
'horario_inicio' => 'nullable',
'horario_fim' => 'nullable',
'horario_limite_devolucao' => 'nullable',
'antecedencia_reserva_horas' => 'nullable|integer',
'duracao_minima_horas' => 'nullable|integer',
'duracao_maxima_horas' => 'nullable|integer',
'intervalo_entre_reservas_minutos' => 'nullable|integer',
'datas_bloqueadas' => 'nullable|array',
'horarios_bloqueados' => 'nullable|array',
'observacoes_disponibilidade' => 'nullable|string',
            
            // Valores Financeiros
            'valor_diaria' => 'nullable|numeric|min:0',
            'valor_semanal' => 'nullable|numeric|min:0',
            'valor_mensal' => 'nullable|numeric|min:0',
            'valor_caucao' => 'nullable|numeric|min:0',
            
            // Arrays JSON (Opcionais, Comodidades, Equipe)
            'recursos_oferecidos' => 'nullable|array',
            'acessorios' => 'nullable|array',
            'funcionarios_responsaveis' => 'nullable|array',
            'fotos' => 'nullable|array',
            'fotos.*' => 'nullable', // Pode ser file (nova imagem) ou string (URL de imagem antiga)

            // Especificações Gerais / Imóveis
            'capacidade_pessoas' => 'nullable|integer|min:0',
            'area_total' => 'nullable|numeric|min:0',
            'area_construida' => 'nullable|numeric|min:0',
            'numero_quartos' => 'nullable|integer|min:0',
            'numero_banheiros' => 'nullable|integer|min:0',
            'numero_suites' => 'nullable|integer|min:0',
            'numero_vagas' => 'nullable|integer|min:0',
            'numero_comodos' => 'nullable|integer|min:0',
            'mobiliado' => 'nullable|boolean',
            'possui_seguro' => 'nullable|boolean',

            // Endereço Fixo
            'cep' => 'nullable|string|max:15',
            'endereco' => 'nullable|string|max:255',
            'numero' => 'nullable|string|max:20',
            'complemento' => 'nullable|string|max:255',
            'bairro' => 'nullable|string|max:100',
            'cidade' => 'nullable|string|max:100',
            'estado' => 'nullable|string|max:2',
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',

            // Especificações de Veículos
            'placa' => 'nullable|string|max:10',
            'renavam' => 'nullable|string|max:20',
            'chassis' => 'nullable|string|max:30',
            'quilometragem' => 'nullable|numeric|min:0',
            'ano' => 'nullable|integer',
            'combustivel' => 'nullable|string|max:50',
            'cambio' => 'nullable|string|max:50',
            'cilindrada' => 'nullable|string|max:50',
            'potencia' => 'nullable|string|max:50',

            // Especificações de Equipamentos
            'fabricante' => 'nullable|string|max:100',
            'numero_serie' => 'nullable|string|max:100',
            'patrimonio' => 'nullable|string|max:100',
            'voltagem' => 'nullable|string|max:50',
            'potencia_equipamento' => 'nullable|string|max:50',
            'peso' => 'nullable|string|max:50',
            'dimensoes' => 'nullable|string|max:100',
            'garantia' => 'nullable|string|max:100',

            // Endereço de Retirada
            'cep_retirada' => 'nullable|string|max:15',
            'rua_retirada' => 'nullable|string|max:255',
            'numero_retirada' => 'nullable|string|max:20',
            'complemento_retirada' => 'nullable|string|max:255',
            'bairro_retirada' => 'nullable|string|max:100',
            'cidade_retirada' => 'nullable|string|max:100',
            'estado_retirada' => 'nullable|string|max:2',
            'latitude_retirada' => 'nullable|numeric',
            'longitude_retirada' => 'nullable|numeric',

            // Endereço de Entrega
            'cep_entrega' => 'nullable|string|max:15',
            'rua_entrega' => 'nullable|string|max:255',
            'numero_entrega' => 'nullable|string|max:20',
            'complemento_entrega' => 'nullable|string|max:255',
            'bairro_entrega' => 'nullable|string|max:100',
            'cidade_entrega' => 'nullable|string|max:100',
            'estado_entrega' => 'nullable|string|max:2',
            'latitude_entrega' => 'nullable|numeric',
            'longitude_entrega' => 'nullable|numeric',

            // Promoções, Fidelidade e Contrato
            'tem_promocao'             => 'boolean',
            'tipo_desconto'            => 'required_if:tem_promocao,true|in:percentual,fixo',
            'valor_desconto'           => 'nullable|numeric|min:0',
            'aceita_pontos'            => 'boolean',
            'maximo_pontos_permitidos' => 'nullable|integer|min:0',
            'exige_contrato'           => 'boolean',
        ];
    }

    /**
     * Cadastra um novo Item de Locação / Produto no catálogo
     */
public function store(Request $request)
    {
        $dados = $request->validate($this->regrasValidacao());

        $fotosCaminhos = [];
        if ($request->has('fotos') && is_array($request->fotos)) {
            foreach ($request->fotos as $foto) {
                if (is_file($foto)) {
                    $fotosCaminhos[] = '/storage/' . $foto->store('itens_aluguel', 'public');
                }
            }
        }

        $dados['fotos'] = json_encode($fotosCaminhos);
        $dados['recursos_oferecidos'] = json_encode($dados['recursos_oferecidos'] ?? []);
        $dados['acessorios'] = json_encode($dados['acessorios'] ?? []);
        $dados['funcionarios_responsaveis'] = json_encode($dados['funcionarios_responsaveis'] ?? []);
        $dados['datas_permitidas'] = json_encode($dados['datas_permitidas'] ?? []);
        $dados['dias_semana_disponiveis'] = json_encode($dados['dias_semana_disponiveis'] ?? []);
        $dados['dias_mes_disponiveis'] = json_encode($dados['dias_mes_disponiveis'] ?? []);
        $dados['datas_bloqueadas'] = json_encode($dados['datas_bloqueadas'] ?? []);
        $dados['horarios_bloqueados'] = json_encode($dados['horarios_bloqueados'] ?? []);

        $dados['mobiliado'] = $request->boolean('mobiliado', false);
        $dados['possui_seguro'] = $request->boolean('possui_seguro', false);
        $dados['sempre_disponivel'] = $request->boolean('sempre_disponivel', true);
        $dados['tem_promocao'] = $request->boolean('tem_promocao', false);
        $dados['aceita_pontos'] = $request->boolean('aceita_pontos', false);
        $dados['exige_contrato'] = $request->boolean('exige_contrato', false);

        ItemAluguel::create($dados);

        return redirect()->back()->with('success', 'Produto / Locação salvo com sucesso no catálogo!');
    }

    /**
     * Atualiza um Item de Locação / Produto existente
     */
    public function update(Request $request, $id)
    {
        $item = ItemAluguel::findOrFail($id);

        if ($item->estabelecimento_id != $request->estabelecimento_id) { abort(403, 'Ação não autorizada.'); }

        $dados = $request->validate($this->regrasValidacao());

        $fotosCaminhos = [];
        if ($request->has('fotos') && is_array($request->fotos)) {
            foreach ($request->fotos as $foto) {
                if (is_file($foto)) { $fotosCaminhos[] = '/storage/' . $foto->store('itens_aluguel', 'public'); } 
                elseif (is_string($foto)) { $fotosCaminhos[] = $foto; }
            }
        }

        $fotosAntigas = json_decode($item->fotos, true) ?? [];
        $fotosDeletadas = array_diff($fotosAntigas, $fotosCaminhos);
        foreach ($fotosDeletadas as $fotoDeletada) {
            Storage::disk('public')->delete(str_replace('/storage/', '', $fotoDeletada));
        }

        $dados['fotos'] = json_encode($fotosCaminhos);
        $dados['recursos_oferecidos'] = json_encode($dados['recursos_oferecidos'] ?? []);
        $dados['acessorios'] = json_encode($dados['acessorios'] ?? []);
        $dados['funcionarios_responsaveis'] = json_encode($dados['funcionarios_responsaveis'] ?? []);
        $dados['datas_permitidas'] = json_encode($dados['datas_permitidas'] ?? []);
        $dados['dias_semana_disponiveis'] = json_encode($dados['dias_semana_disponiveis'] ?? []);
        $dados['dias_mes_disponiveis'] = json_encode($dados['dias_mes_disponiveis'] ?? []);
        $dados['datas_bloqueadas'] = json_encode($dados['datas_bloqueadas'] ?? []);
        $dados['horarios_bloqueados'] = json_encode($dados['horarios_bloqueados'] ?? []);

        $dados['mobiliado'] = $request->boolean('mobiliado', false);
        $dados['possui_seguro'] = $request->boolean('possui_seguro', false);
        $dados['sempre_disponivel'] = $request->boolean('sempre_disponivel', true);
        $dados['tem_promocao'] = $request->boolean('tem_promocao', false);
        $dados['aceita_pontos'] = $request->boolean('aceita_pontos', false);
        $dados['exige_contrato'] = $request->boolean('exige_contrato', false);

        $item->update($dados);

        return redirect()->back()->with('success', 'Produto atualizado com sucesso!');
    }
    /**
     * Remove um Item de Locação permanentemente
     */
    public function destroy($id)
    {
        $item = ItemAluguel::findOrFail($id);

        
        $fotos = json_decode($item->fotos, true) ?? [];
        foreach ($fotos as $fotoUrl) {
            $pathAbsoluto = str_replace('/storage/', '', $fotoUrl);
            Storage::disk('public')->delete($pathAbsoluto);
        }

        $item->delete();

        return redirect()->back()->with('success', 'Item removido do catálogo com sucesso.');
    }

public function show($id)
    {
        $item = ItemAluguel::with('estabelecimento:id,name,foto_perfil,cidade,estado')->findOrFail($id);

        // Garante que os campos JSON sejam tratados como array, verificando se já não foram convertidos pelo Laravel
        $item->fotos = is_string($item->fotos) ? json_decode($item->fotos, true) : ($item->fotos ?? []);
        $item->recursos_oferecidos = is_string($item->recursos_oferecidos) ? json_decode($item->recursos_oferecidos, true) : ($item->recursos_oferecidos ?? []);
        $item->acessorios = is_string($item->acessorios) ? json_decode($item->acessorios, true) : ($item->acessorios ?? []);

        return Inertia::render('Cliente/DetalhesItem', [
            'item' => $item
        ]);
    }
}