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
            'mensagem' => 'O estabelecimento não possui uma carteira Asaas configurada.',
            'detalhe' => 'Enquanto a conta de recebimento não for cadastrada, os clientes não conseguem pagar reservas online em: ' . $estabelecimentos->pluck('nome')->implode(', ') . '.',
            'rota' => route('financeiro.conta'),
        ];
    }
}
