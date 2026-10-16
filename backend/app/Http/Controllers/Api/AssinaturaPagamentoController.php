<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Assinatura\PagamentoAssinaturaService;
use Illuminate\Http\Request;

/** Pagamento da assinatura (site e app): forma padrão, faturas, pagar fatura e trocar o método. */
class AssinaturaPagamentoController extends Controller
{
    public function __construct(private PagamentoAssinaturaService $pagamentos) {}

    public function painel(Request $request)
    {
        $a = $this->pagamentos->assinaturaDe($request->user());
        if (!$a) {
            return response()->json(['tem_assinatura' => false, 'forma' => null, 'faturas' => [], 'erro' => null]);
        }

        return response()->json(['tem_assinatura' => true] + $this->pagamentos->painel($a));
    }

    public function pagar(Request $request, string $fatura)
    {
        abort_unless(preg_match('/^[A-Za-z0-9_]{3,40}$/', $fatura), 404);
        $a = $this->pagamentos->assinaturaDe($request->user());
        abort_unless($a, 404, 'Você não tem assinatura ativa.');

        return response()->json($this->pagamentos->pagar($a, $fatura));
    }

    public function cartao(Request $request)
    {
        $dados = $request->validate([
            'cartao' => 'required|array',
            'cartao.numero' => 'required|string|min:13|max:23',
            'cartao.titular' => 'required|string|max:120',
            'cartao.mes' => 'required|integer|between:1,12',
            'cartao.ano' => 'required|integer|min:' . (int) date('y'),
            'cartao.cvv' => 'required|string|min:3|max:4',
            'titular' => 'nullable|array',
            'titular.cpf_cnpj' => 'nullable|string|max:20',
            'titular.cep' => 'nullable|string|max:10',
            'titular.numero' => 'nullable|string|max:20',
            'titular.telefone' => 'nullable|string|max:20',
        ], [
            'cartao.numero.min' => 'Número do cartão incompleto.',
            'cartao.ano.min' => 'Este cartão está vencido.',
        ]);
        $a = $this->pagamentos->assinaturaDe($request->user());
        abort_unless($a, 404, 'Você não tem assinatura ativa.');

        $this->pagamentos->usarCartao($a, $request->user(), $dados['cartao'], $dados['titular'] ?? [], $request->ip());

        return response()->json(['mensagem' => 'Cartão salvo. As próximas cobranças da assinatura vão para ele.'] + $this->pagamentos->painel($a->fresh()));
    }

    public function forma(Request $request)
    {
        $dados = $request->validate(['forma' => 'required|in:PIX,BOLETO,pix,boleto']);
        $a = $this->pagamentos->assinaturaDe($request->user());
        abort_unless($a, 404, 'Você não tem assinatura ativa.');

        $tipo = strtoupper($dados['forma']);
        $this->pagamentos->usarPixOuBoleto($a, $tipo);

        return response()->json(['mensagem' => $tipo === 'PIX' ? 'Pronto! As próximas faturas virão por Pix.' : 'Pronto! As próximas faturas virão por boleto.'] + $this->pagamentos->painel($a->fresh()));
    }

    /** Rotas JSON (site em /minha-assinatura/pagamento e app em /api/mobile/assinatura/pagamento). */
    public static function rotas(): void
    {
        $c = self::class;
        \Illuminate\Support\Facades\Route::get('/pagamento', [$c, 'painel'])->middleware('throttle:30,1')->name('painel');
        \Illuminate\Support\Facades\Route::get('/pagamento/faturas/{fatura}', [$c, 'pagar'])->middleware('throttle:30,1')->name('fatura');
        \Illuminate\Support\Facades\Route::post('/pagamento/cartao', [$c, 'cartao'])->middleware('throttle:6,1')->name('cartao');
        \Illuminate\Support\Facades\Route::post('/pagamento/forma', [$c, 'forma'])->middleware('throttle:10,1')->name('forma');
    }
}
