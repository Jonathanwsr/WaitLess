<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Funcionario;
use Illuminate\Http\Request;
use App\Models\User;
use App\Models\Estabelecimento;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class FuncionarioController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $meusEstabelecimentos = $user->estabelecimentos()->get();
        $meusEstabelecimentosIds = $meusEstabelecimentos->pluck('id');
        
        // 1. MAGIA DO LARAVEL: Busca os funcionários, conta serviços e soma faturamento
        $funcionarios = Funcionario::with(['usuario', 'estabelecimento'])
            ->whereIn('estabelecimento_id', $meusEstabelecimentosIds)
            ->withCount(['agendamentos as total_atendimentos' => function ($query) {
                $query->whereIn('status', ['concluido', 'finalizado']);
            }])
            ->withSum(['agendamentos as faturamento_total' => function ($query) {
                $query->whereIn('status', ['concluido', 'finalizado']);
            }], 'valor_final')
            ->get();

        // Calcula a média de avaliações manualmente para cada um
        foreach ($funcionarios as $func) {
            $func->faturamento_total = $func->faturamento_total ?? 0; 
            
            $media = DB::table('avaliacoes')
                ->join('agendamentos', 'avaliacoes.agendamento_id', '=', 'agendamentos.id')
                ->where('agendamentos.funcionario_id', $func->id)
                ->avg('avaliacoes.nota');
                
            $func->avaliacao_media = $media;
        }

        // 2. BUSCA PRODUÇÃO (FECHAMENTOS RECENTES) DOS FUNCIONÁRIOS DESSAS LOJAS
        $fechamentosRecentes = DB::table('fechamentos_diarios')
            ->join('funcionarios', 'fechamentos_diarios.funcionario_id', '=', 'funcionarios.id')
            ->whereIn('funcionarios.estabelecimento_id', $meusEstabelecimentosIds)
            ->select('fechamentos_diarios.*', 'funcionarios.nome as funcionario_nome')
            ->orderBy('fechamentos_diarios.data_fechamento', 'desc')
            ->limit(30)
            ->get();

        // 3. BUSCA AUSÊNCIAS (FOLGAS) PENDENTES PARA O GERENTE APROVAR
        $ausenciasPendentes = DB::table('ausencias_funcionarios')
            ->join('funcionarios', 'ausencias_funcionarios.funcionario_id', '=', 'funcionarios.id')
            ->join('estabelecimentos', 'funcionarios.estabelecimento_id', '=', 'estabelecimentos.id')
            ->whereIn('funcionarios.estabelecimento_id', $meusEstabelecimentosIds)
            ->where('ausencias_funcionarios.status', 'pendente') // Filtra apenas as pendentes!
            ->select('ausencias_funcionarios.*', 'funcionarios.nome as funcionario_nome', 'estabelecimentos.nome as loja_nome')
            ->orderBy('ausencias_funcionarios.created_at', 'asc')
            ->get();

        return Inertia::render('Estabelecimentos/Funcionarios', [
            'funcionarios' => $funcionarios,
            'meusEstabelecimentos' => $meusEstabelecimentos,
            'fechamentosRecentes' => $fechamentosRecentes,
            'ausenciasPendentes' => $ausenciasPendentes
        ]);
    }

    // 👉 NOVA FUNÇÃO DE GESTÃO: Aprovar ou Recusar Folgas (Blindada)
    public function decidirAusencia(Request $request, $id)
    {
        $papel = strtolower(trim(Auth::user()->papel));
        
        // Proteção Rigorosa: Só a chefia pode decidir
        if (!in_array($papel, ['admin', 'proprietario', 'socio', 'gerente'])) {
            abort(403, 'Acesso Negado: Apenas a gerência ou proprietários podem aprovar folgas.');
        }

        $request->validate([
            'status' => 'required|in:aprovado,recusado'
        ]);

        DB::table('ausencias_funcionarios')->where('id', $id)->update([
            'status' => $request->status,
            'updated_at' => now()
        ]);

        $mensagem = $request->status === 'aprovado' ? 'Folga aprovada com sucesso!' : 'Solicitação de folga recusada.';
        return back()->with('success', $mensagem);
    }

    public function store(Request $request, Estabelecimento $estabelecimento)
    {
        $validated = $request->validate([
            'nome'     => 'required|string|max:255',
            'telefone' => 'nullable|string|max:20',
            'cargo'    => 'required|string|max:255',
            'email'    => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
        ]);

        $user = User::create([
            'name'     => $validated['nome'],
            'email'    => $validated['email'],
            'password' => Hash::make($validated['password']),
            'papel'    => $validated['cargo'], 
        ]);

        $estabelecimento->funcionarios()->create([
            'usuario_id' => $user->id,
            'nome'       => $validated['nome'],
            'telefone'   => $validated['telefone'],
            'cargo'      => $validated['cargo'],
        ]);

        return redirect()->back()->with('success', 'Funcionário e conta de acesso criados!');
    }

    public function update(Request $request, Funcionario $funcionario)
    {
        $validated = $request->validate([
            'nome'     => 'required|string|max:255',
            'telefone' => 'nullable|string|max:20',
            'cargo'    => 'required|string|max:255',
            'email'    => 'nullable|email|unique:users,email,' . $funcionario->usuario_id,
            'password' => 'nullable|string|min:8',
            'estabelecimento_id' => 'required|exists:estabelecimentos,id'
        ]);

        $funcionario->update([
            'nome'     => $validated['nome'],
            'telefone' => $validated['telefone'],
            'cargo'    => $validated['cargo'],
            'estabelecimento_id' => $validated['estabelecimento_id'] // Permite transferir de loja
        ]);

        if ($funcionario->usuario_id) {
            $user = User::find($funcionario->usuario_id);
            if ($user) {
                $user->name = $validated['nome'];
                $user->papel = $validated['cargo'];
                
                if (!empty($validated['email'])) {
                    $user->email = $validated['email'];
                }
                if (!empty($validated['password'])) {
                    $user->password = Hash::make($validated['password']);
                }
                $user->save();
            }
        }

        return redirect()->back()->with('success', 'Funcionário atualizado com sucesso!');
    }

    public function destroy(Funcionario $funcionario)
    {
        $funcionario->update(['ativo' => false]);
        return redirect()->back()->with('success', 'Funcionário inativado e removido da escala.');
    }

    public function edit(Funcionario $funcionario)
{
    // 1. Pega os IDs de todos os estabelecimentos que o usuário logado gerencia
    $estabelecimentosIdsDoUsuario = auth()->user()->estabelecimentos()->pluck('estabelecimento_id')->toArray();

    // 2. NOVA BARREIRA DE SEGURANÇA:
    // Verifica se o estabelecimento do funcionário NÃO está na lista de estabelecimentos do usuário
    if (!in_array($funcionario->estabelecimento_id, $estabelecimentosIdsDoUsuario)) {
        // Bloqueia se ele tentar acessar um funcionário de um local que não é dele
        abort(403, 'Você não tem permissão para editar funcionários de outro estabelecimento.');
    }

    // 3. Carrega o relacionamento do usuário vinculado ao funcionário (onde fica o e-mail)
    $funcionario->load('usuario');

    // 4. Busca APENAS os estabelecimentos que pertencem a esse usuário para listar no <select> do React
    $estabelecimentosAlocados = auth()->user()->estabelecimentos;

    return inertia('Estabelecimentos/EditarFuncionario', [
        'funcionario' => $funcionario,
        'estabelecimentos' => $estabelecimentosAlocados,
    ]);



        
    }
}