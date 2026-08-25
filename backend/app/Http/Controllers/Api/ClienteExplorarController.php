<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Estabelecimento;
use App\Models\ItemAluguel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth; // Adicionado para pegar o ID do usuário logado
use Carbon\Carbon;
use Inertia\Inertia;

class ClienteExplorarController extends Controller
{
    public function index(Request $request)
    {
        $validated = $request->validate([
            'tipo_busca'       => 'nullable|string|in:estabelecimentos,servicos,reservas',
            'busca'            => 'nullable|string|max:100',
            'categoria'        => 'nullable|string',
            'data'             => 'nullable|date',
            'preco_min'        => 'nullable|numeric|min:0',
            'preco_max'        => 'nullable|numeric|min:0',
            'apenas_promocoes' => 'nullable|boolean',
            'ordem'            => 'nullable|string|in:relevancia,menor_preco,maior_preco,maior_desconto',
            'per_page'         => 'nullable|integer|max:50',
            'endereco_manual'  => 'nullable|string|max:255',
            'latitude'         => 'nullable|numeric',
            'longitude'        => 'nullable|numeric',
            'raio_km'          => 'nullable|numeric|min:1|max:100',
        ]);

        $tipoBusca = $validated['tipo_busca'] ?? 'servicos';
        $perPage = $validated['per_page'] ?? 12;
        $busca = $request->filled('busca') ? strip_tags(trim($validated['busca'])) : null;
        $categoria = $request->filled('categoria') ? strip_tags(trim($validated['categoria'])) : null;
        $dataDesejada = $validated['data'] ?? null;
        $enderecoManual = $validated['endereco_manual'] ?? null;

        $estabelecimentos = null;
        $itens = null;
        $estabelecimentoSelect = 'id,name as name,foto_perfil,cidade,estado';

        // =====================================================================
        // LÓGICA DE FAVORITOS (Otimizada para não pesar o banco)
        // =====================================================================
        $userId = Auth::id();
        $favEstabelecimentos = [];
        $favItensAluguel = [];
        $favServicos = [];

        // Se tiver usuário logado, busca os IDs favoritos dele numa tacada só
        if ($userId) {
            $favoritosDoUsuario = DB::table('favoritos')->where('usuario_id', $userId)->get();
            $favEstabelecimentos = $favoritosDoUsuario->pluck('estabelecimento_id')->filter()->toArray();
            $favItensAluguel = $favoritosDoUsuario->pluck('item_aluguel_id')->filter()->toArray();
            $favServicos = $favoritosDoUsuario->pluck('servico_id')->filter()->toArray();
        }

        // =====================================================================
        // FLUXO A: BUSCA POR ESTABELECIMENTOS
        // =====================================================================
        if ($tipoBusca === 'estabelecimentos') {
            $queryEstabelecimentos = Estabelecimento::where('ativo', true);

            if ($busca) {
                $termo = "%{$busca}%";
                $queryEstabelecimentos->where(function($q) use ($termo) {
                    $q->where('name', 'ilike', $termo)
                      ->orWhere('cidade', 'ilike', $termo)
                      ->orWhere('estado', 'ilike', $termo);
                });
            }

            if ($categoria && $categoria !== 'todas') {
                $queryEstabelecimentos->where('ramo_atuacao', $categoria);
            }

            if ($enderecoManual) {
                $termoEnd = "%{$enderecoManual}%";
                $queryEstabelecimentos->where(function($q) use ($termoEnd) {
                    $q->where('logradouro', 'ilike', $termoEnd)
                      ->orWhere('bairro', 'ilike', $termoEnd)
                      ->orWhere('cidade', 'ilike', $termoEnd);
                });
            }

            if (!empty($validated['latitude']) && !empty($validated['longitude'])) {
                $raio = $validated['raio_km'] ?? 10;
                $lat = $validated['latitude'];
                $lng = $validated['longitude'];

                $queryEstabelecimentos->selectRaw("*, (6371 * acos(cos(radians(?)) * cos(radians(latitude)) * cos(radians(longitude) - radians(?)) + sin(radians(?)) * sin(radians(latitude)))) AS distancia", [$lat, $lng, $lat])
                                      ->havingRaw("distancia <= ?", [$raio])
                                      ->orderBy('distancia', 'asc');
            } else {
                $queryEstabelecimentos->latest();
            }

            $estabelecimentos = $queryEstabelecimentos->paginate($perPage)->withQueryString();

            // MÁGICA DOS FAVORITOS: Injeta "is_favorito" nos estabelecimentos
            $estabelecimentos->getCollection()->transform(function ($est) use ($favEstabelecimentos) {
                $est->is_favorito = in_array($est->id, $favEstabelecimentos);
                return $est;
            });
        }

        // =====================================================================
        // FLUXO B & C: BUSCA POR SERVIÇOS (ITENS) OU RESERVAS
        // =====================================================================
        if ($tipoBusca === 'servicos' || $tipoBusca === 'reservas') {
            
            // Traz as reservas cadastradas (alugueis) para calcularmos os bloqueios e vagas ocupadas
            $queryItens = ItemAluguel::with([
                "estabelecimento:{$estabelecimentoSelect}",
                "alugueis" => function($q) {
                    // Ignora as que foram canceladas ou reprovadas
                    $q->whereNotIn('status', ['cancelado', 'reprovada']);
                }
            ])->whereHas('estabelecimento');

            if ($busca) {
                $queryItens->where(function ($q) use ($busca) {
                    $termoItem = "%{$busca}%";
                    $q->where('nome', 'ilike', $termoItem)
                      ->orWhere('marca', 'ilike', $termoItem)
                      ->orWhere('modelo', 'ilike', $termoItem)
                      ->orWhere('descricao', 'ilike', $termoItem);
                });
            }

            if ($categoria && $categoria !== 'todas') {
                $queryItens->where('categoria', $categoria);
            }

            if ($request->filled('preco_min')) {
                $queryItens->where('valor_diaria', '>=', $validated['preco_min']);
            }
            if ($request->filled('preco_max')) {
                $queryItens->where('valor_diaria', '<=', $validated['preco_max']);
            }

            if ($request->boolean('apenas_promocoes')) {
                $queryItens->where('tem_promocao', true)
                           ->where('valor_desconto', '>', 0);
            }

            if ($enderecoManual) {
                $termoEnd = "%{$enderecoManual}%";
                $queryItens->whereHas('estabelecimento', function($q) use ($termoEnd) {
                    $q->where('logradouro', 'ilike', $termoEnd)
                      ->orWhere('bairro', 'ilike', $termoEnd)
                      ->orWhere('cidade', 'ilike', $termoEnd);
                });
            }

            if (!empty($validated['latitude']) && !empty($validated['longitude'])) {
                $raio = $validated['raio_km'] ?? 10;
                $lat = $validated['latitude'];
                $lng = $validated['longitude'];

                $queryItens->whereHas('estabelecimento', function($q) use ($lat, $lng, $raio) {
                    $q->selectRaw("(6371 * acos(cos(radians(?)) * cos(radians(latitude)) * cos(radians(longitude) - radians(?)) + sin(radians(?)) * sin(radians(latitude)))) AS distancia", [$lat, $lng, $lat])
                      ->havingRaw("distancia <= ?", [$raio]);
                });
            }

            if ($dataDesejada) {
                try {
                    $dataCarbon = Carbon::parse($dataDesejada);
                    $dataStr = $dataCarbon->toDateString();
                    
                    $diasSemanaMapeamento = [
                        0 => 'domingo', 1 => 'segunda', 2 => 'terca', 
                        3 => 'quarta', 4 => 'quinta', 5 => 'sexta', 6 => 'sabado'
                    ];
                    $diaSemanaNome = $diasSemanaMapeamento[$dataCarbon->dayOfWeek];
                    $diaDoMes = $dataCarbon->day;

                    $queryItens->where(function($q) use ($dataStr) {
                        $q->whereNull('datas_bloqueadas')
                          ->orWhereJsonDoesntContain('datas_bloqueadas', $dataStr);
                    });

                    $queryItens->where(function($q) use ($dataStr, $diaSemanaNome, $diaDoMes) {
                        $q->where('sempre_disponivel', true)
                          ->orWhere(function($sub) use ($dataStr, $diaSemanaNome, $diaDoMes) {
                              
                              $sub->where(function($range) use ($dataStr) {
                                  $range->whereNull('data_inicio_disponibilidade')
                                        ->orWhere('data_inicio_disponibilidade', '<=', $dataStr);
                              })->where(function($range) use ($dataStr) {
                                  $range->whereNull('data_fim_disponibilidade')
                                        ->orWhere('data_fim_disponibilidade', '>=', $dataStr);
                              });

                              $sub->where(function($tipo) use ($dataStr, $diaSemanaNome, $diaDoMes) {
                                  $tipo->where('tipo_disponibilidade', 'todos')
                                       ->orWhere(function($qSemana) use ($diaSemanaNome) {
                                           $qSemana->where('tipo_disponibilidade', 'dias_semana')
                                                   ->whereJsonContains('dias_semana_disponiveis', $diaSemanaNome);
                                       })
                                       ->orWhere(function($qMes) use ($diaDoMes) {
                                           $qMes->where('tipo_disponibilidade', 'dias_mes')
                                                ->whereJsonContains('dias_mes_disponiveis', (string)$diaDoMes);
                                       })
                                       ->orWhere(function($qEsp) use ($dataStr) {
                                           $qEsp->where('tipo_disponibilidade', 'datas_especificas')
                                                ->whereJsonContains('datas_permitidas', $dataStr);
                                       });
                              });
                          });
                    });
                } catch (\Exception $e) {
                    \Log::warning("Data inválida: " . $dataDesejada);
                }
            }

            $ordem = $validated['ordem'] ?? 'relevancia';
            if ($ordem === 'menor_preco') {
                $queryItens->orderBy('valor_diaria', 'asc');
            } elseif ($ordem === 'maior_preco') {
                $queryItens->orderBy('valor_diaria', 'desc');
            } elseif ($ordem === 'maior_desconto') {
                $queryItens->where('tem_promocao', true)->orderBy('valor_desconto', 'desc');
            } else {
                $queryItens->latest(); 
            }

            $itens = $queryItens->paginate($perPage)->withQueryString();

            // ============================================================================
            // INÍCIO DO PROCESSAMENTO MÁGICO DE VAGAS E DISPONIBILIDADE NA VITRINE
            // ============================================================================
            $itens->getCollection()->transform(function ($item) use ($dataDesejada, $favItensAluguel, $favServicos) {
                
                // MÁGICA DOS FAVORITOS: Checa em ambas as listas (caso seja serviço ou aluguel)
                $item->is_favorito = in_array($item->id, $favItensAluguel) || in_array($item->id, $favServicos);

                // Decodificando arrays Json base
                $item->fotos = is_string($item->fotos) ? json_decode($item->fotos, true) : ($item->fotos ?? []);
                $item->recursos_oferecidos = is_string($item->recursos_oferecidos) ? json_decode($item->recursos_oferecidos, true) : ($item->recursos_oferecidos ?? []);
                $item->acessorios = is_string($item->acessorios) ? json_decode($item->acessorios, true) : ($item->acessorios ?? []);
                
                // Decodificando arrays Json de Controle de Vagas
                $item->dias_disponiveis = is_string($item->dias_disponiveis) ? json_decode($item->dias_disponiveis, true) : ($item->dias_disponiveis ?? []);
                $item->horarios_disponiveis = is_string($item->horarios_disponiveis) ? json_decode($item->horarios_disponiveis, true) : ($item->horarios_disponiveis ?? []);

                // 1. CÁLCULO DE VALORES E DESCONTOS
                $valorBase = floatval($item->valor_diaria ?: ($item->valor_mensal ?: $item->valor));
                $precoComDesconto = $valorBase;

                if ($item->tem_promocao && floatval($item->valor_desconto) > 0) {
                    if ($item->tipo_desconto === 'percentual') {
                        $precoComDesconto = $valorBase - ($valorBase * (floatval($item->valor_desconto) / 100));
                    } else {
                        $precoComDesconto = max(0, $valorBase - floatval($item->valor_desconto));
                    }
                }
                $item->preco_final_cliente = number_format($precoComDesconto, 2, '.', '');

                // 2. CÁLCULO INTELIGENTE DE VAGAS POR DATA
                $dataConsulta = $dataDesejada ?: Carbon::today()->toDateString();
                
                // Vagas padrão do item caso não haja sobreposição
                $vagasTotaisDia = intval($item->quantidade_padrao ?: ($item->quantidade ?: 1));
                
                // Se ele controla por data, procura no JSON para ver se hoje a quantidade é diferente
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

                // 3. Verifica as Reservas Ativas (Alugueis) que cruzam com esta data
                if ($item->relationLoaded('alugueis')) {
                    $reservasDoDia = $item->alugueis->filter(function($aluguel) use ($dataConsulta) {
                        $dataInicio = $aluguel->data_inicio ?? $aluguel->data_agendamento ?? null;
                        $dataFim = $aluguel->data_fim ?? $aluguel->data_inicio ?? $aluguel->data_agendamento ?? null;
                        
                        if (!$dataInicio) return false;
                        
                        return $dataInicio <= $dataConsulta && $dataFim >= $dataConsulta;
                    });

                    // Soma das vagas ocupadas na tabela `alugueis` daquele item
                    $vagasOcupadasDia = $reservasDoDia->sum(function($aluguel) {
                        return intval($aluguel->quantidade ?: 1);
                    });
                }

                $vagasLivresDia = max(0, $vagasTotaisDia - $vagasOcupadasDia);

                // 4. Processa Disponibilidade de Horários e Subtrai Vagas de Cada Horário
                $horariosProcessados = [];
                if ($item->disponibilidade_por_data && is_array($item->horarios_disponiveis)) {
                    foreach ($item->horarios_disponiveis as $horaConfig) {
                        if (($horaConfig['data'] ?? '') === $dataConsulta && !empty($horaConfig['horarios'])) {
                            foreach ($horaConfig['horarios'] as $h) {
                                $hInicio = $h['inicio'];
                                $hFim = $h['fim'];
                                $vagasTotaisHora = intval($h['quantidade'] ?? $vagasTotaisDia);
                                
                                // Olha se há aluguéis que esbarram dentro desse horário
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

                // 5. Encapsula o resultado para exibir o botão de reservar ou esgotado no Frontend
                $item->disponibilidade_hoje = [
                    'data' => $dataConsulta,
                    'tipo_medida' => $item->tipo_quantidade ?? 'vagas',
                    'vagas_totais' => $vagasTotaisDia,
                    'vagas_ocupadas' => $vagasOcupadasDia,
                    'vagas_livres' => $vagasLivresDia,
                    'horarios' => $horariosProcessados,
                    'status' => $vagasLivresDia > 0 ? 'disponivel' : 'esgotado'
                ];

                // ⚠️ SEGURANÇA: Remove as reservas da resposta JSON
                $item->unsetRelation('alugueis');

                return $item;
            });
        }

        return Inertia::render('Cliente/Explorar', [
            'estabelecimentos' => $estabelecimentos,
            'itens_aluguel'    => $itens,
            'filtros'          => $request->only([
                'tipo_busca', 'busca', 'categoria', 'data', 'preco_min', 
                'preco_max', 'apenas_promocoes', 'ordem', 'endereco_manual', 
                'latitude', 'longitude', 'raio_km'
            ])
        ]);
    }
}