<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Conversa;
use App\Models\Mensagem;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Auth;

class MensagemController extends Controller
{
    private function carregarListaConversas($user)
    {
        $meusEstabelecimentosIds = $user->estabelecimentos()->pluck('estabelecimentos.id')->toArray();

        return Conversa::with(['usuario', 'estabelecimento', 'ultimaMensagem'])
            ->where('usuario_id', $user->id)
            ->orWhereIn('estabelecimento_id', $meusEstabelecimentosIds)
            ->get()
            ->map(function($c) use ($user, $meusEstabelecimentosIds) {
                $isEst = in_array($c->estabelecimento_id, $meusEstabelecimentosIds);
                $nome = $isEst ? $c->usuario->name : $c->estabelecimento->nome;
                
                return [
                    'id' => $c->id,
                    'nome' => $nome,
                    'is_verified' => false,
                    'ultima_mensagem' => $c->ultimaMensagem?->conteudo ?? 'Nenhuma mensagem.',
                    'tempo' => $c->ultimaMensagem?->created_at?->diffForHumans() ?? '',
                    'nao_lidas' => 0,
                    'avatar' => $isEst && $c->usuario->foto_perfil ? asset('storage/' . $c->usuario->foto_perfil) : null,
                    'iniciais' => strtoupper(substr($nome, 0, 1)),
                    'bg_color' => $isEst ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'
                ];
            });
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
        $conversa = Conversa::with('mensagens')->findOrFail($id);
        $meusEstabelecimentosIds = $user->estabelecimentos()->pluck('estabelecimentos.id')->toArray();

        $isCliente = $conversa->usuario_id === $user->id;
        $isDono = in_array($conversa->estabelecimento_id, $meusEstabelecimentosIds);

        if (!$isCliente && !$isDono) {
            abort(403, 'Acesso não autorizado a esta conversa.');
        }

        $nomeAtivo = $isDono ? $conversa->usuario->name : $conversa->estabelecimento->nome;
        $conversaAtiva = [
            'id' => $conversa->id,
            'nome' => $nomeAtivo,
            'avatar' => $isDono && $conversa->usuario->foto_perfil ? asset('storage/' . $conversa->usuario->foto_perfil) : null,
            'iniciais' => strtoupper(substr($nomeAtivo, 0, 1)),
            'bg_color' => $isDono ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'
        ];

        $mensagens = $conversa->mensagens()->orderBy('created_at', 'asc')->get()->map(function($msg) use ($user) {
            return [
                'id' => $msg->id,
                'conteudo' => $msg->conteudo,
                'horario' => $msg->created_at->format('H:i'),
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
        $conversa = Conversa::firstOrCreate([
            'usuario_id' => $request->usuario_id,
            'estabelecimento_id' => $request->estabelecimento_id
        ]);

        // Redirecionamento explícito passando a chave 'id' para o mapeamento do roteador
        return redirect()->route('mensagens.show', ['id' => $conversa->id]);
    }

    public function enviarMensagem(Request $request, $id)
    {
        $request->validate(['conteudo' => 'required|string|max:1000']);
        $conversa = Conversa::findOrFail($id);
        $user = Auth::user();

        Mensagem::create([
            'conversa_id' => $conversa->id,
            'remetente_id' => $user->id,
            'tipo_remetente' => $user->id === $conversa->usuario_id ? 'user' : 'estabelecimento',
            'conteudo' => $request->conteudo,
        ]);

        return redirect()->back();
    }
}