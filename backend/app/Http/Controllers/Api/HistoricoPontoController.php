<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HistoricoPonto;
use App\Models\PontoUsuarioEstabelecimento;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class HistoricoPontoController extends Controller
{
    /**
     * GET /api/historico-pontos
     * Mostra o extrato de pontos do utilizador.
     *
     * Sem restrição, qualquer usuário autenticado podia informar o usuario_id
     * de OUTRA pessoa e ver o extrato de pontos dela. Agora só permite ver o
     * próprio extrato, ou o extrato de um estabelecimento que o usuário gerencia.
     */
    public function index(Request $request)
    {
        $query = HistoricoPonto::query();

        if ($request->has('usuario_id')) {
            if ((int) $request->usuario_id !== $request->user()->id) {
                abort(403, 'Você só pode ver o seu próprio extrato de pontos.');
            }
            $query->where('usuario_id', $request->usuario_id);
        } elseif ($request->has('estabelecimento_id')) {
            $gerencia = $request->user()->estabelecimentos()
                ->where('estabelecimentos.id', $request->estabelecimento_id)
                ->exists();
            abort_unless($gerencia, 403, 'Você não tem permissão para ver o extrato deste estabelecimento.');
        } else {
            // Sem nenhum filtro, mostra só o extrato de quem está pedindo.
            $query->where('usuario_id', $request->user()->id);
        }

        if ($request->has('estabelecimento_id')) {
            $query->where('estabelecimento_id', $request->estabelecimento_id);
        }

        return response()->json($query->orderBy('created_at', 'desc')->paginate(20));
    }

    /**
     * POST /api/historico-pontos
     * Ajuste MANUAL de pontos, feito por quem administra o estabelecimento
     * (ex.: correção de um erro, bônus especial). O fluxo normal de pontos
     * (check-in, indicação, compra) passa pelo PontosService/serviços de
     * gamificação, não por aqui.
     *
     * Antes disso não existia NENHUMA checagem: qualquer usuário autenticado
     * podia se creditar qualquer quantidade de pontos em qualquer
     * estabelecimento — e pontos viram desconto real em dinheiro. Essa era
     * a falha de segurança mais grave encontrada nesta auditoria.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'usuario_id' => 'required|exists:users,id',
            'estabelecimento_id' => 'required|exists:estabelecimentos,id',
            'agendamento_id' => 'nullable|exists:agendamentos,id',
            'tipo' => 'required|in:ganho,uso',
            'descricao' => 'required|string',
            'quantidade' => 'required|integer|min:1',
        ]);

        $gerencia = $request->user()->estabelecimentos()
            ->where('estabelecimentos.id', $validated['estabelecimento_id'])
            ->exists();

        abort_unless($gerencia, 403, 'Você não tem permissão para ajustar pontos neste estabelecimento.');

        if (!in_array($request->user()->papel, ['admin', 'socio', 'gerente'], true)) {
            abort(403, 'Só administradores, sócios ou gerentes podem fazer ajustes manuais de pontos.');
        }

        // DB::transaction garante que ou salva no histórico E no saldo, ou cancela tudo se der erro
        $historico = DB::transaction(function () use ($validated) {

            // 1. Cria o registo no histórico
            $registo = HistoricoPonto::create($validated);

            // 2. Procura a carteira de pontos do utilizador neste estabelecimento (se não existir, cria com saldo 0)
            $carteira = PontoUsuarioEstabelecimento::firstOrCreate(
                [
                    'usuario_id' => $validated['usuario_id'],
                    'estabelecimento_id' => $validated['estabelecimento_id']
                ],
                ['total_pontos' => 0]
            );

            // 3. Atualiza o saldo
            if ($validated['tipo'] === 'ganho') {
                $carteira->total_pontos += $validated['quantidade'];
            } else {
                $carteira->total_pontos -= $validated['quantidade'];
            }
            $carteira->save();

            return $registo;
        });

        return response()->json([
            'message' => 'Pontos registados com sucesso!',
            'data' => $historico
        ], 201);
    }

    public function show(Request $request, string $id)
    {
        $registro = HistoricoPonto::findOrFail($id);

        $ehDoProprioUsuario = (int) $registro->usuario_id === $request->user()->id;
        $gerenciaEstabelecimento = $registro->estabelecimento_id && $request->user()->estabelecimentos()
            ->where('estabelecimentos.id', $registro->estabelecimento_id)
            ->exists();

        abort_unless($ehDoProprioUsuario || $gerenciaEstabelecimento, 403);

        return response()->json($registro);
    }

    public function update(Request $request, string $id)
    {
        // Em sistemas de fidelidade estritos, o histórico não deve ser editado diretamente.
        return response()->json(['message' => 'A edição de histórico de pontos não é permitida.'], 403);
    }

    public function destroy(string $id)
    {
        // Mesma lógica: o extrato não deve poder ser apagado.
        return response()->json(['message' => 'A exclusão do histórico não é permitida.'], 403);
    }
}
