<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\NotaFiscal;
use App\Models\Provider;
use App\Services\NotaFiscalService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class NotaFiscalWebController extends Controller
{
    /**
     * Tela com o status de cada nota fiscal emitida (ou tentada) para o usuário logado:
     * as notas de VENDA (pagamentos que ele recebeu como prestador, se for sócio premium)
     * e as notas da própria ASSINATURA dele (sócio ou cliente, qualquer plano pago).
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $provider = Provider::where('user_id', $user->id)->first();

        $notas = NotaFiscal::where('usuario_id', $user->id)
            ->when($provider, fn ($q) => $q->orWhere('provider_id', $provider->id))
            ->with(['pagamento:id,valor,valor_total,created_at', 'assinatura:id,nome_plano'])
            ->orderByDesc('created_at')
            ->paginate(15);

        return Inertia::render('Estabelecimentos/NotasFiscais', [
            'notas' => $notas,
            'elegivel' => $provider ? app(NotaFiscalService::class)->elegivel($provider) : false,
        ]);
    }

    public function tentarNovamente(Request $request, NotaFiscal $notaFiscal)
    {
        $user = $request->user();
        $provider = Provider::where('user_id', $user->id)->first();

        $donoDaNota = $notaFiscal->usuario_id === $user->id
            || ($provider && $notaFiscal->provider_id === $provider->id);

        abort_unless($donoDaNota, 403);

        app(NotaFiscalService::class)->tentarNovamente($notaFiscal);

        return back()->with('success', 'Nova tentativa de emissão enviada.');
    }
}
