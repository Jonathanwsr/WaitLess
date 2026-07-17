<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use App\Models\Estabelecimento;
use App\Models\ItemAluguel;
use App\Models\Agendamento;
use App\Models\Viagem;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class TravelAssistantController extends Controller
{
    /**
     * Busca inteligente principal que renderiza a tela com os dados combinados
     */
    public function searchDestination(Request $request)
    {
        $request->validate([
            'busca' => 'nullable|string|max:255',
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
            'raio_km' => 'nullable|integer|max:100',
            'dias' => 'nullable|integer|min:1',
            'pessoas' => 'nullable|integer|min:1',
            'orcamento_limite' => 'nullable|numeric|min:0',
        ]);

        // Sanitização estrita para evitar o erro de R$ NaN no Front-end
        $busca = $request->input('busca');
        $lat = $request->input('latitude');
        $lng = $request->input('longitude');
        $raio = (int) $request->input('raio_km', 20);
        $dias = (int) $request->input('dias', 1);
        $pessoas = (int) $request->input('pessoas', 1);
        $orcamentoLimite = $request->filled('orcamento_limite') ? (float) $request->input('orcamento_limite') : null;

        $destinoNome = $busca ?? 'Sua Localização';

        // 1. Buscar Estabelecimentos e Serviços Locais no Banco de Dados
        if ($lat && $lng) {
            $servicosLocais = $this->buscarServicosPorCoordenadas($lat, $lng, $raio);
            if ($servicosLocais->isNotEmpty()) {
                $destinoNome = $servicosLocais->first()->estabelecimento->cidade;
            }
        } else {
            $servicosLocais = $this->buscarServicosPorTermo($busca);
        }

        // 2. Acionar o Script de Roteiro Automático Baseado em Orçamento e Atributos se solicitado
        $roteiroMontado = null;
        if ($orcamentoLimite > 0) {
            $roteiroMontado = $this->gerarSugestaoRoteiroPorOrcamento($servicosLocais, $orcamentoLimite, $dias, $request);
        }

        // 3. Buscar imagens na Unsplash API (Tratado contra falhas/falta de chaves)
        $imagens = $this->buscarImagensUnsplash($destinoNome);

        // 4. Buscar informações turísticas na Wikipedia API
        $wikiInfo = $this->buscarInfoWikipedia($destinoNome);

        // 5. Gerar Orçamento Base Estimado (Garante casting de tipos para evitar NaN)
        $orcamento = $this->gerarOrcamentoEstimado($dias, $pessoas, $servicosLocais);

        // 6. Buscar reservas ativas do usuário logado
        $reservasUsuario = [];
        if (Auth::check()) {
            $reservasUsuario = $this->buscarReservasUsuario(Auth::id(), $destinoNome);
        }

        return Inertia::render('Cliente/TravelAssistant', [
            'destino_detectado' => (string) $destinoNome,
            'coordenadas_pesquisadas' => ($lat && $lng) ? ['lat' => (float)$lat, 'lng' => (float)$lng] : null,
            'resumo_wikipedia' => $wikiInfo,
            'galeria_unsplash' => $imagens,
            'recomendacoes_locais' => $servicosLocais,
            'orcamento_estimado' => $orcamento,
            'roteiro_automatico' => $roteiroMontado,
            'minhas_reservas' => $reservasUsuario,
            'filtros_aplicados' => [
                'dias' => $dias,
                'pessoas' => $pessoas,
                'orcamento_limite' => $orcamentoLimite
            ]
        ]);
    }

    /**
     * SCRIPT: Inteligência que monta a viagem filtrando as colunas específicas do banco
     */
    private function gerarSugestaoRoteiroPorOrcamento(
    $servicos,
    float $orcamentoMaximo,
    int $dias,
    Request $request
) {

    $itensDisponiveis = $servicos
        ->filter(function ($item) use ($request) {

            if (!$item->ativo) {
                return false;
            }

            if (isset($item->disponivel) && !$item->disponivel) {
                return false;
            }

            if ($request->boolean('mobiliado') && !$item->mobiliado) {
                return false;
            }

            if ($request->boolean('aceita_pet') && !$item->aceita_pet) {
                return false;
            }

            if ($request->boolean('possui_wifi') && !$item->possui_wifi) {
                return false;
            }

            if ($request->boolean('possui_ar_condicionado') && !$item->possui_ar_condicionado) {
                return false;
            }

            if ($request->boolean('piscina') && !$item->piscina) {
                return false;
            }

            if ($request->boolean('churrasqueira') && !$item->churrasqueira) {
                return false;
            }

            return true;
        })

        ->map(function ($item) {

            $avaliacao = $item->media_avaliacao ?? 4;
            $qtdAvaliacoes = $item->total_avaliacoes ?? 0;
            $valor = max((float)$item->valor_diaria, 1);

            /*
             |---------------------------------------------------------
             | Score do custo-benefício
             |---------------------------------------------------------
             */

            $score =
                ($avaliacao * 40) +
                (min($qtdAvaliacoes, 100) * 0.2) +
                (1000 / $valor);

            $item->score_waitless = round($score, 2);

            return $item;
        })

        ->sortByDesc('score_waitless')
        ->values();

    $selecionados = [];
    $custoTotal = 0;

    $categoriasSelecionadas = [];

    foreach ($itensDisponiveis as $item) {

        $categoria = $item->categoria;

        /*
        |----------------------------------------------------------
        | Evita sugerir vários itens iguais
        | Ex.: duas hospedagens
        |----------------------------------------------------------
        */

        if (isset($categoriasSelecionadas[$categoria])) {
            continue;
        }

        $custoItem = (float)$item->valor_diaria * $dias;

        if (($custoTotal + $custoItem) > $orcamentoMaximo) {
            continue;
        }

        $categoriasSelecionadas[$categoria] = true;

        $custoTotal += $custoItem;

        $selecionados[] = [

            'id' => $item->id,

            'nome' => $item->nome,

            'categoria' => $categoria,

            'valor_diaria' => (float)$item->valor_diaria,

            'dias' => $dias,

            'custo_total_periodo' => round($custoItem,2),

            'score' => $item->score_waitless,

            'avaliacao_media' => $item->media_avaliacao,

            'total_avaliacoes' => $item->total_avaliacoes,

            'estabelecimento' => optional($item->estabelecimento)->nome,

            'cidade' => $item->cidade,

            'estado' => $item->estado,

            'endereco' => $item->endereco,

            'latitude' => $item->latitude,

            'longitude' => $item->longitude,

            'recursos' => $item->recursos_oferecidos ?? [],

            'economia' => round(
                $orcamentoMaximo - ($custoTotal),
                2
            )
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Resumo
    |--------------------------------------------------------------------------
    */

    return [

        'orcamento_maximo_usuario' => round($orcamentoMaximo,2),

        'dias' => $dias,

        'total_gasto_pelo_script' => round($custoTotal,2),

        'saldo_restante' => round(
            $orcamentoMaximo - $custoTotal,
            2
        ),

        'percentual_do_orcamento_utilizado' => round(
            ($custoTotal / max($orcamentoMaximo,1)) * 100,
            2
        ),

        'quantidade_itens' => count($selecionados),

        'categorias_selecionadas' => array_keys($categoriasSelecionadas),

        'itens_sugeridos' => $selecionados

    ];
}
    /**
     * BUSCA 1A: Haversine GPS
     */
    private function buscarServicosPorCoordenadas($lat, $lng, $raio)
    {
        $estabelecimentosProximos = Estabelecimento::select('id', 'nome', 'cidade', 'estado', 'latitude', 'longitude')
            ->selectRaw(
                '(6371 * acos(cos(radians(?)) * cos(radians(latitude)) * cos(radians(longitude) - radians(?)) + sin(radians(?)) * sin(radians(latitude)))) AS distancia',
                [$lat, $lng, $lat]
            )
            ->having('distancia', '<=', $raio)
            ->orderBy('distancia')
            ->pluck('id');

        if ($estabelecimentosProximos->isEmpty()) {
            return collect();
        }

        return ItemAluguel::with('estabelecimento:id,nome,endereco,cidade,estado,latitude,longitude,foto_perfil')
            ->whereIn('estabelecimento_id', $estabelecimentosProximos)
            ->where('ativo', true)
            ->get();
    }

    /**
     * BUSCA 1B: Termo de texto textual
     */
    private function buscarServicosPorTermo($termo)
    {
        if (!$termo) return collect();

        $likeTermo = '%' . $termo . '%';

        return ItemAluguel::with('estabelecimento:id,nome,endereco,cidade,estado,latitude,longitude,foto_perfil')
            ->where('ativo', true)
            ->where(function ($query) use ($likeTermo) {
                $query->where('nome', 'like', $likeTermo)
                      ->orWhere('categoria', 'like', $likeTermo)
                      ->orWhereHas('estabelecimento', function ($q) use ($likeTermo) {
                          $q->where('cidade', 'like', $likeTermo)
                            ->orWhere('estado', 'like', $likeTermo)
                            ->orWhere('nome', 'like', $likeTermo)
                            ->orWhere('bairro', 'like', $likeTermo);
                      });
            })
            ->take(15)
            ->get();
    }

    /**
     * Unsplash API com fallback de imagens caso o termo resulte vazio ou sem token
     */
    private function buscarImagensUnsplash($local)
    {
        $accessKey = env('UNSPLASH_ACCESS_KEY');
        if (!$accessKey) {
            return [[
                'url' => 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200',
                'descricao' => 'Praia Padrão (Configure sua UNSPLASH_ACCESS_KEY no .env)',
                'autor' => 'Inertia System'
            ]];
        }

        $response = Http::get("https://api.unsplash.com/search/photos", [
            'query' => $local . ' turismo',
            'client_id' => $accessKey,
            'per_page' => 6,
            'orientation' => 'landscape'
        ]);

        if ($response->successful() && count($response->json()['results']) > 0) {
            return collect($response->json()['results'])->map(function ($img) {
                return [
                    'url' => (string) $img['urls']['regular'],
                    'descricao' => (string) ($img['alt_description'] ?? 'Foto de ' . $img['user']['name']),
                    'autor' => (string) $img['user']['name']
                ];
            })->all();
        }

        return [[
            'url' => 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200',
            'descricao' => 'Nenhuma imagem específica encontrada para ' . $local,
            'autor' => 'Unsplash Fallback'
        ]];
    }

    /**
     * Wikipedia API com tratamento de string
     */
    private function buscarInfoWikipedia($local)
    {
        $response = Http::withHeaders([
            'User-Agent' => 'WaitlessApp/1.0 (contato@seusite.com)'
        ])->get("https://pt.wikipedia.org/api/rest_v1/page/summary/" . urlencode($local));

        if ($response->successful()) {
            $data = $response->json();
            return [
                'titulo' => (string) ($data['title'] ?? $local),
                'resumo' => (string) ($data['extract'] ?? 'Nenhum resumo detalhado disponível no momento.'),
                'link' => (string) ($data['content_urls']['desktop']['page'] ?? ''),
                'foto_destaque' => $data['thumbnail']['source'] ?? null
            ];
        }

        return [
            'titulo' => $local,
            'resumo' => 'Explore o melhor que ' . $local . ' tem a oferecer através das recomendações da comunidade.',
            'link' => '',
            'foto_destaque' => null
        ];
    }

    /**
     * Força a conversão matemática estrita de floats para resolver o erro R$ NaN
     */
    private function gerarOrcamentoEstimado($dias, $pessoas, $servicosLocais)
    {
        $custoAlimentacaoDiario = 110.00; 
        $custoTransporteDiario = 45.00;

        $totalAlimentacao = (float)($custoAlimentacaoDiario * $dias * $pessoas);
        $totalTransporte = (float)($custoTransporteDiario * $dias * $pessoas);

        $mediaPrecoServicos = $servicosLocais->avg('valor_diaria') ?? 120.00;
        $totalPasseios = (float)($mediaPrecoServicos * $dias);

        return [
            'dias' => (int) $dias,
            'pessoas' => (int) $pessoas,
            'itens_orcamento' => [
                ['categoria' => 'Alimentação', 'valor_total' => $totalAlimentacao],
                ['categoria' => 'Transporte', 'valor_total' => $totalTransporte],
                ['categoria' => 'Passeios e Aluguéis Locais (Estimativa)', 'valor_total' => $totalPasseios],
            ],
            'total_estimado' => (float)($totalAlimentacao + $totalTransporte + $totalPasseios)
        ];
    }

    private function buscarReservasUsuario($userId, $local)
    {
        return Agendamento::with(['estabelecimento', 'servico'])
            ->where('usuario_id', $userId)
            ->whereHas('estabelecimento', function ($query) use ($local) {
                $query->where('cidade', 'like', "%{$local}%")
                      ->orWhere('estado', 'like', "%{$local}%");
            })
            ->get();
    }

    /**
     * SALVAR COMPLETO: Agora salva de forma completa cruzando os dados de infraestrutura mapeados
     */
    public function criarViagem(Request $request)
    {
        $dados = $request->validate([
            'titulo' => 'required|string|max:255',
            'destino' => 'required|string|max:255',
            'data_inicio' => 'required|date',
            'data_fim' => 'required|date|after_or_equal:data_inicio',
            'orcamento_limite' => 'nullable|numeric',
            'gastos_planejados' => 'nullable|array',
            'quantidade_pessoas' => 'nullable|integer|min:1',
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
            // Novos campos estruturais para persistir tudo das tabelas acessadas
            'detalhes_infraestrutura' => 'nullable|array',
            'itens_vinculados' => 'nullable|array' 
        ]);

        $dados['criador_id'] = Auth::id();
        
        $inicio = new \DateTime($dados['data_inicio']);
        $fim = new \DateTime($dados['data_fim']);
        $dados['total_dias'] = $inicio->diff($fim)->days + 1;

        // Garante a gravação em formato stringificado das matrizes dinâmicas JSON do banco
        $dados['gastos_planejados'] = json_encode($dados['gastos_planejados'] ?? []);
        
        // Se a sua tabela possuir colunas extras text/json, persista-as aqui:
        if (isset($dados['detalhes_infraestrutura'])) {
            $dados['detalhes_infraestrutura'] = json_encode($dados['detalhes_infraestrutura']);
        }

        $viagem = Viagem::create($dados);

        // Vincula o criador na tabela pivô automaticamente
        $viagem->membros()->attach(Auth::id(), ['funcao' => 'criador']);

        // Se houverem itens recomendados salvos juntos na hora do submit, vincula-os
        if (!empty($request->input('itens_vinculados'))) {
            foreach ($request->input('itens_vinculados') as $itemId) {
                // Caso use tabela pivot entre viagens e itens de aluguel:
                if (method_exists($viagem, 'itensAluguel')) {
                    $viagem->itensAluguel()->attach($itemId);
                }
            }
        }

        return response()->json([
            'message' => 'Viagem planejada e salva com sucesso!',
            'viagem' => $viagem
        ], 210);
    }

    public function listarMinhasViagens()
    {
        $usuario = Auth::user();

        $viagens = Viagem::where('criador_id', $usuario->id)
            ->orWhereHas('membros', function ($query) use ($usuario) {
                $query->where('usuario_id', $usuario->id);
            })
            ->with('membros:id,name,email')
            ->get()
            ->map(function ($viagem) {
                $viagem->gastos_planejados = json_decode($viagem->gastos_planejados) ?? [];
                return $viagem;
            });

        return response()->json($viagens);
    }

    public function adicionarMembroPorEmail(Request $request, $viagemId)
    {
        $request->validate([
            'email' => 'required|email|exists:users,email'
        ]);

        $viagem = Viagem::findOrFail($viagemId);

        if ($viagem->criador_id !== Auth::id()) {
            $permissao = $viagem->membros()->where('usuario_id', Auth::id())->first();
            if (!$permissao || $permissao->pivot->funcao !== 'editor') {
                return response()->json(['message' => 'Você não tem permissão.'], 403);
            }
        }

        $novoMembro = User::where('email', $request->email)->first();

        if ($viagem->membros()->where('usuario_id', $novoMembro->id)->exists()) {
            return response()->json(['message' => 'Este usuário já está participando desta viagem.'], 400);
        }

        $viagem->membros()->attach($novoMembro->id, ['funcao' => 'editor']);

        return response()->json([
            'message' => 'Amigo adicionado à viagem com sucesso!',
            'membro' => [
                'id' => $novoMembro->id,
                'name' => $novoMembro->name,
                'email' => $novoMembro->email
            ]
        ]);
    }

    /**
     * NOVO ENDPOINT DINÂMICO: Busca detalhes de um ponto turístico/local específico clicado
     * Cruzando com os serviços e itens de aluguel disponíveis no seu Banco de Dados
     */
    public function getPlaceDetails(Request $request)
    {
        $request->validate([
            'nome_local' => 'required|string|max:255',
            'cidade' => 'nullable|string|max:255'
        ]);

        $nomeLocal = $request->input('nome_local');
        $cidade = $request->input('cidade');

        // 1. Busca história/dados do local na Wikipedia
        $wiki = $this->buscarInfoWikipedia($nomeLocal);

        // 2. Busca fotos exclusivas do local no Unsplash
        $imagens = $this->buscarImagensUnsplash($nomeLocal);

        // 3. Busca se existem serviços/itens de aluguel no banco de dados vinculados a este local
        // Ele busca pelo nome do local ou pela categoria correspondente
        $servicosNoApp = ItemAluguel::with('estabelecimento:id,nome,endereco,cidade,estado,latitude,longitude,foto_perfil')
            ->where('ativo', true)
            ->where(function ($query) use ($nomeLocal, $cidade) {
                $query->where('nome', 'like', "%{$nomeLocal}%")
                      ->orWhere('categoria', 'like', "%{$nomeLocal}%")
                      ->orWhereHas('estabelecimento', function ($q) use ($nomeLocal, $cidade) {
                          $q->where('nome', 'like', "%{$nomeLocal}%")
                            ->orWhere('cidade', 'like', "%{$nomeLocal}%")
                            ->orWhere('bairro', 'like', "%{$nomeLocal}%");
                      });
            })
            ->take(6)
            ->get();

        return response()->json([
            'nome' => $nomeLocal,
            'wikipedia' => $wiki,
            'galeria' => $imagens,
            'servicos_disponiveis_app' => $servicosNoApp
        ]);
    }
}