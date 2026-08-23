<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ItemAluguel;
use App\Services\HiveAiService; // Import do serviço Hive AI
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Illuminate\Validation\ValidationException;
use Carbon\Carbon;

class ItemAluguelController extends Controller
{
    /**
     * Retorna a lista de itens de locação para popular o catálogo dinamicamente.
     */
    public function index(Request $request)
    {
        $user = Auth::user();
        
        // Pega o ID do estabelecimento atual do usuário
        $estabelecimentoId = $user->estabelecimentos()->first()->id ?? null;

        if (!$estabelecimentoId) {
            return response()->json([]);
        }

        $itens = ItemAluguel::where('estabelecimento_id', $estabelecimentoId)
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($item) {
                $item->fotos = json_decode($item->fotos) ?? [];
                $item->recursos_oferecidos = json_decode($item->recursos_oferecidos) ?? [];
                $item->acessorios = json_decode($item->acessorios) ?? [];
                $item->funcionarios_responsaveis = json_decode($item->funcionarios_responsaveis) ?? [];
                $item->dias_disponiveis = json_decode($item->dias_disponiveis) ?? [];
                $item->horarios_disponiveis = json_decode($item->horarios_disponiveis) ?? [];
                
                return $item;
            });

        return response()->json($itens);
    }

    public function buscarVitrineCliente(Request $request)
    {
        $query = ItemAluguel::query()
            ->where('ativo', true)
            ->with('estabelecimento:id,name,foto_perfil,cidade,estado'); // Corrigido para name

        if ($request->filled('categoria')) {
            $query->where('categoria', $request->categoria);
        }

        if ($request->boolean('apenas_promocoes')) {
            $query->where('tem_promocao', true);
        }

        if ($request->boolean('aceita_pontos')) {
            $query->where('aceita_pontos', true);
        }

        if ($request->filled('busca')) {
            $termo = '%' . $request->busca . '%';
            $query->where(function($q) use ($termo) {
                $q->where('nome', 'like', $termo)
                  ->orWhere('marca', 'like', $termo)
                  ->orWhere('modelo', 'like', $termo);
            });
        }

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
            
            'observacoes' => 'nullable|string',
            'observacoes_disponibilidade' => 'nullable|string',
            
            'disponibilidade_por_data' => 'nullable|boolean',
            'quantidade_padrao' => 'nullable|integer|min:0',
            'tipo_quantidade' => 'nullable|string|max:50', 
            'dias_disponiveis' => 'nullable|array',
            'horarios_disponiveis' => 'nullable|array',
            
            'periodo_faturamento_padrao' => 'nullable|string|max:100',
            'permitir_pagamento' => 'nullable|string|max:100',
            'valor' => 'nullable|numeric|min:0',
            'valor_original' => 'nullable|numeric|min:0',
            'percentual_desconto' => 'nullable|numeric|min:0|max:100',
            'valor_final' => 'nullable|numeric|min:0',
            'status' => 'nullable|string|max:50',
            
            'valor_diaria' => 'nullable|numeric|min:0',
            'valor_semanal' => 'nullable|numeric|min:0',
            'valor_mensal' => 'nullable|numeric|min:0',
            'valor_caucao' => 'nullable|numeric|min:0',
            
            'recursos_oferecidos' => 'nullable|array',
            'acessorios' => 'nullable|array',
            'funcionarios_responsaveis' => 'nullable|array',
            
            'fotos' => 'nullable|array|max:24',
            'fotos.*' => 'nullable|image|mimes:jpeg,png,jpg,webp,gif|max:2048', 

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

            'cep' => 'nullable|string|max:15',
            'endereco' => 'nullable|string|max:255',
            'numero' => 'nullable|string|max:20',
            'complemento' => 'nullable|string|max:255',
            'bairro' => 'nullable|string|max:100',
            'cidade' => 'nullable|string|max:100',
            'estado' => 'nullable|string|max:2',
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',

            'placa' => 'nullable|string|max:10',
            'renavam' => 'nullable|string|max:20',
            'chassis' => 'nullable|string|max:30',
            'quilometragem' => 'nullable|numeric|min:0',
            'ano' => 'nullable|integer',
            'combustivel' => 'nullable|string|max:50',
            'cambio' => 'nullable|string|max:50',
            'cilindrada' => 'nullable|string|max:50',
            'potencia' => 'nullable|string|max:50',

            'fabricante' => 'nullable|string|max:100',
            'numero_serie' => 'nullable|string|max:100',
            'patrimonio' => 'nullable|string|max:100',
            'voltagem' => 'nullable|string|max:50',
            'potencia_equipamento' => 'nullable|string|max:50',
            'peso' => 'nullable|string|max:50',
            'dimensoes' => 'nullable|string|max:100',
            'garantia' => 'nullable|string|max:100',

            'cep_retirada' => 'nullable|string|max:15',
            'rua_retirada' => 'nullable|string|max:255',
            'numero_retirada' => 'nullable|string|max:20',
            'complemento_retirada' => 'nullable|string|max:255',
            'bairro_retirada' => 'nullable|string|max:100',
            'cidade_retirada' => 'nullable|string|max:100',
            'estado_retirada' => 'nullable|string|max:2',
            'latitude_retirada' => 'nullable|numeric',
            'longitude_retirada' => 'nullable|numeric',

            'cep_entrega' => 'nullable|string|max:15',
            'rua_entrega' => 'nullable|string|max:255',
            'numero_entrega' => 'nullable|string|max:20',
            'complemento_entrega' => 'nullable|string|max:255',
            'bairro_entrega' => 'nullable|string|max:100',
            'cidade_entrega' => 'nullable|string|max:100',
            'estado_entrega' => 'nullable|string|max:2',
            'latitude_entrega' => 'nullable|numeric',
            'longitude_entrega' => 'nullable|numeric',

            'tem_promocao'             => 'boolean',
            'tipo_desconto'            => 'required_if:tem_promocao,true|in:percentual,fixo',
            'valor_desconto'           => 'nullable|numeric|min:0',
            'aceita_pontos'            => 'boolean',
            'maximo_pontos_permitidos' => 'nullable|integer|min:0',
            'exige_contrato'           => 'boolean',
        ];
    }

    public function store(Request $request)
    {
        $dados = $request->validate($this->regrasValidacao());

        $fotosCaminhos = [];
        if ($request->has('fotos') && is_array($request->fotos)) {
            foreach ($request->fotos as $foto) {
                if (is_file($foto)) {
                    if (!HiveAiService::isSafe($foto)) {
                        throw ValidationException::withMessages([
                            'fotos' => 'Uma ou mais imagens enviadas violam nossas políticas de segurança.'
                        ]);
                    }
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
        $dados['dias_disponiveis'] = json_encode($dados['dias_disponiveis'] ?? []);
        $dados['horarios_disponiveis'] = json_encode($dados['horarios_disponiveis'] ?? []);

        $dados['disponibilidade_por_data'] = $request->boolean('disponibilidade_por_data', false);
        $dados['mobiliado'] = $request->boolean('mobiliado', false);
        $dados['possui_seguro'] = $request->boolean('possui_seguro', false);
        $dados['sempre_disponivel'] = $request->boolean('sempre_disponivel', true);
        $dados['tem_promocao'] = $request->boolean('tem_promocao', false);
        $dados['aceita_pontos'] = $request->boolean('aceita_pontos', false);
        $dados['exige_contrato'] = $request->boolean('exige_contrato', false);

        ItemAluguel::create($dados);

        return redirect()->back()->with('success', 'Produto / Locação salvo com sucesso no catálogo!');
    }

    public function update(Request $request, $id)
    {
        $item = ItemAluguel::findOrFail($id);

        if ($item->estabelecimento_id != $request->estabelecimento_id) { 
            abort(403, 'Ação não autorizada.'); 
        }

        $dados = $request->validate($this->regrasValidacao());

        $fotosCaminhos = [];
        if ($request->has('fotos') && is_array($request->fotos)) {
            foreach ($request->fotos as $foto) {
                if (is_file($foto)) { 
                    if (!HiveAiService::isSafe($foto)) {
                        throw ValidationException::withMessages([
                            'fotos' => 'Uma ou mais imagens enviadas violam nossas políticas de segurança.'
                        ]);
                    }
                    $fotosCaminhos[] = '/storage/' . $foto->store('itens_aluguel', 'public'); 
                } 
                elseif (is_string($foto)) { 
                    $fotosCaminhos[] = $foto; 
                }
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
        $dados['dias_disponiveis'] = json_encode($dados['dias_disponiveis'] ?? []);
        $dados['horarios_disponiveis'] = json_encode($dados['horarios_disponiveis'] ?? []);

        $dados['disponibilidade_por_data'] = $request->boolean('disponibilidade_por_data', false);
        $dados['mobiliado'] = $request->boolean('mobiliado', false);
        $dados['possui_seguro'] = $request->boolean('possui_seguro', false);
        $dados['sempre_disponivel'] = $request->boolean('sempre_disponivel', true);
        $dados['tem_promocao'] = $request->boolean('tem_promocao', false);
        $dados['aceita_pontos'] = $request->boolean('aceita_pontos', false);
        $dados['exige_contrato'] = $request->boolean('exige_contrato', false);

        $item->update($dados);

        return redirect()->back()->with('success', 'Produto atualizado com sucesso!');
    }

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

    // =====================================================================
    // 👉 TELA DE DETALHES DO ITEM (PÁGINA DE VENDA)
    // =====================================================================
    public function show($id, Request $request)
    {
        // 1. CORREÇÃO DO ERRO 500: Trocado 'nome' por 'name' na busca da relação
        // Adicionada a relação 'alugueis' para verificar as reservas ativas
        $item = ItemAluguel::with([
            'estabelecimento:id,name,foto_perfil,cidade,estado',
            'alugueis' => function($q) {
                $q->whereNotIn('status', ['cancelado', 'reprovada']);
            }
        ])->findOrFail($id);

        // Adaptação para o frontend que espera a variável chamada "nome"
        if ($item->estabelecimento) {
            $item->estabelecimento->nome = $item->estabelecimento->name;
        }

        // 2. Transforma as strings JSON do banco em Arrays do PHP
        $item->fotos = is_string($item->fotos) ? json_decode($item->fotos, true) : ($item->fotos ?? []);
        $item->recursos_oferecidos = is_string($item->recursos_oferecidos) ? json_decode($item->recursos_oferecidos, true) : ($item->recursos_oferecidos ?? []);
        $item->acessorios = is_string($item->acessorios) ? json_decode($item->acessorios, true) : ($item->acessorios ?? []);
        
        $item->dias_disponiveis = is_string($item->dias_disponiveis) ? json_decode($item->dias_disponiveis, true) : ($item->dias_disponiveis ?? []);
        $item->horarios_disponiveis = is_string($item->horarios_disponiveis) ? json_decode($item->horarios_disponiveis, true) : ($item->horarios_disponiveis ?? []);

        // 3. CÁLCULO DE VAGAS E DISPONIBILIDADE
        $dataConsulta = $request->get('data', Carbon::today()->toDateString());
        
        $vagasTotaisDia = intval($item->quantidade_padrao ?: ($item->quantidade ?: 1));
        
        // Verifica se há configuração de quantidade específica para a data atual
        if ($item->disponibilidade_por_data && is_array($item->dias_disponiveis)) {
            foreach ($item->dias_disponiveis as $diaConfig) {
                if (($diaConfig['data'] ?? '') === $dataConsulta) {
                    $vagasTotaisDia = intval($diaConfig['quantidade'] ?? $vagasTotaisDia);
                    break;
                }
            }
        }

        $vagasOcupadasDia = 0;
        $reservasDoDia = collect();

        // Faz o filtro de reservas que caem na data pesquisada
        if ($item->relationLoaded('alugueis')) {
            $reservasDoDia = $item->alugueis->filter(function($aluguel) use ($dataConsulta) {
                $dataInicio = $aluguel->data_inicio ?? $aluguel->data_agendamento ?? null;
                $dataFim = $aluguel->data_fim ?? $aluguel->data_inicio ?? $aluguel->data_agendamento ?? null;
                if (!$dataInicio) return false;
                
                return $dataInicio <= $dataConsulta && $dataFim >= $dataConsulta;
            });

            // Soma quantas unidades foram reservadas na tabela 'alugueis' (coluna quantidade)
            $vagasOcupadasDia = $reservasDoDia->sum(function($aluguel) {
                return intval($aluguel->quantidade ?: 1);
            });
        }

        $vagasLivresDia = max(0, $vagasTotaisDia - $vagasOcupadasDia);

        $horariosProcessados = [];
        if ($item->disponibilidade_por_data && is_array($item->horarios_disponiveis)) {
            foreach ($item->horarios_disponiveis as $horaConfig) {
                if (($horaConfig['data'] ?? '') === $dataConsulta && !empty($horaConfig['horarios'])) {
                    foreach ($horaConfig['horarios'] as $h) {
                        $hInicio = $h['inicio'];
                        $hFim = $h['fim'];
                        $vagasTotaisHora = intval($h['quantidade'] ?? $vagasTotaisDia);
                        
                        $ocupadasHora = $reservasDoDia->filter(function($aluguel) use ($hInicio, $hFim) {
                            $resInicio = $aluguel->horario_inicio ?? '00:00';
                            $resFim = $aluguel->horario_fim ?? '23:59';
                            return ($resInicio < $hFim) && ($resFim > $hInicio);
                        })->sum(function($aluguel) {
                            return intval($aluguel->quantidade ?: 1);
                        });

                        $horariosProcessados[] = [
                            'inicio' => $hInicio,
                            'fim' => $hFim,
                            'vagas_totais' => $vagasTotaisHora,
                            'vagas_ocupadas' => $ocupadasHora,
                            'vagas_livres' => max(0, $vagasTotaisHora - $ocupadasHora),
                            'esgotado' => max(0, $vagasTotaisHora - $ocupadasHora) === 0
                        ];
                    }
                }
            }
        }

        // 4. Monta a variável final que o Frontend vai receber
        $item->disponibilidade_hoje = [
            'data' => $dataConsulta,
            'tipo_medida' => $item->tipo_quantidade ?? 'vagas',
            'vagas_totais' => $vagasTotaisDia,
            'vagas_ocupadas' => $vagasOcupadasDia,
            'vagas_livres' => $vagasLivresDia,
            'horarios' => $horariosProcessados,
            'status' => $vagasLivresDia > 0 ? 'disponivel' : 'esgotado'
        ];

        // 5. IMPORTANTÍSSIMO: Esconde a relação 'alugueis' antes de mandar para o React. 
        // Isso evita que o cliente atual veja as informações (nome, valores pagos, e-mails) de outros clientes.
        $item->unsetRelation('alugueis');

        return Inertia::render('Cliente/DetalhesItem', [
            'item' => $item
        ]);
    }
}