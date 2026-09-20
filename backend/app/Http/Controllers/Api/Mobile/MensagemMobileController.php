<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Models\Conversa;
use App\Models\Mensagem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Equivalente mobile do MensagemController (web): mesma modelagem de dados
 * (Conversa/Mensagem), porém devolvendo JSON em vez de páginas Inertia.
 */
class MensagemMobileController extends Controller
{
    public function index()
    {
        return response()->json([
            'conversas' => $this->carregarListaConversas(Auth::user()),
        ]);
    }

    public function show($id)
    {
        $user = Auth::user();
        $conversa = Conversa::with(['usuario', 'estabelecimento'])->findOrFail($id);

        $meusEstabelecimentosIds = $user->estabelecimentos()->pluck('estabelecimentos.id')->toArray();
        $isCliente = $conversa->usuario_id === $user->id;
        $isDono = in_array($conversa->estabelecimento_id, $meusEstabelecimentosIds);

        if (! $isCliente && ! $isDono) {
            abort(403, 'Acesso não autorizado a esta conversa.');
        }

        $nomeAtivo = $isDono ? $conversa->usuario->name : $conversa->estabelecimento->nome;

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
                'avatar' => $isDono ? $conversa->usuario->foto_perfil : $conversa->estabelecimento->foto_perfil,
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
        $meusEstabelecimentosIds = $user->estabelecimentos()->pluck('estabelecimentos.id')->toArray();

        $isCliente = $conversa->usuario_id === $user->id;
        $isDono = in_array($conversa->estabelecimento_id, $meusEstabelecimentosIds);

        if (! $isCliente && ! $isDono) {
            abort(403, 'Acesso não autorizado a esta conversa.');
        }

        $mensagem = Mensagem::create([
            'conversa_id' => $conversa->id,
            'remetente_id' => $user->id,
            'tipo_remetente' => $user->id === $conversa->usuario_id ? 'user' : 'estabelecimento',
            'conteudo' => $request->conteudo,
        ]);

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
        $request->validate(['estabelecimento_id' => 'required|exists:estabelecimentos,id']);

        $conversa = Conversa::firstOrCreate([
            'usuario_id' => Auth::id(),
            'estabelecimento_id' => $request->estabelecimento_id,
        ]);

        return response()->json(['id' => $conversa->id]);
    }

    private function carregarListaConversas($user)
    {
        $meusEstabelecimentosIds = $user->estabelecimentos()->pluck('estabelecimentos.id')->toArray();

        return Conversa::with(['usuario', 'estabelecimento', 'ultimaMensagem'])
            ->where('usuario_id', $user->id)
            ->orWhereIn('estabelecimento_id', $meusEstabelecimentosIds)
            ->orderByDesc('updated_at')
            ->get()
            ->map(function (Conversa $c) use ($meusEstabelecimentosIds) {
                $isEst = in_array($c->estabelecimento_id, $meusEstabelecimentosIds);
                $nome = $isEst ? $c->usuario->name : $c->estabelecimento->nome;

                return [
                    'id' => $c->id,
                    'nome' => $nome,
                    'ultima_mensagem' => $c->ultimaMensagem?->conteudo ?? 'Nenhuma mensagem ainda.',
                    'tempo' => $c->ultimaMensagem?->created_at?->diffForHumans() ?? '',
                    'avatar' => $isEst ? $c->usuario->foto_perfil : $c->estabelecimento->foto_perfil,
                    'iniciais' => strtoupper(substr($nome, 0, 1)),
                ];
            })
            ->values();
    }
}
