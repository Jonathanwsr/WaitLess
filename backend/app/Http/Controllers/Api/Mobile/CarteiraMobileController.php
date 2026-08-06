<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;
use App\Models\Cupom;
use App\Models\Pagamento;
use App\Models\Estabelecimento;
use App\Models\Agendamento;
use Carbon\Carbon;

class CarteiraMobileController extends Controller
{
    /**
     * Retorna os dados da carteira dependendo do papel do usuário
     */
    public function index()
    {
        $user = Auth::user();
        $papel = $user->papel; 

        $data = [
            'papel' => $papel,
        ];

        // =========================================================
        // 1. FUNCIONÁRIOS (GERENTE OU ATENDENTE)
        // =========================================================
        if ($papel === 'gerente' || $papel === 'atendente') {
            $hoje = Carbon::today()->toDateString();
            
            $servicosHoje = Agendamento::where('funcionario_id', $user->id)
                ->whereDate('data_servico', $hoje)
                ->where('status', 'concluido')
                ->get();

            $historicoFechamentos = Pagamento::whereHas('agendamento', function($q) use ($user) {
                    $q->where('funcionario_id', $user->id);
                })
                ->selectRaw('DATE(created_at) as data_fechamento, SUM(valor_total) as valor_total, COUNT(id) as qtd_servicos')
                ->groupBy('data_fechamento')
                ->orderBy('data_fechamento', 'desc')
                ->take(7)
                ->get();

            $data['dadosFuncionario'] = [
                'valorHoje' => $servicosHoje->sum('valor_total'), 
                'qtdHoje' => $servicosHoje->count(),
                'ganhosMes' => Pagamento::whereHas('agendamento', function($q) use ($user) {
                                    $q->where('funcionario_id', $user->id)
                                      ->whereMonth('data_servico', Carbon::now()->month);
                                })->sum('valor_total'),
                'metaMensal' => $user->meta_mensal ?? 3000.00,
                'historicoFechamentos' => $historicoFechamentos,
                'mesAtual' => Carbon::now()->translatedFormat('F'),
                'jaFechouHoje' => (bool)$user->ja_fechou_caixa_hoje
            ];
        }

        // =========================================================
        // 2. PROPRIETÁRIO (SÓCIO) 
        // =========================================================
        if ($papel === 'socio' || $papel === 'proprietario') {
            $estabelecimento = $user->estabelecimento;
            if (!$estabelecimento) {
                $pivot = DB::table('estabelecimento_usuario')->where('usuario_id', $user->id)->first();
                if ($pivot) {
                    $estabelecimento = Estabelecimento::find($pivot->estabelecimento_id);
                }
            }
            
            $provider = DB::table('providers')->where('user_id', $user->id)->first();
            
            $saldoDisponivel = 0.00;
            $podeSacar = false;
            $dataProximoSaque = null;
            $extratoPagamentos = [];

            if ($provider && $provider->asaas_api_key) {
                $response = Http::withHeaders(['access_token' => $provider->asaas_api_key])
                                ->get(env('ASAAS_URL') . '/finance/balance');
                if ($response->successful()) {
                    $saldoDisponivel = $response->json('balance');
                }
            }

            if ($estabelecimento) {
                if (!$estabelecimento->data_ultimo_saque) {
                    $podeSacar = true;
                } else {
                    $dataProximoSaque = Carbon::parse($estabelecimento->data_ultimo_saque)->addDays(7);
                    $podeSacar = now()->greaterThanOrEqualTo($dataProximoSaque);
                }

                $extratoPagamentos = Pagamento::whereHas('agendamento', function($query) use ($estabelecimento) {
                        $query->where('estabelecimento_id', $estabelecimento->id);
                    })->orderBy('created_at', 'desc')->take(20)->get();
            }

            $data['dadosProprietario'] = [
                'nome_estabelecimento' => $estabelecimento->nome ?? 'Não vinculado',
                'saldo_disponivel' => $saldoDisponivel,
                'pode_sacar' => $podeSacar,
                'data_proximo_saque' => $dataProximoSaque ? $dataProximoSaque->format('Y-m-d H:i:s') : null,
                'extrato' => $extratoPagamentos,
                'asaas_status' => $provider->asaas_status ?? null
            ];
        }

        // =========================================================
        // 3. ADMIN - VISÃO GLOBAL
        // =========================================================
        if ($papel === 'admin') {
            $lucroPlataforma = Pagamento::sum('taxa_plataforma');
            
            $extratoGlobal = Pagamento::with(['agendamento.estabelecimento'])
                                ->orderBy('created_at', 'desc')
                                ->take(40)
                                ->get();

            $providers = DB::table('providers')
                            ->join('users', 'providers.user_id', '=', 'users.id')
                            ->select('providers.*', 'users.name as nome_usuario', 'users.email')
                            ->get();

            $carteirasAsaas = [];

            foreach ($providers as $prov) {
                $saldo = 0.00;
                if (!empty($prov->asaas_api_key)) {
                    $respostaAsaas = Http::withHeaders(['access_token' => $prov->asaas_api_key])
                                         ->get(env('ASAAS_URL') . '/finance/balance');
                    if ($respostaAsaas->successful()) {
                        $saldo = $respostaAsaas->json('balance');
                    }
                }

                $carteirasAsaas[] = [
                    'user_id' => $prov->user_id,
                    'nome_usuario' => $prov->nome_usuario,
                    'email' => $prov->email,
                    'asaas_wallet_id' => $prov->asaas_wallet_id,
                    'asaas_status' => $prov->asaas_status,
                    'saldo_atual' => $saldo
                ];
            }

            $estabelecimentos = Estabelecimento::select(
                                    'estabelecimentos.id', 
                                    'estabelecimentos.nome', 
                                    'providers.pix_key', 
                                    'providers.pix_key_type'
                                )
                                ->leftJoin('estabelecimento_usuario', 'estabelecimentos.id', '=', 'estabelecimento_usuario.estabelecimento_id')
                                ->leftJoin('users', function($join) {
                                    $join->on('estabelecimento_usuario.usuario_id', '=', 'users.id')
                                         ->where('users.papel', '=', 'socio');
                                })
                                ->leftJoin('providers', 'users.id', '=', 'providers.user_id')
                                ->withCount('agendamentos')
                                ->get();

            $data['dadosAdmin'] = [
                'lucro_plataforma' => $lucroPlataforma,
                'extrato_global' => $extratoGlobal,
                'carteiras_asaas' => $carteirasAsaas, 
                'estabelecimentos' => $estabelecimentos
            ];
        }

        // =========================================================
        // 4. CLIENTE (USER)
        // =========================================================
        if ($papel === 'user' || $papel === 'cliente') {
            $data['dadosCliente'] = [
                'recompensas' => Cupom::where('ativo', true)->latest()->get()
            ];
        }

        return response()->json([
            'status' => 'success',
            'data' => $data
        ], 200);
    }

    // =========================================================
    // MÉTODOS DE AÇÃO
    // =========================================================

    public function fecharDia(Request $request) 
    {
        // Lógica para marcar que o funcionário fechou o caixa hoje
        return response()->json([
            'status' => 'success',
            'message' => 'Expediente encerrado com sucesso.'
        ], 200);
    }

    public function solicitarSaque(Request $request) 
    {
        $user = Auth::user();
        
        $estabelecimento = $user->estabelecimento; 
        if (!$estabelecimento) {
            $pivot = DB::table('estabelecimento_usuario')->where('usuario_id', $user->id)->first();
            if ($pivot) {
                $estabelecimento = Estabelecimento::find($pivot->estabelecimento_id);
            }
        }
        
        $provider = DB::table('providers')->where('user_id', $user->id)->first();

        if (!$provider || !$provider->asaas_api_key) {
            return response()->json(['error' => 'Configuração de pagamento incompleta. Chave Asaas não encontrada.'], 400);
        }

        if (empty($provider->pix_key) || empty($provider->pix_key_type)) {
            return response()->json(['error' => 'Chave Pix não configurada na sua carteira.'], 400);
        }
        
        if ($estabelecimento && $estabelecimento->data_ultimo_saque) {
            $dataProximoSaque = Carbon::parse($estabelecimento->data_ultimo_saque)->addDays(7);
            if (now()->lessThan($dataProximoSaque)) {
                return response()->json(['error' => 'Você só pode sacar a partir de: ' . $dataProximoSaque->format('d/m/Y H:i')], 403);
            }
        }

        $responseSaldo = Http::withHeaders(['access_token' => $provider->asaas_api_key])
                             ->get(env('ASAAS_URL') . '/finance/balance');
        $saldoReal = $responseSaldo->successful() ? $responseSaldo->json('balance') : 0;

        if ($saldoReal <= 0) {
            return response()->json(['error' => 'Sem saldo disponível para saque.'], 400);
        }

        $responseTransfer = Http::withHeaders(['access_token' => $provider->asaas_api_key])
            ->post(env('ASAAS_URL') . '/transfers', [
                'value' => $saldoReal,
                'pixAddressKey' => $provider->pix_key, 
                'pixAddressKeyType' => $provider->pix_key_type, 
                'description' => 'Saque via WaitLess Mobile',
            ]);

        if ($responseTransfer->failed()) {
            return response()->json(['error' => 'Falha ao processar o saque junto ao banco.'], 500);
        }

        if ($estabelecimento) {
            $estabelecimento->update(['data_ultimo_saque' => now()]);
        }
        
        return response()->json([
            'status' => 'success',
            'message' => "Saque de R$ {$saldoReal} solicitado com sucesso!"
        ], 200);
    }

    public function resgatarCupom(Request $request, $id) 
    {
        $cupom = Cupom::findOrFail($id);
        
        // Aqui vai a lógica de debitar os pontos do usuário, se aplicável.
        
        return response()->json([
            'status' => 'success',
            'message' => 'Cupom resgatado com sucesso!'
        ], 200);
    }

    public function assinarPlus(Request $request)
    {
        // Lógica para assinar o plano Plus / Processamento de pagamento
        return response()->json([
            'status' => 'success',
            'message' => 'Assinatura Plus ativada.'
        ], 200);
    }
}