<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Models\Estabelecimento;
use App\Models\ItemAluguel;
use App\Models\Promocao;
use App\Models\Servico;
use App\Models\Produto;
use App\Services\PlanoService;
use App\Services\DestaquePremiumService;
use App\Services\AreasExplorar;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Exception;

class ClienteExplorarMobileController extends Controller
{
    /** Até essa distância um resultado conta como "perto de você" (cidade e arredores). */
    private const RAIO_PERTO_KM = 30;

    private function calcularValorComDesconto(float $valorBase, bool $temPromocao, ?string $tipoDesconto, $valorDesconto): float
    {
        if (!$temPromocao || !$valorDesconto) return $valorBase;

        $desconto = (float) $valorDesconto;
        $valorFinal = $tipoDesconto === 'fixo'
            ? $valorBase - $desconto
            : $valorBase - ($valorBase * $desconto / 100);

        return max(0, round($valorFinal, 2));
    }

    /**
     * GET /explorar/ofertas-premium
     * Serviços, reservas e produtos exclusivos/com desconto para o app. Usuários
     * não Premium recebem a mesma lista com `bloqueado: true`, para mostrar o
     * que estão perdendo e incentivar a assinatura (diferenciação por plano).
     */
    public function ofertasPremium(Request $request, PlanoService $planoService)
    {
        try {
            $user = Auth::user();
            $isPremium = $user && in_array($user->plano_assinatura, $planoService->planosPermitidos('user'), true);

            // Servico::estabelecimento() aponta para Estabelecimento (coluna "nome"), enquanto
            // ItemAluguel::estabelecimento() aponta para User (coluna "name") — selects diferentes
            // por tabela, com alias para "name" para o app ler um campo único e consistente.
            $servicos = Servico::with(['estabelecimento' => function ($q) {
                    $q->select('id', 'nome as name', 'foto_perfil', 'cidade', 'estado');
                }])
                ->where('ativo', true)
                ->where(function ($q) { $q->where('somente_premium', true)->orWhere('tem_promocao', true); })
                ->latest()
                ->get()
                ->map(function ($s) {
                    return [
                        'id' => $s->id, 'tipo' => 'servico', 'nome' => $s->nome, 'descricao' => $s->descricao,
                        'fotos' => $s->fotos, 'estabelecimento' => $s->estabelecimento,
                        'somente_premium' => (bool) $s->somente_premium, 'tem_promocao' => (bool) $s->tem_promocao,
                        'aceita_pontos' => (bool) $s->aceita_pontos, 'maximo_pontos_permitidos' => $s->maximo_pontos_permitidos,
                        'valor_original' => (float) $s->valor,
                        'valor_com_desconto' => $this->calcularValorComDesconto((float) $s->valor, (bool) $s->tem_promocao, $s->tipo_desconto, $s->valor_desconto),
                    ];
                });

            $itensAluguel = ItemAluguel::with(['estabelecimento' => function ($q) {
                    $q->select('id', 'name', 'foto_perfil', 'cidade', 'estado');
                }])
                ->where('ativo', true)
                ->where(function ($q) { $q->where('somente_premium', true)->orWhere('tem_promocao', true); })
                ->latest()
                ->get()
                ->map(function ($item) {
                    $base = (float) ($item->valor_diaria ?? 0);
                    return [
                        'id' => $item->id, 'tipo' => 'reserva', 'nome' => $item->nome, 'categoria' => $item->categoria,
                        'descricao' => $item->descricao, 'fotos' => $item->fotos, 'estabelecimento' => $item->estabelecimento,
                        'somente_premium' => (bool) $item->somente_premium, 'tem_promocao' => (bool) $item->tem_promocao,
                        'aceita_pontos' => (bool) $item->aceita_pontos, 'maximo_pontos_permitidos' => $item->maximo_pontos_permitidos,
                        'valor_original' => $base,
                        'valor_com_desconto' => $this->calcularValorComDesconto($base, (bool) $item->tem_promocao, $item->tipo_desconto, $item->valor_desconto),
                    ];
                });

            $produtos = Produto::with(['estabelecimento' => function ($q) {
                    $q->select('id', 'nome as name', 'foto_perfil', 'cidade', 'estado');
                }])
                ->where('estoque_disponivel', '>', 0)
                ->where(function ($q) { $q->where('somente_premium', true)->orWhere('is_promocao', true); })
                ->latest()
                ->get()
                ->map(function ($p) {
                    return [
                        'id' => $p->id, 'tipo' => 'produto', 'nome' => $p->nome, 'descricao' => $p->descricao,
                        'fotos' => Produto::decodeFotos($p->fotos), 'estabelecimento' => $p->estabelecimento,
                        'somente_premium' => (bool) $p->somente_premium, 'tem_promocao' => (bool) $p->is_promocao,
                        'valor_original' => (float) $p->valor_normal, 'valor_com_desconto' => (float) $p->valor_final,
                    ];
                });

            $marcar = function ($colecao) use ($isPremium) {
                return $colecao->map(function ($oferta) use ($isPremium) {
                    $oferta['bloqueado'] = $oferta['somente_premium'] && !$isPremium;
                    if ($oferta['bloqueado']) {
                        $oferta['valor_com_desconto'] = $oferta['valor_original'];
                    }
                    return $oferta;
                })->values();
            };

            return response()->json([
                'status' => 'success',
                'isPremium' => $isPremium,
                'planoAtual' => $user->plano_assinatura ?? null,
                'servicos' => $marcar($servicos),
                'itensAluguel' => $marcar($itensAluguel),
                'produtos' => $marcar($produtos),
            ]);
        } catch (Exception $e) {
            Log::error('[ClienteExplorarMobileController] ofertasPremium: ' . $e->getMessage(), ['exception' => $e]);
            return response()->json([
                'status' => 'error',
                'message' => 'Não foi possível carregar as ofertas agora. Tente novamente em instantes.',
            ], 500);
        }
    }

    /**
     * 🔍 EXPLORAR — busca com filtros e ordenação.
     *
     * tipo_busca: estabelecimentos | servicos | reservas
     * Filtros: busca, categoria, area (hoteis|casas|lugares|passeios|veiculos), preco_min, preco_max,
     *          nota_min, com_promocao, so_premium, sem_espera (locais), origem=avulsa (reservas direto com o dono), lat/lng
     * Local: cidade (mostra só o que existe nela) + fallback_geral=1 (se não houver nada na cidade, mostra o sistema todo
     *        e devolve meta.escopo = "geral")
     * ordem: relevancia (padrão: donos premium primeiro, depois melhor avaliados) |
     *        preco_asc | preco_desc | avaliacao | distancia | recentes
     */
    public function index(Request $request, DestaquePremiumService $premium)
    {
        $tipoBusca = $request->input('tipo_busca', 'estabelecimentos');
        $busca = $request->filled('busca') ? strip_tags(trim($request->input('busca'))) : null;
        $categoria = $request->filled('categoria') ? strip_tags(trim($request->input('categoria'))) : null;
        $area = $request->filled('area') && AreasExplorar::existe($request->input('area')) ? $request->input('area') : null;
        $cidade = $request->filled('cidade') ? strip_tags(trim($request->input('cidade'))) : null;
        $estado = $request->filled('estado') ? strtoupper(substr(trim($request->input('estado')), 0, 2)) : null;
        $ordem = $request->input('ordem', 'relevancia');
        $precoMin = $request->filled('preco_min') ? (float) $request->input('preco_min') : null;
        $precoMax = $request->filled('preco_max') ? (float) $request->input('preco_max') : null;
        $notaMin = $request->filled('nota_min') ? (float) $request->input('nota_min') : null;
        $soPromocao = $request->boolean('com_promocao');
        $soPremium = $request->boolean('so_premium');
        $semEspera = $request->boolean('sem_espera');
        $soAvulsas = $request->input('origem') === 'avulsa';
        $lat = $request->filled('lat') ? (float) $request->input('lat') : null;
        $lng = $request->filled('lng') ? (float) $request->input('lng') : null;
        $page = max(1, (int) $request->input('page', 1));
        $perPage = min(30, max(5, (int) $request->input('per_page', 15)));

        $termosTudo = ['tudo', 'todos', 'todas', ''];
        $categoriaFiltro = $categoria && !in_array(strtolower($categoria), $termosTudo) ? $categoria : null;

        $usuarioLogado = Auth::user();
        $clienteEhPremium = $usuarioLogado && $usuarioLogado->isPremium();

        if (!in_array($tipoBusca, ['estabelecimentos', 'servicos', 'reservas'], true)) {
            return response()->json(['data' => []]);
        }

        // Monta a lista completa (todas as cidades) e depois aplica filtros; assim dá para reaproveitá-la no fallback.
        $base = match ($tipoBusca) {
            'estabelecimentos' => $this->listarEstabelecimentos($premium, $busca, $categoriaFiltro, $lat, $lng),
            'servicos' => $this->listarServicos($premium, $busca, $categoriaFiltro, $lat, $lng, $clienteEhPremium),
            default => $this->listarReservas($premium, $busca, $categoriaFiltro, $clienteEhPremium, $lat, $lng),
        };

        $filtrar = function ($lista) use ($tipoBusca, $area, $precoMin, $precoMax, $notaMin, $soPromocao, $soPremium, $semEspera, $soAvulsas) {
            if ($area) {
                $lista = $lista->filter(fn ($i) => $tipoBusca === 'reservas'
                    ? in_array($i['categoria'] ?? null, AreasExplorar::categorias($area), true)
                    : AreasExplorar::ramoPertence($i['ramo_atuacao'] ?? null, $area));
            }
            if ($precoMin !== null) $lista = $lista->filter(fn ($i) => (float) $i['valor'] >= $precoMin);
            if ($precoMax !== null) $lista = $lista->filter(fn ($i) => (float) $i['valor'] <= $precoMax);
            if ($notaMin !== null) $lista = $lista->filter(fn ($i) => (float) ($i['avaliacao_media'] ?? 0) >= $notaMin);
            if ($soPromocao) $lista = $lista->filter(fn ($i) => !empty($i['tem_promocao']));
            if ($soPremium) $lista = $lista->filter(fn ($i) => !empty($i['destaque_premium']));
            if ($semEspera && $tipoBusca === 'estabelecimentos') $lista = $lista->filter(fn ($i) => empty($i['fila_atual']));
            if ($soAvulsas && $tipoBusca === 'reservas') $lista = $lista->filter(fn ($i) => !empty($i['direto_dono']));

            return $lista;
        };

        $lista = $filtrar($base);
        if ($estado) {
            $lista = $lista->filter(fn ($i) => strtoupper(trim((string) ($i['estado'] ?? ''))) === $estado);
        }
        $escopo = 'geral';

        if ($cidade) {
            $local = $lista->filter(fn ($i) => AreasExplorar::mesmaCidade($cidade, $i['cidade'] ?? null));
            if ($local->isNotEmpty() || !$request->boolean('fallback_geral')) {
                $lista = $local;
                $escopo = 'local';
            }
            // Sem nada na cidade e com fallback: segue com a lista geral, avisando o app.
        }

        $pertoPrimeiro = $lat !== null && $lng !== null && !$estado && !$cidade;
        $perto = $pertoPrimeiro ? $lista->filter(fn ($i) => isset($i['distancia']) && $i['distancia'] !== null && $i['distancia'] <= self::RAIO_PERTO_KM)->count() : 0;

        $lista = match ($ordem) {
            'preco_asc' => $lista->sortBy(fn ($i) => (float) $i['valor']),
            'preco_desc' => $lista->sortByDesc(fn ($i) => (float) $i['valor']),
            'avaliacao' => $lista->sortByDesc(fn ($i) => (float) $i['avaliacao_media']),
            'distancia' => $lista->sortBy(fn ($i) => $i['distancia'] ?? PHP_INT_MAX),
            'recentes' => $lista->sortByDesc(fn ($i) => $i['created_at'] ?? ''),
            // Relevância: donos premium primeiro, depois quem aceita pontos, depois quem aceita pagamento
            // online (e, em cada grupo, online antes), depois nota e volume de avaliações. Mesma regra da web.
            // Para quem está viajando: o que fica perto (até RAIO_PERTO_KM) vem primeiro; o ranking continua
            // valendo dentro de cada bloco. Só quando o app mandou a localização e não há filtro de estado.
            default => $lista->sort(function ($a, $b) use ($pertoPrimeiro) {
                $chave = fn ($i) => [
                    (int) ($pertoPrimeiro && isset($i['distancia']) && $i['distancia'] !== null && $i['distancia'] <= self::RAIO_PERTO_KM),
                    (int) !empty($i['destaque_premium']),
                    (int) (($i['destaque_pontos'] ?? 0) > 0),
                    (int) !empty($i['aceita_pagamento_online']),
                    (int) ($i['destaque_pontos'] ?? 0),
                    (float) $i['avaliacao_media'],
                    (int) ($i['total_avaliacoes'] ?? 0),
                ];

                return $chave($b) <=> $chave($a);
            }),
        };

        $lista = $lista->values();
        $total = $lista->count();
        $itensDaPagina = $lista->slice(($page - 1) * $perPage, $perPage)->values();

        $paginador = new \Illuminate\Pagination\LengthAwarePaginator($itensDaPagina, $total, $perPage, $page);

        return response()->json(array_merge($paginador->toArray(), [
            'meta' => [
                'tem_premium' => $lista->contains(fn ($i) => !empty($i['destaque_premium'])),
                // Quantos resultados ficam perto de quem está buscando (o app mostra "X perto de você").
                'perto_de_voce' => $perto,
                'raio_perto_km' => self::RAIO_PERTO_KM,
                'ordem' => $ordem,
                'escopo' => $cidade ? $escopo : 'geral',
                'cidade' => $cidade,
                'sem_resultados_na_cidade' => $cidade && $escopo === 'geral',
                'area' => $area,
            ],
            'promocoes_destaque' => $this->promocoesDestaque($request, $tipoBusca),
        ]));
    }

    /**
     * Espelha ClienteExplorarController::promocoesDestaque (web) — promoções
     * soltas pelo admin e vinculadas a um serviço/item de aluguel, filtradas
     * pela aba ativa, vigência e elegibilidade do usuário.
     */
    private function promocoesDestaque(Request $request, string $tipoBusca)
    {
        $user = $request->user();
        $papel = strtolower((string) ($user->papel ?? ''));
        $ehProprietario = in_array($papel, ['socio', 'proprietario', 'gerente']);

        $query = Promocao::vigentes()
            ->where(function ($q) use ($ehProprietario, $user) {
                $q->where('publico_alvo', 'todos');
                if ($user) {
                    $q->orWhere('publico_alvo', $ehProprietario ? 'proprietarios' : 'clientes');
                }
            });

        if ($tipoBusca === 'servicos') {
            $query->whereNotNull('servico_id')->with('servico:id,nome,estabelecimento_id,fotos,ativo');
        } elseif ($tipoBusca === 'reservas') {
            $query->whereNotNull('item_aluguel_id')->with('itemAluguel:id,nome,fotos,ativo');
        } else {
            $query->where(fn ($q) => $q->whereNotNull('servico_id')->orWhereNotNull('item_aluguel_id'))
                ->with(['servico:id,nome,estabelecimento_id,fotos,ativo', 'itemAluguel:id,nome,fotos,ativo']);
        }

        return $query->orderByDesc('created_at')->limit(6)->get()
            ->filter(fn ($promo) => !$promo->plano_necessario || ($user && $promo->plano_necessario === $user->plano_assinatura))
            ->map(function ($promo) {
                $vinculo = $promo->vinculoCard();
                if (!$vinculo) {
                    return null;
                }
                return [
                    'id' => $promo->id,
                    'nome' => $promo->nome,
                    'descricao' => $promo->descricao,
                    'imagem' => $promo->imagem,
                    'desconto_percentual' => $promo->desconto_percentual,
                    'desconto_valor' => $promo->desconto_valor,
                    'vinculo' => $vinculo,
                ];
            })
            ->filter()
            ->values();
    }

    private function decodificarFotos($fotos): array
    {
        $decodificadas = is_string($fotos) ? json_decode($fotos, true) : $fotos;
        return is_array($decodificadas) ? array_values(array_filter($decodificadas)) : [];
    }

    private function distanciaKm(?float $lat, ?float $lng, $latDestino, $lngDestino): ?float
    {
        if ($lat === null || $lng === null || !$latDestino || !$lngDestino) return null;

        $dLat = deg2rad((float) $latDestino - $lat);
        $dLng = deg2rad((float) $lngDestino - $lng);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat)) * cos(deg2rad((float) $latDestino)) * sin($dLng / 2) ** 2;

        return round(6371 * 2 * atan2(sqrt($a), sqrt(1 - $a)), 1);
    }

    /** Coluna em minúsculas e sem acento, para "salao" achar "Salão". */
    private static function semAcento(string $coluna): string
    {
        return "translate(lower(coalesce({$coluna}, '')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') like ?";
    }

    private static function termoSemAcento(string $busca): string
    {
        $termo = mb_strtolower($busca);
        $termo = strtr($termo, ['á' => 'a', 'à' => 'a', 'â' => 'a', 'ã' => 'a', 'ä' => 'a', 'é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e',
            'í' => 'i', 'ì' => 'i', 'î' => 'i', 'ï' => 'i', 'ó' => 'o', 'ò' => 'o', 'ô' => 'o', 'õ' => 'o', 'ö' => 'o',
            'ú' => 'u', 'ù' => 'u', 'û' => 'u', 'ü' => 'u', 'ç' => 'c']);

        return '%' . addcslashes($termo, '%_') . '%';
    }

    private function listarEstabelecimentos(DestaquePremiumService $premium, ?string $busca, ?string $categoria, ?float $lat, ?float $lng)
    {
        $query = Estabelecimento::where('ativo', true);

        if ($busca) {
            $termo = self::termoSemAcento($busca);
            $query->where(function ($q) use ($termo) {
                $q->whereRaw(self::semAcento('nome'), [$termo])
                  ->orWhereRaw(self::semAcento('cidade'), [$termo])
                  ->orWhereRaw(self::semAcento('estado'), [$termo])
                  ->orWhereRaw(self::semAcento('ramo_atuacao'), [$termo]);
            });
        }
        if ($categoria) {
            // Grupo do Explorar (ou filtro antigo/ramo/tipo que pertença a um grupo); senão, busca pelo texto.
            if ($grupo = \App\Support\Categorias::grupo($categoria)) {
                \App\Support\Categorias::filtrarLocais($query, $grupo);
            } else {
                $query->where('ramo_atuacao', 'ilike', "%{$categoria}%");
            }
        }

        $premiumIds = $premium->idsEstabelecimentosPremium();
        $pontosPorLocal = $premium->pontosPorEstabelecimento();

        $servicos = \Illuminate\Support\Facades\DB::table('servicos')
            ->where('ativo', true)->whereNull('deleted_at')
            ->selectRaw('estabelecimento_id, MIN(valor) as min_valor, COUNT(*) as total, BOOL_OR(tem_promocao) as promo')
            ->groupBy('estabelecimento_id')->get()->keyBy('estabelecimento_id');

        $filas = \Illuminate\Support\Facades\DB::table('agendamentos')
            ->whereDate('data_agendamento', now()->toDateString())
            ->whereIn('status', ['pendente', 'confirmado'])
            ->selectRaw('estabelecimento_id, COUNT(*) as c')
            ->groupBy('estabelecimento_id')->pluck('c', 'estabelecimento_id');

        return $query->with('horariosFuncionamento')->get()->map(function ($est) use ($premium, $premiumIds, $pontosPorLocal, $servicos, $filas, $lat, $lng) {
            $resumo = $servicos->get($est->id);

            return [
                'id' => $est->id,
                'nome' => $est->nome,
                'ramo_atuacao' => $est->ramo_atuacao,
                'foto_perfil' => $est->foto_perfil ?: $est->foto_banner,
                'cidade' => $est->cidade,
                'estado' => $est->estado,
                'avaliacao_media' => (float) $est->avaliacao_media,
                'total_avaliacoes' => (int) $est->total_avaliacoes,
                'valor' => $resumo ? (float) $resumo->min_valor : 0,
                'total_servicos' => $resumo ? (int) $resumo->total : 0,
                'tem_promocao' => $resumo ? (bool) $resumo->promo : false,
                'fila_atual' => (int) ($filas[$est->id] ?? 0),
                'status_funcionamento' => \App\Support\StatusFuncionamento::de($est->horariosFuncionamento),
                'distancia' => $this->distanciaKm($lat, $lng, $est->latitude, $est->longitude),
                'latitude' => $est->latitude !== null ? (float) $est->latitude : null,
                'longitude' => $est->longitude !== null ? (float) $est->longitude : null,
                'destaque_premium' => $premiumIds->contains($est->id),
                // Quantos serviços/reservas do dono aceitam pontos: sobe na lista logo depois dos premium.
                'destaque_pontos' => (int) ($pontosPorLocal[$est->id] ?? 0),
                'aceita_pagamento_online' => $premium->aceitaPagamentoOnline((int) $est->id),
                'created_at' => optional($est->created_at)->toIso8601String(),
            ];
        })->values();
    }

    private function listarServicos(DestaquePremiumService $premium, ?string $busca, ?string $categoria, ?float $lat, ?float $lng, bool $clienteEhPremium)
    {
        $query = Servico::with('estabelecimento')
            ->where('ativo', true)
            ->whereHas('estabelecimento', fn ($q) => $q->where('ativo', true));

        if ($busca) {
            $termo = self::termoSemAcento($busca);
            $query->where(function ($q) use ($termo) {
                $q->whereRaw(self::semAcento('nome'), [$termo])
                  ->orWhereRaw(self::semAcento('descricao'), [$termo])
                  ->orWhereHas('estabelecimento', fn ($e) => $e->whereRaw(self::semAcento('nome'), [$termo])->orWhereRaw(self::semAcento('cidade'), [$termo]));
            });
        }
        if ($categoria && ($grupo = \App\Support\Categorias::grupo($categoria))) {
            \App\Support\Categorias::filtrarServicos($query, $grupo);
        } elseif ($categoria) {
            $query->where(fn ($q) => $q->where('servicos.tipo_servico', $categoria)
                ->orWhereHas('estabelecimento', fn ($e) => $e->where('ramo_atuacao', 'ilike', "%{$categoria}%")));
        }

        $premiumIds = $premium->idsEstabelecimentosPremium();
        $pontosPorLocal = $premium->pontosPorEstabelecimento();
        $vagasServico = app(\App\Services\Agendamento\VagasServicoService::class);

        return $query->get()->map(function ($s) use ($premium, $premiumIds, $pontosPorLocal, $lat, $lng, $clienteEhPremium, $vagasServico) {
            $est = $s->estabelecimento;
            $fotos = $this->decodificarFotos($s->fotos);
            $base = (float) $s->valor;
            $comDesconto = $this->calcularValorComDesconto($base, (bool) $s->tem_promocao, $s->tipo_desconto, $s->valor_desconto);
            $vagas = $vagasServico->resumoHoje($s);

            return [
                'id' => $s->id,
                'nome' => $s->nome,
                'descricao' => $s->descricao,
                // Onde atende, 24h, "vai até você", tipo de preço (selos do card).
                'atendimento' => \App\Support\CamposServico::paraTela($s),
                'fotos' => $fotos,
                'foto_perfil' => $fotos[0] ?? $est->foto_perfil,
                'estabelecimento_id' => $est->id,
                'nome_local' => $est->nome,
                'ramo_atuacao' => $est->ramo_atuacao,
                'cidade' => $est->cidade,
                'estado' => $est->estado,
                'valor' => $comDesconto,
                'valor_original' => $base,
                'tem_promocao' => (bool) $s->tem_promocao && $comDesconto < $base,
                'desconto_label' => ($s->tem_promocao && $s->valor_desconto)
                    ? ($s->tipo_desconto === 'fixo' ? 'R$ ' . number_format((float) $s->valor_desconto, 0, ',', '.') . ' OFF' : (int) $s->valor_desconto . '% OFF')
                    : null,
                'duracao_minutos' => $s->duracao_minutos,
                'avaliacao_media' => (float) $s->avaliacao_media,
                'total_avaliacoes' => (int) $s->total_avaliacoes,
                'aceita_pontos' => (bool) $s->aceita_pontos,
                'bloqueado' => (bool) $s->somente_premium && !$clienteEhPremium,
                'somente_premium' => (bool) $s->somente_premium,
                'distancia' => $this->distanciaKm($lat, $lng, $est->latitude, $est->longitude),
                'latitude' => $est->latitude !== null ? (float) $est->latitude : null,
                'longitude' => $est->longitude !== null ? (float) $est->longitude : null,
                'destaque_premium' => $premiumIds->contains($est->id),
                // Quantos serviços/reservas do dono aceitam pontos: sobe na lista logo depois dos premium.
                'destaque_pontos' => (int) ($pontosPorLocal[$est->id] ?? 0),
                'aceita_pagamento_online' => $premium->aceitaPagamentoOnline((int) $est->id),
                'vagas_status' => $vagas['status'],
                'vagas_restantes' => $vagas['restantes'],
                'created_at' => optional($s->created_at)->toIso8601String(),
            ];
        })->values();
    }

    private function listarReservas(DestaquePremiumService $premium, ?string $busca, ?string $categoria, bool $clienteEhPremium, ?float $lat = null, ?float $lng = null)
    {
        $query = ItemAluguel::with(['estabelecimento'])->catalogo()->whereHas('estabelecimento');

        if ($busca) {
            $query->where(function ($q) use ($busca) {
                $termo = self::termoSemAcento($busca);
                $q->whereRaw(self::semAcento('nome'), [$termo])
                  ->orWhereRaw(self::semAcento('marca'), [$termo])
                  ->orWhereRaw(self::semAcento('modelo'), [$termo])
                  ->orWhereRaw(self::semAcento('descricao'), [$termo]);
            });
        }
        if ($categoria) {
            if ($grupo = \App\Support\Categorias::grupo($categoria)) {
                \App\Support\Categorias::filtrarReservas($query, $grupo, 'itens_aluguel.categoria');
            } else {
                $query->where('categoria', 'ilike', "%{$categoria}%");
            }
        }

        $premiumUsuarios = $premium->idsUsuariosPremium();
        $pontosPorDono = $premium->pontosPorUsuario();
        // Locação avulsa: o dono aluga direto, sem um Estabelecimento cadastrado.
        $donosComEstabelecimento = \Illuminate\Support\Facades\DB::table('estabelecimento_usuario')->pluck('usuario_id')->unique();

        $disponibilidade = app(\App\Services\Locacao\DisponibilidadeService::class);

        // Reserva sem coordenada própria usa a do local a que pertence (para a distância e o "perto de você").
        $locaisDosItens = \App\Models\Estabelecimento::whereIn('id', $query->clone()->whereNotNull('local_id')->pluck('local_id'))->get(['id', 'latitude', 'longitude'])->keyBy('id');

        return $query->get()->map(function ($item) use ($premium, $premiumUsuarios, $pontosPorDono, $donosComEstabelecimento, $clienteEhPremium, $disponibilidade, $lat, $lng, $locaisDosItens) {
            $fotos = $this->decodificarFotos($item->fotos);
            $base = (float) $item->valor_diaria;
            $comDesconto = $this->calcularValorComDesconto($base, (bool) $item->tem_promocao, $item->tipo_desconto, $item->valor_desconto);
            $vagas = $disponibilidade->resumoHoje($item);

            return [
                'id' => $item->id,
                'nome' => $item->nome,
                'categoria' => $item->categoria,
                'ramo_atuacao' => $item->categoria,
                'marca' => $item->marca,
                'modelo' => $item->modelo,
                'fotos' => $fotos,
                'foto_perfil' => $fotos[0] ?? ($item->estabelecimento->foto_perfil ?? null),
                'cidade' => $item->cidade ?: ($item->estabelecimento->cidade ?? ''),
                'estado' => $item->estado ?: ($item->estabelecimento->estado ?? ''),
                'nome_local' => $item->estabelecimento->name ?? $item->estabelecimento->nome ?? null,
                'valor' => $comDesconto,
                'valor_original' => $base,
                'tem_promocao' => (bool) $item->tem_promocao && $comDesconto < $base,
                'avaliacao_media' => (float) ($item->estabelecimento->avaliacao_media ?? 5),
                'total_avaliacoes' => (int) ($item->estabelecimento->total_avaliacoes ?? 0),
                'aceita_pontos' => (bool) $item->aceita_pontos,
                'direto_dono' => !$donosComEstabelecimento->contains($item->estabelecimento_id),
                'bloqueado' => (bool) $item->somente_premium && !$clienteEhPremium,
                'somente_premium' => (bool) $item->somente_premium,
                'distancia' => $this->distanciaKm($lat, $lng, $item->latitude ?? $locaisDosItens->get((int) $item->local_id)?->latitude, $item->longitude ?? $locaisDosItens->get((int) $item->local_id)?->longitude),
                'latitude' => ($v = $item->latitude ?? $locaisDosItens->get((int) $item->local_id)?->latitude) !== null ? (float) $v : null,
                'longitude' => ($v = $item->longitude ?? $locaisDosItens->get((int) $item->local_id)?->longitude) !== null ? (float) $v : null,
                'destaque_premium' => $premiumUsuarios->contains($item->estabelecimento_id),
                'destaque_pontos' => (int) ($pontosPorDono[$item->estabelecimento_id] ?? 0),
                'aceita_pagamento_online' => $premium->aceitaPagamentoOnline((int) $item->estabelecimento_id, 'usuario'),
                'vagas_status' => $vagas['status'],
                'vagas_restantes' => $vagas['restantes'],
                'created_at' => optional($item->created_at)->toIso8601String(),
            ];
        })->values();
    }

    /**
     * GET /explorar/areas?cidade=  — as áreas (Hotéis, Casas, Lugares, Passeios, Veículos) com quantas
     * ofertas existem na cidade e no sistema todo, para o app mostrar só o que tem conteúdo.
     */
    public function areas(Request $request, DestaquePremiumService $premium)
    {
        $cidade = $request->filled('cidade') ? strip_tags(trim($request->input('cidade'))) : null;

        $itens = ItemAluguel::catalogo()->where('ativo', true)->get(['categoria', 'cidade']);
        $servicos = Servico::with('estabelecimento:id,ramo_atuacao,cidade')->where('ativo', true)
            ->whereHas('estabelecimento', fn ($q) => $q->where('ativo', true))->get(['id', 'estabelecimento_id']);

        $areas = collect(AreasExplorar::AREAS)->map(function ($def, $chave) use ($itens, $servicos, $cidade) {
            $itensArea = $itens->filter(fn ($i) => in_array($i->categoria, $def['categorias'], true));
            $servArea = $servicos->filter(fn ($s) => AreasExplorar::ramoPertence($s->estabelecimento?->ramo_atuacao, $chave));

            $naCidade = $cidade
                ? $itensArea->filter(fn ($i) => AreasExplorar::mesmaCidade($cidade, $i->cidade))->count()
                    + $servArea->filter(fn ($s) => AreasExplorar::mesmaCidade($cidade, $s->estabelecimento?->cidade))->count()
                : null;

            return ['id' => $chave, 'rotulo' => $def['rotulo'], 'icone' => $def['icone'], 'total' => $itensArea->count() + $servArea->count(), 'na_cidade' => $naCidade];
        })->values();

        return response()->json(['status' => 'success', 'data' => $areas]);
    }

    // =====================================================================
    // MÉTODOS AUXILIARES CORRIGIDOS (Removidos withMin que causavam falhas)
    // =====================================================================
    public function destaques()
    {
        $estabelecimentos = Estabelecimento::where('ativo', true)
            ->inRandomOrder()
            ->limit(6)
            ->get()
            ->map(function ($est) {
                $est->valor = 0;
                return $est;
            });

        return response()->json(['status' => 'success', 'data' => $estabelecimentos]);
    }

    public function recentes()
    {
        $estabelecimentos = Estabelecimento::where('ativo', true)
            ->latest()
            ->limit(10)
            ->get()
            ->map(function ($est) {
                $est->valor = 0;
                return $est;
            });

        return response()->json(['status' => 'success', 'data' => $estabelecimentos]);
    }

    /**
     * 🏷️ CATEGORIAS DISPONÍVEIS (ramos de atuação com estabelecimentos ativos)
     * Alimenta o carrossel de categorias da Home/Explorar do app — o ícone de
     * cada uma é resolvido no cliente a partir do nome.
     */
    public function categorias()
    {
        $categorias = Estabelecimento::where('ativo', true)
            ->whereNotNull('ramo_atuacao')
            ->where('ramo_atuacao', '!=', '')
            ->selectRaw('ramo_atuacao as nome, count(*) as total')
            ->groupBy('ramo_atuacao')
            ->orderByDesc('total')
            ->get();

        // `data` continua igual (versões antigas do app); `grupos` são as categorias novas, com totais.
        return response()->json(['status' => 'success', 'data' => $categorias, 'grupos' => \App\Support\Categorias::explorarComTotais()]);
    }

    public function porCidade($cidade)
    {
        $estabelecimentos = Estabelecimento::where('ativo', true)
            ->where('cidade', 'ilike', "%{$cidade}%")
            ->latest()
            ->paginate(15);

        $estabelecimentos->getCollection()->transform(function ($est) {
            $est->valor = 0;
            return $est;
        });

        return response()->json($estabelecimentos);
    }

    /** GET /explorar/estados — contagem real de lojas, serviços e reservas nos 27 estados. */
    public function estados()
    {
        return app(\App\Http\Controllers\Api\ClienteExplorarController::class)->estados();
    }
}
