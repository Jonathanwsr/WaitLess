<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\NotaFiscal;
use App\Models\Provider;
use App\Services\NotaFiscal\CentralNotasService;
use App\Services\NotaFiscalService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class NotaFiscalWebController extends Controller
{
    /**
     * Central de notas fiscais do usuário logado:
     * - vendas: notas que o sócio emitiu para os clientes (Sócio Premium);
     * - comissões: notas que a Lokyva emitiu para o sócio pela taxa de intermediação;
     * - assinatura: notas da assinatura do próprio usuário;
     * - e, para o cliente, as notas das compras que ele fez.
     */
    public function index(Request $request, CentralNotasService $central)
    {
        $user = $request->user();
        $provider = Provider::where('user_id', $user->id)->first();
        $tipo = in_array($request->query('tipo'), CentralNotasService::TIPOS, true) ? $request->query('tipo') : null;

        $notas = $central->consultaDoUsuario($user, $provider)
            ->when($tipo, fn ($q) => $q->where('tipo', $tipo))
            ->with(['pagamento:id,valor,valor_total,created_at', 'assinatura:id,nome_plano'])
            ->orderByDesc('created_at')
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('Estabelecimentos/NotasFiscais', ['notas' => $notas, 'filtro' => $tipo] + $central->painel($user, $provider));
    }

    /** O sócio informa o serviço municipal e as alíquotas das notas de venda (dados do contador dele). */
    public function salvarConfiguracao(Request $request, CentralNotasService $central)
    {
        $provider = Provider::where('user_id', $request->user()->id)->firstOrFail();
        $central->salvarConfiguracao($provider, $request->validate(CentralNotasService::REGRAS_CONFIGURACAO, CentralNotasService::MENSAGENS_CONFIGURACAO));

        return back()->with('success', 'Configuração fiscal salva. As próximas notas de venda já saem com esses dados.');
    }

    public function tentarNovamente(Request $request, NotaFiscal $notaFiscal, CentralNotasService $central)
    {
        $user = $request->user();
        $provider = Provider::where('user_id', $user->id)->first();

        abort_unless($central->podeMexer($notaFiscal, $user, $provider), 403);
        abort_if($notaFiscal->status === 'CANCELADA', 422, 'Nota cancelada não pode ser reemitida.');

        app(NotaFiscalService::class)->tentarNovamente($notaFiscal);

        return back()->with('success', 'Nova tentativa de emissão enviada.');
    }
}
