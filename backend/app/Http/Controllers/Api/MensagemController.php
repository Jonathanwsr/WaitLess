<?php

namespace App\Http\Controllers\Api;

use App\Events\MensagemEnviada;
use App\Http\Controllers\Controller;
use App\Models\Conversa;
use App\Models\Funcionario;
use App\Models\Mensagem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Illuminate\Support\Facades\Auth;

class MensagemController extends Controller
{
    /**
     * Confere se $user pode ver/mandar mensagem nesta conversa: o cliente dono
     * dela, o funcionário especificamente designado, ou qualquer pessoa
     * vinculada ao estabelecimento (sócio, gerente, atendente...).
     */
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

        if ($conversa->vendedor_id && (int) $conversa->vendedor_id === (int) $user->id) {
            return true;
        }

        if (!$conversa->estabelecimento_id) {
            return false;
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

    private function carregarListaConversas($user)
    {
        $meusEstabelecimentosIds = DB::table('estabelecimento_usuario')
            ->where('usuario_id', $user->id)
            ->pluck('estabelecimento_id');

        $meusFuncionarioIds = Funcionario::where('usuario_id', $user->id)->pluck('id');

        $favoritadasIds = DB::table('conversa_favoritos')
            ->where('usuario_id', $user->id)
            ->pluck('conversa_id');

        return Conversa::with(['usuario', 'estabelecimento', 'donoDireto', 'funcionario', 'agendamento.servico', 'aluguel.item', 'produtoEntrega', 'vendedor', 'ultimaMensagem'])
            ->where('usuario_id', $user->id)
            ->orWhereIn('estabelecimento_id', $meusEstabelecimentosIds)
            ->orWhereIn('funcionario_id', $meusFuncionarioIds)
            ->orWhere('vendedor_id', $user->id)
            ->orWhere(function ($q) use ($user) {
                $q->whereNotNull('aluguel_id')->where('estabelecimento_id', $user->id);
            })
            ->get()
            ->sortByDesc(fn ($c) => $c->ultimaMensagem?->created_at ?? $c->created_at)
            ->map(function ($c) use ($user, $favoritadasIds) {
                $isEst = $this->ehEquipe($user, $c);
                $nome = ($isEst ? $c->usuario->name : $c->nomeContraparte()) ?? 'Usuário';
                $contexto = $c->agendamento?->servico?->nome ?? $c->aluguel?->item?->nome ?? $c->produtoEntrega?->nome ?? null;

                return [
                    'id' => $c->id,
                    'nome' => $nome,
                    'contexto' => $contexto,
                    'funcionario_nome' => $c->funcionario?->nome,
                    'is_verified' => false,
                    'favorito' => $favoritadasIds->contains($c->id),
                    'ultima_mensagem' => $c->ultimaMensagem?->conteudo ?? 'Nenhuma mensagem.',
                    'tempo' => $c->ultimaMensagem?->created_at?->diffForHumans() ?? '',
                    'nao_lidas' => $c->mensagensNaoLidasPara($user->id),
                    'avatar' => $isEst && $c->usuario->foto_perfil ? asset('storage/' . $c->usuario->foto_perfil) : null,
                    'iniciais' => strtoupper(substr($nome, 0, 1)),
                    'bg_color' => $isEst ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'
                ];
            })
            ->values();
    }

    public function index()
    {
        return Inertia::render('Estabelecimentos/Mensagens', [
            'conversas' => $this->carregarListaConversas(Auth::user()),
            'conversaAtiva' => null,
            'mensagensFiltradas' => []
        ]);
    }

    public function show($id)
    {
        $user = Auth::user();
        $conversa = Conversa::with(['usuario', 'estabelecimento', 'donoDireto', 'funcionario', 'agendamento.servico', 'aluguel.item'])->findOrFail($id);

        if (!$this->autorizado($user, $conversa)) {
            abort(403, 'Acesso não autorizado a esta conversa.');
        }

        $isEst = $this->ehEquipe($user, $conversa);
        $nomeAtivo = ($isEst ? $conversa->usuario->name : $conversa->nomeContraparte()) ?? 'Usuário';

        // Marca como lidas as mensagens que a outra parte mandou
        $conversa->mensagens()
            ->where('remetente_id', '!=', $user->id)
            ->whereNull('lida_em')
            ->update(['lida_em' => now()]);

        $conversaAtiva = [
            'id' => $conversa->id,
            'nome' => $nomeAtivo,
            'contexto' => $conversa->agendamento?->servico?->nome ?? $conversa->aluguel?->item?->nome ?? $conversa->produtoEntrega?->nome ?? null,
            'funcionario_nome' => $conversa->funcionario?->nome,
            'favorito' => $conversa->favoritoPara($user->id),
            'avatar' => $isEst && $conversa->usuario->foto_perfil ? asset('storage/' . $conversa->usuario->foto_perfil) : null,
            'iniciais' => strtoupper(substr($nomeAtivo, 0, 1)),
            'bg_color' => $isEst ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600',
            // Link pro "Ver perfil": se eu sou da equipe, vejo o perfil do
            // cliente; se sou o cliente, vejo a loja (locações diretas do
            // dono não têm página de loja de verdade, então não tem link).
            'perfil_href' => $isEst
                ? ($conversa->usuario_id ? route('clientes.detalhes', $conversa->usuario_id) : null)
                : (!$conversa->aluguel_id && $conversa->estabelecimento_id ? route('estabelecimentos.loja', $conversa->estabelecimento_id) : null),
        ];

        $mensagens = $conversa->mensagens()->orderBy('created_at', 'asc')->get()->map(function($msg) use ($user) {
            return [
                'id' => $msg->id,
                'conteudo' => $msg->conteudo,
                'horario' => $msg->created_at->format('H:i'),
                'data' => $msg->created_at->format('d/m/Y'),
                'is_mine' => $msg->remetente_id === $user->id
            ];
        });

        return Inertia::render('Estabelecimentos/Mensagens', [
            'conversas' => $this->carregarListaConversas($user),
            'conversaAtiva' => $conversaAtiva,
            'mensagensFiltradas' => $mensagens
        ]);
    }

    public function iniciarConversa(Request $request)
    {
        $validated = $request->validate([
            'usuario_id'         => 'required_without:produto_entrega_id|exists:users,id',
            'estabelecimento_id' => 'nullable|exists:estabelecimentos,id',
            'funcionario_id'     => 'nullable|exists:funcionarios,id',
            'agendamento_id'     => 'nullable|exists:agendamentos,id',
            'aluguel_id'         => 'nullable|exists:alugueis,id',
            'produto_entrega_id' => 'nullable|exists:produtos_entrega,id',
        ]);

        // Conversa sobre um produto para entrega: o cliente é quem está logado e o
        // vendedor é o dono do produto (pode não ter estabelecimento cadastrado).
        if (!empty($validated['produto_entrega_id'])) {
            $produto = \App\Models\ProdutoEntrega::findOrFail($validated['produto_entrega_id']);

            if ((int) $produto->usuario_id === (int) Auth::id()) {
                abort(422, 'Este é o seu produto.');
            }

            $conversa = Conversa::firstOrCreate([
                'usuario_id'         => Auth::id(),
                'produto_entrega_id' => $produto->id,
                'vendedor_id'        => $produto->usuario_id,
                'estabelecimento_id' => $produto->estabelecimento_id,
                'funcionario_id'     => null,
                'agendamento_id'     => null,
                'aluguel_id'         => null,
            ]);

            return redirect()->route('mensagens.show', ['id' => $conversa->id]);
        }

        // Quem pode abrir e sobre o quê: o cliente é quem está logado (ou a equipe do local abre com
        // um cliente); agendamento e profissional precisam ser daquele cliente/local; locação só
        // pelo locatário ou pelo dono (o dono vem do aluguel, ver Conversa::donoDireto).
        $validated = app(\App\Services\ContextoConversaService::class)->validar(Auth::user(), $validated);

        // Sem contexto específico: reaproveita (no máximo) a conversa "geral" já existente.
        if (empty($validated['funcionario_id']) && empty($validated['agendamento_id']) && empty($validated['aluguel_id'])) {
            $conversa = Conversa::firstOrCreate([
                'usuario_id'         => $validated['usuario_id'],
                'estabelecimento_id' => $validated['estabelecimento_id'],
                'funcionario_id'     => null,
                'agendamento_id'     => null,
                'aluguel_id'         => null,
            ]);
        } else {
            $conversa = Conversa::firstOrCreate($validated);
        }

        return redirect()->route('mensagens.show', ['id' => $conversa->id]);
    }

    public function enviarMensagem(Request $request, $id)
    {
        $request->validate(['conteudo' => 'required|string|max:1000']);
        $conversa = Conversa::findOrFail($id);
        $user = Auth::user();

        if (!$this->autorizado($user, $conversa)) {
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

        return redirect()->back();
    }

    /**
     * Favorita/desfavorita uma conversa pra ESTE usuário — o outro lado da
     * conversa (cliente vs. estabelecimento) tem seu próprio favorito
     * independente (ver Conversa::favoritadoPor).
     */
    public function favoritar($id)
    {
        $user = Auth::user();
        $conversa = Conversa::findOrFail($id);

        if (!$this->autorizado($user, $conversa)) {
            abort(403, 'Acesso não autorizado a esta conversa.');
        }

        $jaFavoritada = $conversa->favoritoPara($user->id);
        if ($jaFavoritada) {
            $conversa->favoritadoPor()->detach($user->id);
        } else {
            $conversa->favoritadoPor()->syncWithoutDetaching([$user->id]);
        }

        return back()->with('success', $jaFavoritada ? 'Removido dos favoritos.' : 'Adicionado aos favoritos.');
    }

    /**
     * Total de mensagens não lidas do usuário logado, pra alimentar o sino
     * de notificações do layout (badge + dropdown com as últimas conversas).
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
}
