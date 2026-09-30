<?php

namespace App\Http\Middleware;

use App\Services\PagamentoService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'auth' => [
                'user' => $request->user(),
            ],
            'alertaCarteiraAsaas' => fn () => $this->alertaCarteiraAsaas($request),
            'menuEstabelecimentoId' => fn () => $this->menuEstabelecimentoId($request),
            'taxaPlataforma' => \App\Support\Taxas::percentual(),
            'menuPremium' => fn () => $request->user() ? ($request->user()->papel === 'admin' || $request->user()->isPremium()) : false,
        ];
    }

    private function alertaCarteiraAsaas(Request $request): ?array
    {
        $user = $request->user();

        if (!$user || !in_array(mb_strtolower((string) $user->papel), ['socio', 'sócio', 'proprietario', 'proprietário'], true)) {
            return null;
        }

        $pagamentoService = app(PagamentoService::class);

        $estabelecimentos = DB::table('estabelecimento_usuario')
            ->join('estabelecimentos', 'estabelecimentos.id', '=', 'estabelecimento_usuario.estabelecimento_id')
            ->where('estabelecimento_usuario.usuario_id', $user->id)
            ->select('estabelecimentos.id', 'estabelecimentos.nome')
            ->get()
            ->reject(fn ($e) => $pagamentoService->estabelecimentoTemCarteiraAsaas($e->id));

        if ($estabelecimentos->isEmpty()) {
            return null;
        }

        return [
            'mensagem' => 'Crie sua conta para receber pagamentos online',
            'detalhe' => 'Enquanto a conta de recebimento não for cadastrada, os clientes não conseguem pagar reservas online em: ' . $estabelecimentos->pluck('nome')->implode(', ') . '.',
            'rota' => route('carteira.asaas'),
        ];
    }

    /** Primeiro estabelecimento do proprietário: alvo dos atalhos do menu lateral que exigem um local (cupons, contratos, configurações). */
    private function menuEstabelecimentoId(Request $request): ?int
    {
        $user = $request->user();

        if (!$user || !in_array(mb_strtolower((string) $user->papel), ['socio', 'sócio', 'proprietario', 'proprietário'], true)) {
            return null;
        }

        // Quem tem mais de um local mantém o contexto: se a tela atual é de um local dele
        // (Configurações, Cupons, Contratos...), o menu lateral aponta para ESSE local.
        $doContexto = (int) ($request->route('estabelecimento') instanceof \Illuminate\Database\Eloquent\Model
            ? $request->route('estabelecimento')->getKey()
            : ($request->route('estabelecimento') ?? $request->route('estabelecimento_id') ?? $request->query('estabelecimento_id')));

        if ($doContexto > 0) {
            $vinculado = DB::table('estabelecimento_usuario')
                ->where('usuario_id', $user->id)
                ->where('estabelecimento_id', $doContexto)
                ->exists();

            if ($vinculado) {
                return $doContexto;
            }
        }

        return DB::table('estabelecimento_usuario')
            ->where('usuario_id', $user->id)
            ->orderBy('estabelecimento_id')
            ->value('estabelecimento_id');
    }
}
