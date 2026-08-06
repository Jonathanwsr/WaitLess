<?php

namespace App\Http\Controllers\Api\Mobile\Proprietario;

use App\Http\Controllers\Controller;
use App\Models\Funcionario;
use App\Models\User;
use App\Models\Estabelecimento;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;

class FuncionarioMobileController extends Controller
{
    /**
     * Auxiliar para obter os IDs dos estabelecimentos pertencentes ao usuário logado.
     */
    private function getMeusEstabelecimentosIds($user)
    {
        return $user->estabelecimentos()->pluck('estabelecimentos.id')->toArray();
    }

    /**
     * Listagem geral de funcionários, faturamento, avaliações, fechamentos e ausências.
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $meusEstabelecimentos = $user->estabelecimentos()->get();
        $meusEstabelecimentosIds = $meusEstabelecimentos->pluck('id')->toArray();

        // 1. Busca os funcionários, conta serviços concluídos e soma faturamento
        $funcionarios = Funcionario::with(['usuario', 'estabelecimento'])
            ->whereIn('estabelecimento_id', $meusEstabelecimentosIds)
            ->where('ativo', true)
            ->withCount(['agendamentos as total_atendimentos' => function ($query) {
                $query->whereIn('status', ['concluido', 'finalizado']);
            }])
            ->withSum(['agendamentos as faturamento_total' => function ($query) {
                $query->whereIn('status', ['concluido', 'finalizado']);
            }], 'valor_final')
            ->get();

        // Calcula a média de avaliações manualmente para cada funcionário
        foreach ($funcionarios as $func) {
            $func->faturamento_total = $func->faturamento_total ?? 0;

            $media = DB::table('avaliacoes')
                ->join('agendamentos', 'avaliacoes.agendamento_id', '=', 'agendamentos.id')
                ->where('agendamentos.funcionario_id', $func->id)
                ->avg('avaliacoes.nota');

            $func->avaliacao_media = round($media, 1);
        }

        // 2. Busca produções/fechamentos recentes dos funcionários dessas lojas
        $fechamentosRecentes = DB::table('fechamentos_diarios')
            ->join('funcionarios', 'fechamentos_diarios.funcionario_id', '=', 'funcionarios.id')
            ->whereIn('funcionarios.estabelecimento_id', $meusEstabelecimentosIds)
            ->select('fechamentos_diarios.*', 'funcionarios.nome as funcionario_nome')
            ->orderBy('fechamentos_diarios.data_fechamento', 'desc')
            ->limit(30)
            ->get();

        // 3. Busca ausências (folgas) pendentes para o gerente aprovar
        $ausenciasPendentes = DB::table('ausencias_funcionarios')
            ->join('funcionarios', 'ausencias_funcionarios.funcionario_id', '=', 'funcionarios.id')
            ->join('estabelecimentos', 'funcionarios.estabelecimento_id', '=', 'estabelecimentos.id')
            ->whereIn('funcionarios.estabelecimento_id', $meusEstabelecimentosIds)
            ->where('ausencias_funcionarios.status', 'pendente')
            ->select('ausencias_funcionarios.*', 'funcionarios.nome as funcionario_nome', 'estabelecimentos.nome as loja_nome')
            ->orderBy('ausencias_funcionarios.created_at', 'asc')
            ->get();

        return response()->json([
            'status' => true,
            'data' => [
                'funcionarios' => $funcionarios,
                'meusEstabelecimentos' => $meusEstabelecimentos,
                'fechamentosRecentes' => $fechamentosRecentes,
                'ausenciasPendentes' => $ausenciasPendentes,
            ]
        ], 200);
    }

    /**
     * Cadastrar Novo Funcionário
     */
    public function store(Request $request)
    {
        $user = $request->user();
        $meusEstabelecimentosIds = $this->getMeusEstabelecimentosIds($user);

        $validated = $request->validate([
            'estabelecimento_id' => 'required|exists:estabelecimentos,id',
            'nome'               => 'required|string|max:255',
            'telefone'           => 'nullable|string|max:20',
            'cargo'              => 'required|string|max:255',
            'email'              => 'required|email|unique:users,email',
            'password'           => 'required|string|min:8',
        ]);

        // Verificação de Segurança
        if (!in_array($validated['estabelecimento_id'], $meusEstabelecimentosIds)) {
            return response()->json([
                'status' => false,
                'message' => 'Você não tem permissão para adicionar funcionários neste estabelecimento.'
            ], 403);
        }

        DB::beginTransaction();
        try {
            // Cria conta de acesso de Usuário
            $usuario = User::create([
                'name'     => $validated['nome'],
                'email'    => $validated['email'],
                'password' => Hash::make($validated['password']),
                'papel'    => $validated['cargo'],
            ]);

            // Cria o registro do Funcionário
            $funcionario = Funcionario::create([
                'estabelecimento_id' => $validated['estabelecimento_id'],
                'usuario_id'         => $usuario->id,
                'nome'               => $validated['nome'],
                'telefone'           => $validated['telefone'] ?? null,
                'cargo'              => $validated['cargo'],
                'ativo'              => true,
            ]);

            DB::commit();

            return response()->json([
                'status' => true,
                'message' => 'Funcionário e conta de acesso criados com sucesso!',
                'data' => $funcionario->load('usuario', 'estabelecimento')
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status' => false,
                'message' => 'Erro ao cadastrar funcionário: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Visualizar Detalhes do Funcionário para edição
     */
    public function show(Request $request, $id)
    {
        $user = $request->user();
        $meusEstabelecimentosIds = $this->getMeusEstabelecimentosIds($user);

        $funcionario = Funcionario::with(['usuario', 'estabelecimento'])->find($id);

        if (!$funcionario) {
            return response()->json([
                'status' => false,
                'message' => 'Funcionário não encontrado.'
            ], 404);
        }

        if (!in_array($funcionario->estabelecimento_id, $meusEstabelecimentosIds)) {
            return response()->json([
                'status' => false,
                'message' => 'Você não tem permissão para visualizar este funcionário.'
            ], 403);
        }

        return response()->json([
            'status' => true,
            'data' => [
                'funcionario' => $funcionario,
                'estabelecimentos' => $user->estabelecimentos()->get(),
            ]
        ], 200);
    }

    /**
     * Atualizar Funcionário
     */
    public function update(Request $request, $id)
    {
        $user = $request->user();
        $meusEstabelecimentosIds = $this->getMeusEstabelecimentosIds($user);

        $funcionario = Funcionario::find($id);

        if (!$funcionario) {
            return response()->json([
                'status' => false,
                'message' => 'Funcionário não encontrado.'
            ], 404);
        }

        if (!in_array($funcionario->estabelecimento_id, $meusEstabelecimentosIds)) {
            return response()->json([
                'status' => false,
                'message' => 'Você não tem permissão para editar este funcionário.'
            ], 403);
        }

        $validated = $request->validate([
            'nome'               => 'required|string|max:255',
            'telefone'           => 'nullable|string|max:20',
            'cargo'              => 'required|string|max:255',
            'email'              => 'nullable|email|unique:users,email,' . $funcionario->usuario_id,
            'password'           => 'nullable|string|min:8',
            'estabelecimento_id' => 'required|exists:estabelecimentos,id'
        ]);

        if (!in_array($validated['estabelecimento_id'], $meusEstabelecimentosIds)) {
            return response()->json([
                'status' => false,
                'message' => 'Você não possui permissão para transferir para este estabelecimento.'
            ], 403);
        }

        DB::beginTransaction();
        try {
            // Atualiza dados do Funcionário
            $funcionario->update([
                'nome'               => $validated['nome'],
                'telefone'           => $validated['telefone'],
                'cargo'              => $validated['cargo'],
                'estabelecimento_id' => $validated['estabelecimento_id']
            ]);

            // Atualiza dados do Usuário vinculado
            if ($funcionario->usuario_id) {
                $usuarioVinculado = User::find($funcionario->usuario_id);
                if ($usuarioVinculado) {
                    $usuarioVinculado->name = $validated['nome'];
                    $usuarioVinculado->papel = $validated['cargo'];

                    if (!empty($validated['email'])) {
                        $usuarioVinculado->email = $validated['email'];
                    }

                    if (!empty($validated['password'])) {
                        $usuarioVinculado->password = Hash::make($validated['password']);
                    }

                    $usuarioVinculado->save();
                }
            }

            DB::commit();

            return response()->json([
                'status' => true,
                'message' => 'Funcionário atualizado com sucesso!',
                'data' => $funcionario->load('usuario', 'estabelecimento')
            ], 200);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status' => false,
                'message' => 'Erro ao atualizar funcionário: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Inativar / Remover Funcionário da Escala
     */
    public function destroy(Request $request, $id)
    {
        $user = $request->user();
        $meusEstabelecimentosIds = $this->getMeusEstabelecimentosIds($user);

        $funcionario = Funcionario::find($id);

        if (!$funcionario) {
            return response()->json([
                'status' => false,
                'message' => 'Funcionário não encontrado.'
            ], 404);
        }

        if (!in_array($funcionario->estabelecimento_id, $meusEstabelecimentosIds)) {
            return response()->json([
                'status' => false,
                'message' => 'Você não tem permissão para inativar este funcionário.'
            ], 403);
        }

        $funcionario->update(['ativo' => false]);

        return response()->json([
            'status' => true,
            'message' => 'Funcionário inativado e removido da escala com sucesso!'
        ], 200);
    }

    /**
     * Decidir sobre Solicitação de Ausência / Folga
     */
    public function decidirAusencia(Request $request, $id)
    {
        $user = $request->user();
        $papel = strtolower(trim($user->papel ?? ''));

        // Proteção Rigorosa
        if (!in_array($papel, ['admin', 'proprietario', 'socio', 'gerente'])) {
            return response()->json([
                'status' => false,
                'message' => 'Acesso Negado: Apenas a gerência ou proprietários podem aprovar folgas.'
            ], 403);
        }

        $request->validate([
            'status' => 'required|in:aprovado,recusado'
        ]);

        $ausencia = DB::table('ausencias_funcionarios')->where('id', $id)->first();

        if (!$ausencia) {
            return response()->json([
                'status' => false,
                'message' => 'Solicitação de ausência não encontrada.'
            ], 404);
        }

        // Verifica permissão sobre a loja do funcionário
        $meusEstabelecimentosIds = $this->getMeusEstabelecimentosIds($user);
        $funcionario = Funcionario::find($ausencia->funcionario_id);

        if (!$funcionario || !in_array($funcionario->estabelecimento_id, $meusEstabelecimentosIds)) {
            return response()->json([
                'status' => false,
                'message' => 'Você não tem permissão para decidir ausências deste estabelecimento.'
            ], 403);
        }

        DB::table('ausencias_funcionarios')->where('id', $id)->update([
            'status' => $request->status,
            'updated_at' => now()
        ]);

        $mensagem = $request->status === 'aprovado' ? 'Folga aprovada com sucesso!' : 'Solicitação de folga recusada.';

        return response()->json([
            'status' => true,
            'message' => $mensagem
        ], 200);
    }
}