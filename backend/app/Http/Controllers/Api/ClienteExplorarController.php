<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Estabelecimento;
use App\Models\ItemAluguel; // Importação do Model de Itens
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;
use Inertia\Inertia;

class ClienteExplorarController extends Controller
{
    public function index(Request $request)
    {
        // =====================================================================
        // 1. LÓGICA ORIGINAL PRESERVADA: BUSCA DE ESTABELECIMENTOS
        // =====================================================================
        $queryEstabelecimentos = Estabelecimento::where('ativo', true);

        if ($request->filled('busca')) {
            $termo = '%' . strip_tags(trim($request->busca)) . '%';
            $queryEstabelecimentos->where(function($q) use ($termo) {
                $q->where('nome', 'ilike', $termo)
                  ->orWhere('cidade', 'ilike', $termo);
            });
        }

        if ($request->filled('categoria')) {
            $queryEstabelecimentos->where('ramo_atuacao', strip_tags(trim($request->categoria)));
        }

        $estabelecimentos = $queryEstabelecimentos->latest()->paginate(12)->withQueryString();

        // =====================================================================
        // 2. NOVA LÓGICA ADICIONADA: BUSCA DE ITENS DE LOCAÇÃO E RESERVAS
        // =====================================================================
        $busca = $request->filled('busca') ? strip_tags(trim($request->input('busca'))) : null;
        $categoria = $request->filled('categoria') ? strip_tags(trim($request->input('categoria'))) : null;
        $dataDesejada = $request->filled('data') ? strip_tags(trim($request->input('data'))) : null;

        // Validação tipada para evitar ataques de injeção de parâmetros HTTP
        $validated = $request->validate([
            'preco_min'        => 'nullable|numeric|min:0',
            'preco_max'        => 'nullable|numeric|min:0',
            'apenas_promocoes' => 'nullable|boolean',
            'ordem'            => 'nullable|string|in:relevancia,menor_preco,maior_preco,maior_desconto',
            'per_page'         => 'nullable|integer|max:50'
        ]);

        $perPage = $validated['per_page'] ?? 12;

        // Traz apenas itens de estabelecimentos que estão ativos
        $queryItens = ItemAluguel::with(['estabelecimento:id,nome,foto_perfil,cidade,estado,ativo'])
            ->whereHas('estabelecimento', function($q) {
                $q->where('ativo', true);
            });

        // 🔍 Filtro Textual para Itens
        if ($busca) {
            $queryItens->where(function ($q) use ($busca) {
                $termoItem = "%{$busca}%";
                $q->where('nome', 'ilike', $termoItem)
                  ->orWhere('marca', 'ilike', $termoItem)
                  ->orWhere('modelo', 'ilike', $termoItem)
                  ->orWhere('descricao', 'ilike', $termoItem);
            });
        }

        // 📁 Filtro de Categoria
        if ($categoria && $categoria !== 'todas') {
            // Permite buscar tanto na categoria do item quanto no ramo do estabelecimento
            $queryItens->where(function ($q) use ($categoria) {
                $q->where('categoria', $categoria)
                  ->orWhereHas('estabelecimento', function($sub) use ($categoria) {
                      $sub->where('ramo_atuacao', $categoria);
                  });
            });
        }

        // 💰 Filtros de Preço e Promoção
        if ($request->filled('preco_min')) {
            $queryItens->where('valor_diaria', '>=', $validated['preco_min']);
        }
        if ($request->filled('preco_max')) {
            $queryItens->where('valor_diaria', '<=', $validated['preco_max']);
        }
        if ($request->boolean('apenas_promocoes')) {
            $queryItens->where('tem_promocao', true);
        }

        // 📅 Filtro Avançado de Calendário e Bloqueios
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

                // 1. O dia NÃO pode estar na array de datas_bloqueadas (Segurança via Native Eloquent Json)
                $queryItens->where(function($q) use ($dataStr) {
                    $q->whereNull('datas_bloqueadas')
                      ->orWhereJsonDoesntContain('datas_bloqueadas', $dataStr);
                });

                // 2. Validação da janela de funcionamento do lojista
                $queryItens->where(function($q) use ($dataStr, $diaSemanaNome, $diaDoMes) {
                    $q->where('sempre_disponivel', true)
                      ->orWhere(function($sub) use ($dataStr, $diaSemanaNome, $diaDoMes) {
                          
                          // Valida range de datas gerais (Temporada)
                          $sub->where(function($range) use ($dataStr) {
                              $range->whereNull('data_inicio_disponibilidade')
                                    ->orWhere('data_inicio_disponibilidade', '<=', $dataStr);
                          })->where(function($range) use ($dataStr) {
                              $range->whereNull('data_fim_disponibilidade')
                                    ->orWhere('data_fim_disponibilidade', '>=', $dataStr);
                          });

                          // Valida as opções de dias/semanas e meses
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
                // Loga tentativas de brute force ou erro de data sem quebrar a aplicação
                \Log::warning("Data inválida recebida na Busca do Cliente: " . $dataDesejada);
            }
        }

        // ↕️ Ordenação de Busca
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

        // 💰 Transformação: Calcula na hora o preço líquido com promoção para o cliente ver
        $itens->getCollection()->transform(function ($item) {
            $item->fotos = json_decode($item->fotos) ?? [];
            $item->recursos_oferecidos = json_decode($item->recursos_oferecidos) ?? [];
            $item->acessorios = json_decode($item->acessorios) ?? [];
            
            $valorBase = floatval($item->valor_diaria);
            $precoComDesconto = $valorBase;

            if ($item->tem_promocao && floatval($item->valor_desconto) > 0) {
                if ($item->tipo_desconto === 'percentual') {
                    $precoComDesconto = $valorBase - ($valorBase * (floatval($item->valor_desconto) / 100));
                } else {
                    $precoComDesconto = max(0, $valorBase - floatval($item->valor_desconto));
                }
            }

            $item->preco_final_cliente = number_format($precoComDesconto, 2, '.', '');
            return $item;
        });

        // =====================================================================
        // 3. RETORNO PARA A VIEW (INERTIA) COM AS DUAS LISTAS
        // =====================================================================
        return Inertia::render('Cliente/Explorar', [
            'estabelecimentos' => $estabelecimentos, // Sua lista original
            'itens_aluguel'    => $itens,            // A nova lista avançada de locações
            'filtros'          => $request->only(['busca', 'categoria', 'data', 'preco_min', 'preco_max', 'apenas_promocoes', 'ordem'])
        ]);
    }
}