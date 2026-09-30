<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Events\MensagemEnviada;
use App\Http\Controllers\Controller;
use App\Models\Conversa;
use App\Models\Funcionario;
use App\Models\Mensagem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * Equivalente mobile do MensagemController (web): mesma modelagem de dados
 * (Conversa/Mensagem), porém devolvendo JSON em vez de páginas Inertia.
 */
class MensagemMobileController extends Controller
{
    private function autorizado($user, Conversa $conversa): bool
    {
        if ((int) $conversa->usuario_id === (int) $user->id) {
            return true;
        }

        if ($conversa->funcionario_id) {
            $funcionario = Funcionario::find($conversa->funcionario_id);
            if ($funcionario && (int) $funcionario->usuario_id === (int) $user->id) {
                return true;
            }
        }

        if ($conversa->aluguel_id && (int) $conversa->estabelecimento_id === (int) $user->id) {
            return true;
        }

        return DB::table('estabelecimento_usuario')
            ->where('usuario_id', $user->id)
            ->where('estabelecimento_id', $conversa->estabelecimento_id)
            ->exists();
    }

    private function ehEquipe($user, Conversa $conversa): bool
    {
        return (int) $conversa->usuario_id !== (int) $user->id;
    }

    public function index()
    {
        return response()->json([
            'conversas' => $this->carregarListaConversas(Auth::user()),
        ]);
    }

    public function show($id)
    {
        $user = Auth::user();
        $conversa = Conversa::with(['usuario', 'estabelecimento', 'donoDireto', 'funcionario', 'agendamento.servico', 'aluguel.item'])->findOrFail($id);

        if (! $this->autorizado($user, $conversa)) {
            abort(403, 'Acesso não autorizado a esta conversa.');
        }

        $isEst = $this->ehEquipe($user, $conversa);
        $nomeAtivo = ($isEst ? $conversa->usuario->name : $conversa->nomeContraparte()) ?? 'Usuário';

        $conversa->mensagens()
            ->where('remetente_id', '!=', $user->id)
            ->whereNull('lida_em')
            ->update(['lida_em' => now()]);

        $mensagens = $conversa->mensagens()
            ->orderBy('created_at', 'asc')
            ->get()
            ->map(fn (Mensagem $msg) => [
                'id' => $msg->id,
                'conteudo' => $msg->conteudo,
                'horario' => $msg->created_at->format('H:i'),
                'data' => $msg->created_at->format('d/m/Y'),
                'is_mine' => $msg->remetente_id === $user->id,
            ]);

        return response()->json([
            'conversa' => [
                'id' => $conversa->id,
                'nome' => $nomeAtivo,
                'contexto' => $conversa->agendamento?->servico?->nome ?? $conversa->aluguel?->item?->nome ?? null,
                'funcionario_nome' => $conversa->funcionario?->nome,
                'avatar' => $isEst ? $conversa->usuario->foto_perfil : ($conversa->aluguel_id ? $conversa->donoDireto?->foto_perfil : $conversa->estabelecimento?->foto_perfil),
                'iniciais' => strtoupper(substr($nomeAtivo, 0, 1)),
            ],
            'mensagens' => $mensagens,
        ]);
    }

    public function enviar(Request $request, $id)
    {
        $request->validate(['conteudo' => 'required|string|max:1000']);

        $user = Auth::user();
        $conversa = Conversa::findOrFail($id);

        if (! $this->autorizado($user, $conversa)) {
            abort(403, 'Acesso não autorizado a esta conversa.');
        }

        $mensagem = Mensagem::create([
            'conversa_id' => $conversa->id,
            'remetente_id' => $user->id,
            'tipo_remetente' => $user->id === $conversa->usuario_id ? 'user' : 'estabelecimento',
            'conteudo' => $request->conteudo,
        ]);

        $conversa->touch();
        event(new MensagemEnviada($mensagem));

        return response()->json([
            'id' => $mensagem->id,
            'conteudo' => $mensagem->conteudo,
            'horario' => $mensagem->created_at->format('H:i'),
            'data' => $mensagem->created_at->format('d/m/Y'),
            'is_mine' => true,
        ]);
    }

    public function iniciar(Request $request)
    {
        $validated = $request->validate([
            'estabelecimento_id' => 'nullable|exists:estabelecimentos,id',
            'funcionario_id'     => 'nullable|exists:funcionarios,id',
            'agendamento_id'     => 'nullable|exists:agendamentos,id',
            'aluguel_id'         => 'nullable|exists:alugueis,id',
        ]);

        // Conversa sobre uma locação/aluguel: não passa por um Estabelecimento
        // de verdade (ver Conversa::donoDireto) — o dono vem direto do
        // aluguel, ignorando qualquer estabelecimento_id vindo do app.
        if (!empty($validated['aluguel_id'])) {
            $aluguel = \App\Models\Aluguel::findOrFail($validated['aluguel_id']);
            if ((int) Auth::id() !== (int) $aluguel->locatario_id) {
                abort(403, 'Você não tem acesso a esta locação.');
            }
            $validated['estabelecimento_id'] = $aluguel->estabelecimento_id;
        } elseif (empty($validated['estabelecimento_id'])) {
            abort(422, 'estabelecimento_id é obrigatório fora do contexto de uma locação.');
        }

        $dados = array_merge($validated, ['usuario_id' => Auth::id()]);

        if (empty($validated['funcionario_id']) && empty($validated['agendamento_id']) && empty($validated['aluguel_id'])) {
            $conversa = Conversa::firstOrCreate([
                'usuario_id'         => Auth::id(),
                'estabelecimento_id' => $validated['estabelecimento_id'],
                'funcionario_id'     => null,
                'agendamento_id'     => null,
                'aluguel_id'         => null,
            ]);
        } else {
            $conversa = Conversa::firstOrCreate($dados);
        }

        return response()->json(['id' => $conversa->id]);
    }

    /**
     * Total de mensagens não lidas do usuário logado, pra alimentar o sino
     * de notificações do dashboard (badge + lista das últimas conversas).
     */
    public function naoLidas()
    {
        $user = Auth::user();
        $conversas = $this->carregarListaConversas($user);
        $comNaoLidas = $conversas->filter(fn ($c) => $c['nao_lidas'] > 0)->values();

        return response()->json([
            'total' => $comNaoLidas->sum('nao_lidas'),
            'conversas' => $comNaoLidas->take(8),
        ]);
    }

    private function carregarListaConversas($user)
    {
        $meusEstabelecimentosIds = DB::table('estabelecimento_usuario')
            ->where('usuario_id', $user->id)
            ->pluck('estabelecimento_id');

        $meusFuncionarioIds = Funcionario::where('usuario_id', $user->id)->pluck('id');

        return Conversa::with(['usuario', 'estabelecimento', 'donoDireto', 'funcionario', 'agendamento.servico', 'aluguel.item', 'ultimaMensagem'])
            ->where('usuario_id', $user->id)
            ->orWhereIn('estabelecimento_id', $meusEstabelecimentosIds)
            ->orWhereIn('funcionario_id', $meusFuncionarioIds)
            ->orWhere(function ($q) use ($user) {
                $q->whereNotNull('aluguel_id')->where('estabelecimento_id', $user->id);
            })
            ->get()
            ->sortByDesc(fn ($c) => $c->ultimaMensagem?->created_at ?? $c->created_at)
            ->map(function (Conversa $c) use ($user) {
                $isEst = $this->ehEquipe($user, $c);
                $nome = ($isEst ? $c->usuario->name : $c->nomeContraparte()) ?? 'Usuário';
                $contexto = $c->agendamento?->servico?->nome ?? $c->aluguel?->item?->nome ?? null;

                return [
                    'id' => $c->id,
                    'nome' => $nome,
                    'contexto' => $contexto,
                    'funcionario_nome' => $c->funcionario?->nome,
                    'ultima_mensagem' => $c->ultimaMensagem?->conteudo ?? 'Nenhuma mensagem ainda.',
                    'tempo' => $c->ultimaMensagem?->created_at?->diffForHumans() ?? '',
                    'nao_lidas' => $c->mensagensNaoLidasPara($user->id),
                    'avatar' => $isEst ? $c->usuario->foto_perfil : ($c->aluguel_id ? $c->donoDireto?->foto_perfil : $c->estabelecimento?->foto_perfil),
                    'iniciais' => strtoupper(substr($nome, 0, 1)),
                ];
            })
            ->values();
    }
}
