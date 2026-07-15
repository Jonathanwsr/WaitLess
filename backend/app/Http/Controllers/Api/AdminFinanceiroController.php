<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\PagamentoService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;
use Inertia\Inertia;
use Exception;

class AdminFinanceiroController extends Controller
{
    protected $pagamentoService;

    public function __construct(PagamentoService $pagamentoService)
    {
        $this->pagamentoService = $pagamentoService;
    }

    public function index()
    {
        // 1. Provedores
        $provedores = DB::table('providers')
            ->join('users', 'providers.user_id', '=', 'users.id')
            ->select(
                'providers.id',
                'users.name as proprietario_nome',
                'users.email as proprietario_email',
                'providers.saldo',
                'providers.pix_key',
                'providers.asaas_wallet_id'
            )
            ->get();

        // 2. Fila Ativa
        $jobsEmAndamento = DB::table('jobs')
            ->select('id', 'queue', 'attempts', 'reserved_at', 'available_at')
            ->get();

        // 3. Fila Falhada
        $jobsFalhados = DB::table('failed_jobs')
            ->select('id', 'connection', 'queue', 'failed_at')
            ->get();

        // 4. NOVO: Extrato Global (Últimas 15 transações de todos os prestadores)
        $ultimasTransacoes = DB::table('extrato_providers')
            ->join('providers', 'extrato_providers.provider_id', '=', 'providers.id')
            ->join('users', 'providers.user_id', '=', 'users.id')
            ->select('extrato_providers.*', 'users.name as proprietario_nome')
            ->orderBy('extrato_providers.created_at', 'desc')
            ->limit(15)
            ->get();

        // 5. NOVO: Calcular a data do próximo repasse automático (Próxima Segunda-feira às 05:00)
        $proximaSegunda = Carbon::now()->next(Carbon::MONDAY)->setTime(5, 0)->format('d/m/Y \à\s H:i');

        return Inertia::render('Admin/FinanceiroMaster', [
            'provedores' => $provedores,
            'filaJobs' => $jobsEmAndamento,
            'filaFalhados' => $jobsFalhados,
            'ultimasTransacoes' => $ultimasTransacoes,
            'proximoRepasse' => $proximaSegunda
        ]);
    }

    public function repassarManual(Request $request, $id)
    {
        // Valida se veio um valor específico
        $request->validate([
            'valor_repasse' => 'nullable|numeric|min:1'
        ]);

        $provider = DB::table('providers')->where('id', $id)->first();

        if (!$provider) return redirect()->back()->withErrors(['error' => 'Prestador não encontrado.']);
        if ($provider->saldo <= 0) return redirect()->back()->withErrors(['error' => 'Sem saldo.']);
        if (!$provider->pix_key) return redirect()->back()->withErrors(['error' => 'Chave PIX não cadastrada.']);

        // Se enviou o valor, usa. Se não, usa o saldo total.
        $valorTransferencia = $request->valor_repasse ? (float) $request->valor_repasse : $provider->saldo;

        if ($valorTransferencia > $provider->saldo) {
            return redirect()->back()->withErrors(['error' => 'O valor solicitado é maior que o saldo disponível na carteira deste lojista.']);
        }

        try {
            DB::beginTransaction();

            $enviado = $this->pagamentoService->repassarSaldoPixProvedor($provider->id, $valorTransferencia);

            if ($enviado) {
                DB::table('extrato_providers')->insert([
                    'provider_id'      => $provider->id,
                    'usuario_id'       => null, 
                    'origem_type'      => 'App\Models\Provider',
                    'origem_id'        => $provider->id,
                    'tipo'             => 'repasse', 
                    'valor_bruto'      => $valorTransferencia,
                    'taxa_plataforma'  => 0,
                    'valor_liquido'    => $valorTransferencia * -1, 
                    'descricao'        => 'Repasse manual enviado pelo Administrador via PIX',
                    'status'           => 'liberado',
                    'codigo_transacao' => 'MANUAL_TRANSFER_'.uniqid(),
                    'metodo_pagamento' => 'pix',
                    'created_at'       => now()
                ]);

                DB::commit();
                return redirect()->back()->with('success', "Repasse de R$ " . number_format($valorTransferencia, 2, ',', '.') . " processado com sucesso!");
            }

            DB::rollBack();
            return redirect()->back()->withErrors(['error' => 'O gateway Asaas rejeitou a transferência.']);

        } catch (Exception $e) {
            DB::rollBack();
            Log::error("Erro no repasse manual: " . $e->getMessage());
            return redirect()->back()->withErrors(['error' => 'Erro interno: ' . $e->getMessage()]);
        }
    }

    public function enviarEmailPersonalizado(Request $request)
    {
        $request->validate([
            'email_destino' => 'required|email',
            'assunto'       => 'required|string|max:150',
            'mensagem'      => 'required|string'
        ]);

        try {
            $conteudoMensagem = $request->mensagem;
            Mail::raw($conteudoMensagem, function ($message) use ($request) {
                $message->to($request->email_destino)->subject($request->assunto);
            });

            return redirect()->back()->with('success', 'E-mail enviado com sucesso!');
        } catch (Exception $e) {
            Log::error("Falha ao enviar e-mail Brevo: " . $e->getMessage());
            return redirect()->back()->withErrors(['error' => 'O Servidor recusou o envio: ' . $e->getMessage()]);
        }
    }

    /**
     * NOVO MÉTODO: Retorna as métricas gerais e tabelas paginadas apenas para Administradores.
     */
    public function obterDadosGeraisAdmin(Request $request)
    {
        // 1. SEGURANÇA: Garante que apenas usuários com papel de 'admin' acessem.
        $usuario = $request->user();

        if (!$usuario) {
            return response()->json(['error' => 'Usuário não autenticado.'], 401);
        }

        // Validação da coluna 'role' na tabela de usuários OU como tipo 'admin' na tabela pivot de estabelecimentos
        $isAdminGlobal = isset($usuario->role) && $usuario->role === 'admin';
        $isAdminVinculado = DB::table('estabelecimento_usuario')
            ->where('usuario_id', $usuario->id)
            ->where('tipo', 'admin')
            ->exists();

        if (!$isAdminGlobal && !$isAdminVinculado) {
            return response()->json([
                'error' => 'Acesso negado. Apenas o perfil admin pode obter estes dados.'
            ], 403);
        }

        // 2. MÉTRICAS GERAIS (Counts de todas as tabelas)
        $totalEstabelecimentos = DB::table('estabelecimentos')->count();
        $totalServicos = DB::table('servicos')->count();
        
        // Quantos funcionários (exclui o tipo comum 'user')
        $totalFuncionarios = DB::table('estabelecimento_usuario')
            ->whereIn('tipo', ['gerente', 'atendente', 'socio', 'admin'])
            ->count();

        // Quantidade total de pagamentos do extrato global
        $totalPagamentos = DB::table('extrato_providers')->count();

        // Quantidade de pontos totais distribuídos no sistema
        $totalPontosDistribuidos = DB::table('pontos_usuario_estabelecimento')->sum('total_points') 
            ?? DB::table('pontos_usuario_estabelecimento')->sum('total_pontos') 
            ?? 0;

        // 3. PAGINAÇÃO INDEPENDENTE (Evita que mudar de página em uma tabela interfira na outra)
        
        // Estabelecimentos Paginados (10 por página)
        $estabelecimentos = DB::table('estabelecimentos')
            ->orderBy('nome', 'asc')
            ->paginate(10, ['*'], 'estabelecimentos_page');

        // Serviços Paginados vinculados ao nome do estabelecimento correspondente
        $servicos = DB::table('servicos')
            ->join('estabelecimentos', 'servicos.estabelecimento_id', '=', 'estabelecimentos.id')
            ->select('servicos.*', 'estabelecimentos.nome as estabelecimento_nome')
            ->orderBy('servicos.nome', 'asc')
            ->paginate(10, ['*'], 'servicos_page');

        // Funcionários Paginados vinculados às informações de usuário e estabelecimento
        $funcionarios = DB::table('estabelecimento_usuario')
            ->join('users', 'estabelecimento_usuario.usuario_id', '=', 'users.id')
            ->join('estabelecimentos', 'estabelecimento_usuario.estabelecimento_id', '=', 'estabelecimentos.id')
            ->select(
                'estabelecimento_usuario.id',
                'estabelecimento_usuario.tipo',
                'users.name as funcionario_nome',
                'users.email as funcionario_email',
                'estabelecimentos.nome as estabelecimento_nome'
            )
            ->whereIn('estabelecimento_usuario.tipo', ['gerente', 'atendente', 'socio', 'admin'])
            ->orderBy('users.name', 'asc')
            ->paginate(10, ['*'], 'funcionarios_page');

        // Pontuação dos usuários nos estabelecimentos paginados
        $pontosUsuarios = DB::table('pontos_usuario_estabelecimento')
            ->join('users', 'pontos_usuario_estabelecimento.usuario_id', '=', 'users.id')
            ->join('estabelecimentos', 'pontos_usuario_estabelecimento.estabelecimento_id', '=', 'estabelecimentos.id')
            ->select(
                'pontos_usuario_estabelecimento.*',
                'users.name as usuario_nome',
                'estabelecimentos.nome as estabelecimento_nome'
            )
            ->orderBy('pontos_usuario_estabelecimento.total_pontos', 'desc')
            ->paginate(10, ['*'], 'pontos_page');

        // 4. RETORNO DO JSON CONSOLIDADO
        return response()->json([
            'success' => true,
            'metricas_gerais' => [
                'total_estabelecimentos'   => $totalEstabelecimentos,
                'total_servicos'           => $totalServicos,
                'total_funcionarios'       => $totalFuncionarios,
                'total_pagamentos'         => $totalPagamentos,
                'total_pontos_gerados'     => $totalPontosDistribuidos,
            ],
            'dados' => [
                'estabelecimentos' => $estabelecimentos,
                'servicos'         => $servicos,
                'funcionarios'     => $funcionarios,
                'pontos_usuarios'  => $pontosUsuarios,
            ]
        ], 200);
    }
}