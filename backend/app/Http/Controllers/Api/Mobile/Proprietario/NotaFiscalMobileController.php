<?php

namespace App\Http\Controllers\Api\Mobile\Proprietario;

use App\Http\Controllers\Controller;
use App\Models\NotaFiscal;
use App\Models\Provider;
use App\Services\NotaFiscal\CentralNotasService;
use App\Services\NotaFiscalService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Central de notas fiscais no app (mesmas regras da tela web, via CentralNotasService). */
class NotaFiscalMobileController extends Controller
{
    public function index(Request $request, CentralNotasService $central): JsonResponse
    {
        $user = $request->user();
        $provider = Provider::where('user_id', $user->id)->first();
        $tipo = in_array($request->query('tipo'), CentralNotasService::TIPOS, true) ? $request->query('tipo') : null;

        $notas = $central->consultaDoUsuario($user, $provider)
            ->when($tipo, fn ($q) => $q->where('tipo', $tipo))
            ->orderByDesc('created_at')
            ->paginate(20, ['id', 'tipo', 'status', 'valor', 'valor_operacao', 'percentual', 'numero', 'descricao_servico', 'pdf_url', 'xml_url', 'mensagem_erro', 'emitida_em', 'created_at']);

        return response()->json(['notas' => $notas, 'filtro' => $tipo] + $central->painel($user, $provider));
    }

    public function salvarConfiguracao(Request $request, CentralNotasService $central): JsonResponse
    {
        $provider = Provider::where('user_id', $request->user()->id)->first();
        if (!$provider) {
            return response()->json(['message' => 'Abra sua carteira primeiro para configurar as notas de venda.'], 422);
        }

        $central->salvarConfiguracao($provider, $request->validate(CentralNotasService::REGRAS_CONFIGURACAO, CentralNotasService::MENSAGENS_CONFIGURACAO));

        return response()->json(['message' => 'Configuração fiscal salva.', 'configuracao' => $central->configuracao($provider->fresh())]);
    }

    public function tentarNovamente(Request $request, NotaFiscal $notaFiscal, CentralNotasService $central): JsonResponse
    {
        $user = $request->user();
        $provider = Provider::where('user_id', $user->id)->first();

        if (!$central->podeMexer($notaFiscal, $user, $provider)) {
            return response()->json(['message' => 'Esta nota não é sua.'], 403);
        }
        if ($notaFiscal->status === 'CANCELADA') {
            return response()->json(['message' => 'Nota cancelada não pode ser reemitida.'], 422);
        }

        $nova = app(NotaFiscalService::class)->tentarNovamente($notaFiscal);

        return response()->json(['message' => 'Nova tentativa de emissão enviada.', 'status' => $nova->status]);
    }
}
