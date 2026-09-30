<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ContaBancariaRepasse;
use App\Models\Provider;
use App\Services\Carteira\CarteiraException;
use App\Services\Carteira\CarteiraService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

/**
 * Tela "Carteira" do proprietário: saldo real no Asaas, contas de destino
 * (validadas por Pix de R$ 0,01) e repasse antecipado. Só o plano mais caro
 * enxerga o saldo/extrato e saca; os demais veem o histórico e o convite ao upgrade.
 */
class CarteiraProprietarioController extends Controller
{
    private const TIPOS_CHAVE = 'CPF,CNPJ,EMAIL,PHONE,RANDOM';
    private const MSG_SEM_CONTA = 'Crie sua conta para receber pagamentos online antes de usar a carteira.';

    public function __construct(private CarteiraService $carteira) {}

    public function index(Request $request)
    {
        return Inertia::render('Estabelecimentos/Carteira', [
            'painelInicial' => $this->carteira->painel($request->user(), $this->provider($request)),
        ]);
    }

    public function painel(Request $request): JsonResponse
    {
        return response()->json($this->carteira->painel($request->user(), $this->provider($request)));
    }

    public function storeConta(Request $request): JsonResponse
    {
        $provider = $this->provider($request);
        if (!$provider) {
            return response()->json(['erro' => self::MSG_SEM_CONTA], 409);
        }

        $dados = $request->validate([
            'apelido' => 'required|string|max:60',
            'tipo' => 'required|in:PIX,CONTA',
            'pix_key_type' => 'required_if:tipo,PIX|nullable|in:' . self::TIPOS_CHAVE,
            'pix_key' => ['required_if:tipo,PIX', 'nullable', 'string', 'max:255', 'regex:/^[^<>]+$/'],
            'banco_codigo' => 'required_if:tipo,CONTA|nullable|digits_between:1,4',
            'banco_nome' => 'nullable|string|max:100',
            'agencia' => 'required_if:tipo,CONTA|nullable|string|max:10',
            'conta' => 'required_if:tipo,CONTA|nullable|string|max:20',
            'conta_digito' => 'required_if:tipo,CONTA|nullable|string|max:3',
            'tipo_conta' => 'required_if:tipo,CONTA|nullable|in:CONTA_CORRENTE,CONTA_POUPANCA',
            'titular_nome' => 'required|string|max:255',
            'titular_documento' => 'required|string|max:20',
        ], [], [
            'apelido' => 'apelido', 'pix_key' => 'chave Pix', 'agencia' => 'agência', 'conta' => 'conta',
            'titular_nome' => 'nome do titular', 'titular_documento' => 'CPF/CNPJ do titular',
        ]);

        try {
            $conta = $this->carteira->cadastrarConta($provider, $dados);
        } catch (CarteiraException $e) {
            return response()->json(['erro' => $e->getMessage()], 422);
        }

        // O Pix de R$ 0,01 sai depois da resposta: a tela não espera o banco.
        dispatch(fn () => $this->carteira->validarConta($conta->fresh()))->afterResponse();

        return response()->json([
            'mensagem' => 'Conta cadastrada! Vamos enviar R$ 0,01 por Pix para confirmar que ela é sua. Leva poucos instantes.',
            'conta' => $conta->paraTela(),
        ], 201);
    }

    public function revalidarConta(Request $request, ContaBancariaRepasse $conta): JsonResponse
    {
        $this->autorizar($request, $conta);

        if ($conta->estaValidada()) {
            return response()->json(['mensagem' => 'Essa conta já está validada.', 'conta' => $conta->paraTela()]);
        }
        if ($conta->tentativas_validacao >= 6) {
            return response()->json(['erro' => 'Já tentamos validar essa conta várias vezes. Confira os dados ou fale com o suporte.'], 422);
        }

        dispatch(fn () => $this->carteira->validarConta($conta->fresh()))->afterResponse();

        return response()->json(['mensagem' => 'Enviando um novo Pix de R$ 0,01 para validar a conta.', 'conta' => $conta->paraTela()]);
    }

    public function definirPadrao(Request $request, ContaBancariaRepasse $conta): JsonResponse
    {
        $this->autorizar($request, $conta);
        $this->carteira->definirPadrao($conta);

        return response()->json(['mensagem' => 'Conta definida como padrão dos repasses semanais.']);
    }

    public function removerConta(Request $request, ContaBancariaRepasse $conta): JsonResponse
    {
        $this->autorizar($request, $conta);
        $this->carteira->removerConta($conta);

        return response()->json(['mensagem' => 'Conta removida.']);
    }

    public function sacar(Request $request): JsonResponse
    {
        $provider = $this->provider($request);
        if (!$provider) {
            return response()->json(['erro' => self::MSG_SEM_CONTA], 409);
        }

        $dados = $request->validate([
            'conta_id' => 'required|integer',
            'valor' => 'required|numeric|min:0.01|max:1000000',
        ], [
            'valor.required' => 'Informe quanto você quer sacar.',
            'valor.numeric' => 'Informe um valor válido.',
        ]);

        $conta = ContaBancariaRepasse::where('provider_id', $provider->id)->find($dados['conta_id']);
        if (!$conta) {
            return response()->json(['erro' => 'Conta de destino não encontrada.'], 404);
        }

        try {
            $t = $this->carteira->sacar($request->user(), $provider, $conta, (float) $dados['valor']);
        } catch (CarteiraException $e) {
            return response()->json(['erro' => $e->getMessage()], 422);
        } catch (\Throwable $e) {
            Log::error('Carteira: erro inesperado no saque. ' . $e->getMessage(), ['provider' => $provider->id]);
            return response()->json(['erro' => 'Algo deu errado do nosso lado. Nenhum valor foi movimentado — tente novamente em instantes.'], 500);
        }

        if ($t->status === 'falhou') {
            return response()->json([
                'erro' => $t->erro_mensagem . " (operação #{$t->id})",
                'transferencia' => $t->paraProprietario(),
            ], 422);
        }

        return response()->json([
            'mensagem' => $t->status === 'concluida'
                ? 'Repasse concluído! O dinheiro está a caminho da sua conta.'
                : 'Repasse solicitado! Assim que o banco confirmar, ele aparece como concluído.',
            'transferencia' => $t->paraProprietario(),
        ]);
    }

    private function provider(Request $request): ?Provider
    {
        return Provider::where('user_id', $request->user()->id)->first();
    }

    private function autorizar(Request $request, ContaBancariaRepasse $conta): void
    {
        abort_unless($conta->user_id === $request->user()->id, 404);
    }
}
