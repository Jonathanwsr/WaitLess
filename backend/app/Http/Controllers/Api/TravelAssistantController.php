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

class TravelAssistantController extends Controller
{
    /**
     * Busca inteligente: aceita termo de busca flexível OU geolocalização do usuário
     */
    public function searchDestination(Request $request)
    {
        $request->validate([
            'busca' => 'nullable|string|max:255', // Termo digitado (Ex: Maceió, Alagoas, Praia de Ponta Verde)
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
            'raio_km' => 'nullable|integer|max:100', // Raio de busca por GPS (padrão 20km)
            'dias' => 'nullable|integer|min:1',
            'pessoas' => 'nullable|integer|min:1',
        ]);

        $busca = $request->input('busca');
        $lat = $request->input('latitude');
        $lng = $request->input('longitude');
        $raio = $request->input('raio_km', 20);
        $dias = $request->input('dias', 1);
        $pessoas = $request->input('pessoas', 1);

        $destinoNome = $busca ?? 'Sua Localização';

        // 1. Buscar Estabelecimentos e Serviços Locais no Banco de Dados (Geolocalização vs Busca Escrita)
        if ($lat && $lng) {
            $servicosLocais = $this->buscarServicosPorCoordenadas($lat, $lng, $raio);
            // Se buscou por GPS, tenta descobrir o nome da cidade mais próxima cadastrada no BD para usar nas APIs
            if ($servicosLocais->isNotEmpty()) {
                $destinoNome = $servicosLocais->first()->estabelecimento->cidade;
            }
        } else {
            $servicosLocais = $this->buscarServicosPorTermo($busca);
        }

        // 2. Buscar imagens na Unsplash API (baseado no nome do destino)
        $imagens = $this->buscarImagensUnsplash($destinoNome);

        // 3. Buscar informações turísticas na Wikipedia API
        $wikiInfo = $this->buscarInfoWikipedia($destinoNome);

        // 4. Gerar Orçamento Base Estimado
        $orcamento = $this->gerarOrcamentoEstimado($dias, $pessoas, $servicosLocais);

        // 5. Buscar reservas ativas do usuário logado relacionadas a essa região/busca
        $reservasUsuario = [];
        if (Auth::check()) {
            $reservasUsuario = $this->buscarReservasUsuario(Auth::id(), $destinoNome);
        }

        return response()->json([
            'destino_detectado' => $destinoNome,
            'coordenadas_pesquisadas' => ($lat && $lng) ? ['lat' => $lat, 'lng' => $lng] : null,
            'resumo_wikipedia' => $wikiInfo,
            'galeria_unsplash' => $imagens,
            'recomendacoes_locais' => $servicosLocais,
            'orcamento_estimado' => $orcamento,
            'minhas_reservas' => $reservasUsuario,
        ]);
    }

    /**
     * BUSCA 1A: Busca serviços próximos usando a fórmula de Haversine (GPS)
     */
    private function buscarServicosPorCoordenadas($lat, $lng, $raio)
    {
        // Encontra estabelecimentos próximos às coordenadas geográficas informadas
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

        // Retorna os itens de aluguel associados a esses estabelecimentos próximos
        return ItemAluguel::with('estabelecimento:id,nome,endereco,cidade,estado,latitude,longitude,foto_perfil')
            ->whereIn('estabelecimento_id', $estabelecimentosProximos)
            ->where('ativo', true)
            ->get();
    }

    /**
     * BUSCA 1B: Busca inteligente por texto (Cidade, Estado, País ou Nome do Item/Local)
     */
    private function buscarServicosPorTermo($termo)
    {
        if (!$termo) return collect();

        $likeTermo = '%' . $termo . '%';

        return ItemAluguel::with('estabelecimento:id,nome,endereco,cidade,estado,latitude,longitude,foto_perfil')
            ->where('ativo', true)
            ->where(function ($query) use ($likeTermo) {
                // Filtra pelo nome do serviço/aluguel
                $query->where('nome', 'like', $likeTermo)
                      ->orWhere('categoria', 'like', $likeTermo)
                      // Ou pelas colunas do Estabelecimento parceiro (cidade, estado, cep, país...)
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
     * Unsplash API
     */
    private function buscarImagensUnsplash($local)
    {
        $accessKey = env('UNSPLASH_ACCESS_KEY');
        if (!$accessKey) return [];

        $response = Http::get("https://api.unsplash.com/search/photos", [
            'query' => $local . ' turismo',
            'client_id' => $accessKey,
            'per_page' => 6,
            'orientation' => 'landscape'
        ]);

        if ($response->successful()) {
            return collect($response->json()['results'])->map(function ($img) {
                return [
                    'url' => $img['urls']['regular'],
                    'descricao' => $img['alt_description'] ?? 'Foto de ' . $img['user']['name'],
                    'autor' => $img['user']['name']
                ];
            });
        }
        return [];
    }

    /**
     * Wikipedia API
     */
    private function buscarInfoWikipedia($local)
    {
        $response = Http::withHeaders([
            'User-Agent' => 'WaitlessApp/1.0 (contato@seusite.com)'
        ])->get("https://pt.wikipedia.org/api/rest_v1/page/summary/" . urlencode($local));

        if ($response->successful()) {
            $data = $response->json();
            return [
                'titulo' => $data['title'] ?? $local,
                'resumo' => $data['extract'] ?? 'Nenhum resumo detalhado disponível no momento.',
                'link' => $data['content_urls']['desktop']['page'] ?? '',
                'foto_destaque' => $data['thumbnail']['source'] ?? null
            ];
        }
        return null;
    }

    /**
     * Gera Orçamento Inteligente Baseado na Realidade do Banco de Dados
     */
    private function gerarOrcamentoEstimado($dias, $pessoas, $servicosLocais)
    {
        $custoAlimentacaoDiario = 110.00; // Base média
        $custoTransporteDiario = 45.00;

        $totalAlimentacao = $custoAlimentacaoDiario * $dias * $pessoas;
        $totalTransporte = $custoTransporteDiario * $dias * $pessoas;

        // Calcula a média dos serviços de aluguel disponíveis na região buscada
        $mediaPrecoServicos = $servicosLocais->avg('valor_diaria') ?? 120.00;
        $totalPasseios = $mediaPrecoServicos * $dias;

        return [
            'dias' => $dias,
            'pessoas' => $pessoas,
            'itens_orcamento' => [
                ['categoria' => 'Alimentação', 'valor_total' => $totalAlimentacao],
                ['categoria' => 'Transporte', 'valor_total' => $totalTransporte],
                ['categoria' => 'Passeios e Aluguéis Locais (Estimativa)', 'valor_total' => $totalPasseios],
            ],
            'total_estimado' => $totalAlimentacao + $totalTransporte + $totalPasseios
        ];
    }

    /**
     * Busca reservas antigas/ativas na localidade buscada
     */
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

    /* --------------------------------------------------------------------------
     * 👥 SISTEMA COOPERATIVO DE PLANEJAMENTO DE VIAGEM (CRUD & COLABORADORES)
     * -------------------------------------------------------------------------- */

    /**
     * Cria uma nova viagem/roteiro
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
        ]);

        $dados['criador_id'] = Auth::id();
        
        // Calcula a diferença de dias
        $inicio = new \DateTime($dados['data_inicio']);
        $fim = new \DateTime($dados['data_fim']);
        $dados['total_dias'] = $inicio->diff($fim)->days + 1;

        // Trata os gastos planejados rápidos vindos em array
        $dados['gastos_planejados'] = json_encode($dados['gastos_planejados'] ?? []);

        $viagem = Viagem::create($dados);

        // Adiciona o criador automaticamente como membro com função de criador
        $viagem->membros()->attach(Auth::id(), ['funcao' => 'criador']);

        return response()->json([
            'message' => 'Viagem planejada com sucesso!',
            'viagem' => $viagem
        ], 210);
    }

    /**
     * Lista as viagens ativas que o usuário logado participa ou criou
     */
    public function listarMinhasViagens()
    {
        $usuario = Auth::user();

        // Busca as viagens onde ele é criador ou onde ele está na tabela pivô
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

    /**
     * Convida um amigo/usuário para a viagem usando o e-mail dele
     */
    public function adicionarMembroPorEmail(Request $request, $viagemId)
    {
        $request->validate([
            'email' => 'required|email|exists:users,email'
        ]);

        $viagem = Viagem::findOrFail($viagemId);

        // Garante que apenas o criador ou editor da viagem pode convidar outros membros
        if ($viagem->criador_id !== Auth::id()) {
            $permissao = $viagem->membros()->where('usuario_id', Auth::id())->first();
            if (!$permissao || $permissao->pivot->funcao !== 'editor') {
                return response()->json(['message' => 'Você não tem permissão para adicionar pessoas a essa viagem.'], 403);
            }
        }

        $novoMembro = User::where('email', $request->email)->first();

        // Evita duplicar o membro na viagem
        if ($viagem->membros()->where('usuario_id', $novoMembro->id)->exists()) {
            return response()->json(['message' => 'Este usuário já está participando desta viagem.'], 400);
        }

        // Vincula o amigo à viagem
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
}