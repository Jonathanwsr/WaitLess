<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;
use App\Models\Cupom;
use App\Models\Pagamento;
use App\Models\Estabelecimento;
use App\Models\Agendamento;
use Inertia\Inertia;
use Carbon\Carbon;

class CarteiraController extends Controller
{
    public function index()
    {
        $user = Auth::user();
        $papel = $user->papel; 

        $props = [
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

            $props['dadosFuncionario'] = [
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
        if ($papel === 'socio') {
            // Busca dinâmica e segura usando a tabela pivô informada
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

            $props['dadosProprietario'] = [
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

            // CORREÇÃO APLICADA: Mapeando os Joins através da tabela pivô 'estabelecimento_usuario'
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

            $props['dadosAdmin'] = [
                'lucro_plataforma' => $lucroPlataforma,
                'extrato_global' => $extratoGlobal,
                'carteiras_asaas' => $carteirasAsaas, 
                'estabelecimentos' => $estabelecimentos
            ];
        }

        // =========================================================
        // 4. CLIENTE (USER)
        // =========================================================
        if ($papel === 'user') {
            $props['dadosCliente'] = [
                'recompensas' => Cupom::where('ativo', true)->latest()->get()
            ];
        }

        return Inertia::render('Funcionario/Carteira', $props);
    }

    // =========================================================
    // MÉTODOS DE AÇÃO
    // =========================================================

    public function fecharDia(Request $request) {
        return redirect()->back()->with('success', 'Expediente encerrado com sucesso.');
    }

    public function solicitarSaque(Request $request) {
        $user = Auth::user();
        
        // Garante a busca do estabelecimento através da tabela pivô para o saque
        $estabelecimento = $user->estabelecimento; 
        if (!$estabelecimento) {
            $pivot = DB::table('estabelecimento_usuario')->where('usuario_id', $user->id)->first();
            if ($pivot) {
                $estabelecimento = Estabelecimento::find($pivot->estabelecimento_id);
            }
        }
        
        $provider = DB::table('providers')->where('user_id', $user->id)->first();

        if (!$provider || !$provider->asaas_api_key) {
            return redirect()->back()->with('error', 'Configuração de pagamento incompleta. Chave Asaas não encontrada.');
        }

        if (empty($provider->pix_key) || empty($provider->pix_key_type)) {
            return redirect()->back()->with('error', 'Chave Pix não configurada na sua carteira.');
        }
        
        if ($estabelecimento && $estabelecimento->data_ultimo_saque) {
            $dataProximoSaque = Carbon::parse($estabelecimento->data_ultimo_saque)->addDays(7);
            if (now()->lessThan($dataProximoSaque)) {
                return redirect()->back()->with('error', 'Você só pode sacar a partir de: ' . $dataProximoSaque->format('d/m/Y H:i'));
            }
        }

        $responseSaldo = Http::withHeaders(['access_token' => $provider->asaas_api_key])
                             ->get(env('ASAAS_URL') . '/finance/balance');
        $saldoReal = $responseSaldo->successful() ? $responseSaldo->json('balance') : 0;

        if ($saldoReal <= 0) return redirect()->back()->with('error', 'Sem saldo disponível para saque.');

        $responseTransfer = Http::withHeaders(['access_token' => $provider->asaas_api_key])
            ->post(env('ASAAS_URL') . '/transfers', [
                'value' => $saldoReal,
                'pixAddressKey' => $provider->pix_key, 
                'pixAddressKeyType' => $provider->pix_key_type, 
                'description' => 'Saque via WaitLess',
            ]);

        if ($responseTransfer->failed()) return redirect()->back()->with('error', 'Falha ao processar o saque junto ao banco.');

        if ($estabelecimento) {
            $estabelecimento->update(['data_ultimo_saque' => now()]);
        }
        
        return redirect()->back()->with('success', "Saque de R$ {$saldoReal} solicitado com sucesso!");
    }

    public function resgatarCupom(Request $request, Cupom $cupom) {
        return redirect()->back()->with('success', 'Cupom resgatado!');
    }
}