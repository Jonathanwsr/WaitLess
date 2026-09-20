<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Servico;
use App\Models\ItemAluguel;
use App\Models\Produto;
use App\Models\User;
use App\Services\PlanoService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class OfertaPremiumController extends Controller
{
    /**
     * Resolve o nível de plano Premium do cliente a partir do catálogo único
     * de planos (PlanoService), para as camadas web/mobile nunca divergirem.
     * Retorna 'nenhum', 'premium' ou 'premium-plus'.
     */
    private function nivelPremiumUsuario(?User $user, PlanoService $planoService): string
    {
        if (!$user) return 'nenhum';

        $planosPermitidos = $planoService->planosPermitidos('user'); // ex: ['premium', 'premium-plus']
        $plano = $user->plano_assinatura;

        if (!in_array($plano, $planosPermitidos, true)) {
            return 'nenhum';
        }

        // O plano mais caro do catálogo (maior "valor") é o que libera produtos
        // exclusivos — hoje é o "premium-plus", mas resolvido dinamicamente
        // para não depender de um nome fixo se o catálogo mudar.
        $planoMaisCaro = collect($planosPermitidos)
            ->sortByDesc(fn ($p) => $planoService->resolverDetalhesPlano('user', $p)['valor'] ?? 0)
            ->first();

        return $plano === $planoMaisCaro ? 'premium-plus' : 'premium';
    }

    /**
     * Calcula o valor final de um item aplicando a regra de desconto
     * (percentual ou fixo) configurada no catálogo.
     */
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
     * GET /ofertas-premium
     * Tela onde o cliente Premium explora serviços, reservas e produtos com
     * desconto exclusivo ou liberados apenas para assinantes. Usuários não
     * premium também acessam a tela, mas recebem as ofertas bloqueadas (com
     * uma chamada para assinar). Produtos exclusivos exigem o plano mais caro
     * (premium-plus): "quem paga mais tem acesso a mais produtos".
     */
    public function index(Request $request, PlanoService $planoService)
    {
        $validated = $request->validate([
            'busca'     => 'nullable|string|max:100',
            'categoria' => 'nullable|string|max:100',
            'cidade'    => 'nullable|string|max:100',
        ]);

        $busca = $request->filled('busca') ? strip_tags(trim($validated['busca'])) : null;
        $categoria = $request->filled('categoria') ? strip_tags(trim($validated['categoria'])) : null;
        $cidade = $request->filled('cidade') ? strip_tags(trim($validated['cidade'])) : null;

        $user = Auth::user();
        $nivel = $this->nivelPremiumUsuario($user, $planoService);
        $isPremium = $nivel !== 'nenhum';
        $isPremiumPlus = $nivel === 'premium-plus';

        // Servico::estabelecimento() aponta para Estabelecimento (coluna "nome"), enquanto
        // ItemAluguel::estabelecimento() aponta para User (coluna "name") — selects diferentes
        // por tabela, com alias para "name" para o front-end ler um campo único e consistente.
        $servicos = Servico::with(['estabelecimento' => function ($q) {
                $q->select('id', 'nome as name', 'foto_perfil', 'cidade', 'estado');
            }])
            ->where('ativo', true)
            ->where(function ($q) {
                $q->where('somente_premium', true)->orWhere('tem_promocao', true);
            })
            ->when($busca, fn ($q) => $q->where(function ($qq) use ($busca) {
                $qq->where('nome', 'ilike', "%{$busca}%")->orWhere('tipo_servico', 'ilike', "%{$busca}%");
            }))
            ->when($categoria, fn ($q) => $q->where('tipo_servico', 'ilike', "%{$categoria}%"))
            ->when($cidade, fn ($q) => $q->whereHas('estabelecimento', function ($qq) use ($cidade) {
                $qq->where('cidade', 'ilike', "%{$cidade}%");
            }))
            ->latest()
            ->get()
            ->map(function ($servico) {
                $valorFinal = $this->calcularValorComDesconto(
                    (float) $servico->valor,
                    (bool) $servico->tem_promocao,
                    $servico->tipo_desconto,
                    $servico->valor_desconto
                );

                return [
                    'id'                      => $servico->id,
                    'tipo'                    => 'servico',
                    'nome'                    => $servico->nome,
                    'categoria'               => $servico->tipo_servico,
                    'descricao'               => $servico->descricao,
                    'fotos'                   => $servico->fotos,
                    'estabelecimento'         => $servico->estabelecimento,
                    'estabelecimento_id'      => $servico->estabelecimento_id,
                    'somente_premium'         => (bool) $servico->somente_premium,
                    'tem_promocao'            => (bool) $servico->tem_promocao,
                    'aceita_pontos'           => (bool) $servico->aceita_pontos,
                    'maximo_pontos_permitidos'=> $servico->maximo_pontos_permitidos,
                    'valor_original'          => (float) $servico->valor,
                    'valor_com_desconto'      => $valorFinal,
                    'url'                     => route('estabelecimentos.loja', $servico->estabelecimento_id) . '?open_servico=' . $servico->id,
                ];
            });

        $itensAluguel = ItemAluguel::with(['estabelecimento' => function ($q) {
                $q->select('id', 'name', 'foto_perfil', 'cidade', 'estado');
            }])
            ->where('ativo', true)
            ->where(function ($q) {
                $q->where('somente_premium', true)->orWhere('tem_promocao', true);
            })
            ->when($busca, fn ($q) => $q->where(function ($qq) use ($busca) {
                $qq->where('nome', 'ilike', "%{$busca}%")
                   ->orWhere('marca', 'ilike', "%{$busca}%")
                   ->orWhere('modelo', 'ilike', "%{$busca}%");
            }))
            ->when($categoria, fn ($q) => $q->where('categoria', 'ilike', "%{$categoria}%"))
            ->when($cidade, fn ($q) => $q->whereHas('estabelecimento', function ($qq) use ($cidade) {
                $qq->where('cidade', 'ilike', "%{$cidade}%");
            }))
            ->latest()
            ->get()
            ->map(function ($item) {
                $base = (float) ($item->valor_diaria ?? 0);
                $valorFinal = $this->calcularValorComDesconto(
                    $base,
                    (bool) $item->tem_promocao,
                    $item->tipo_desconto,
                    $item->valor_desconto
                );

                return [
                    'id'                      => $item->id,
                    'tipo'                    => 'reserva',
                    'nome'                    => $item->nome,
                    'categoria'               => $item->categoria,
                    'descricao'               => $item->descricao,
                    'fotos'                   => $item->fotos,
                    'estabelecimento'         => $item->estabelecimento,
                    'somente_premium'         => (bool) $item->somente_premium,
                    'tem_promocao'            => (bool) $item->tem_promocao,
                    'aceita_pontos'           => (bool) $item->aceita_pontos,
                    'maximo_pontos_permitidos'=> $item->maximo_pontos_permitidos,
                    'valor_original'          => $base,
                    'valor_com_desconto'      => $valorFinal,
                    'url'                     => route('itens.detalhes', $item->id),
                ];
            });

        $produtos = Produto::with(['estabelecimento' => function ($q) {
                $q->select('id', 'nome as name', 'foto_perfil', 'cidade', 'estado');
            }])
            ->where('estoque_disponivel', '>', 0)
            ->where(function ($q) {
                $q->where('somente_premium', true)->orWhere('is_promocao', true);
            })
            ->when($busca, fn ($q) => $q->where(function ($qq) use ($busca) {
                $qq->where('nome', 'ilike', "%{$busca}%")->orWhere('categoria', 'ilike', "%{$busca}%");
            }))
            ->when($categoria, fn ($q) => $q->where('categoria', 'ilike', "%{$categoria}%"))
            ->when($cidade, fn ($q) => $q->whereHas('estabelecimento', function ($qq) use ($cidade) {
                $qq->where('cidade', 'ilike', "%{$cidade}%");
            }))
            ->latest()
            ->get()
            ->map(function ($produto) {
                return [
                    'id'                 => $produto->id,
                    'tipo'               => 'produto',
                    'nome'               => $produto->nome,
                    'categoria'          => $produto->categoria,
                    'descricao'          => $produto->descricao,
                    'fotos'              => Produto::decodeFotos($produto->fotos),
                    'estabelecimento'    => $produto->estabelecimento,
                    'somente_premium'    => (bool) $produto->somente_premium,
                    'tem_promocao'       => (bool) $produto->is_promocao,
                    'valor_original'     => (float) $produto->valor_normal,
                    'valor_com_desconto' => (float) $produto->valor_final,
                    'url'                => $produto->estabelecimento_id
                        ? route('estabelecimentos.loja', $produto->estabelecimento_id) . '?open_produto=' . $produto->id
                        : null,
                ];
            });

        // Diferenciação por tipo de plano: serviços/reservas exclusivos liberam
        // com qualquer plano Premium; produtos exclusivos exigem o plano mais
        // caro (premium-plus) — "quem paga mais tem acesso a mais produtos".
        $marcar = function ($colecao, bool $liberaComEsteNivel) {
            return $colecao->map(function ($oferta) use ($liberaComEsteNivel) {
                $oferta['bloqueado'] = $oferta['somente_premium'] && !$liberaComEsteNivel;
                if ($oferta['bloqueado']) {
                    $oferta['valor_com_desconto'] = $oferta['valor_original'];
                }
                return $oferta;
            })->values();
        };

        $servicos = $marcar($servicos, $isPremium);
        $itensAluguel = $marcar($itensAluguel, $isPremium);
        $produtos = $marcar($produtos, $isPremiumPlus);

        return Inertia::render('Cliente/OfertasPremium', [
            'isPremium'     => $isPremium,
            'isPremiumPlus' => $isPremiumPlus,
            'planoAtual'    => $user->plano_assinatura ?? null,
            'servicos'      => $servicos,
            'itensAluguel'  => $itensAluguel,
            'produtos'      => $produtos,
            'filtros'       => [
                'busca'     => $busca,
                'categoria' => $categoria,
                'cidade'    => $cidade,
            ],
        ]);
    }
}
