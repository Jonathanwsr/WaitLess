<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Avaliacao;
use App\Models\Estabelecimento;
use App\Models\Servico;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class AvaliacaoController extends Controller
{
    /**
     * Rota para renderizar a página completa de avaliações no React
     */
    public function indexReact($id)
    {
        $item = \App\Models\ItemAluguel::find($id); 

        // Se o item não existir, devolve a tela amigável
        if (!$item) {
            return \Inertia\Inertia::render('Cliente/Avaliacoes', [
                'itemNaoEncontrado' => true
            ]);
        }

        $avaliacoes = \App\Models\Avaliacao::with('usuario:id,name,foto_perfil')
            ->where('estabelecimento_id', $item->estabelecimento_id)
            ->where('publica', true)
            ->latest()
            ->paginate(15);

        $totalAvaliacoes = $avaliacoes->total();
        
        $estatisticas = [
            'media_geral' => $totalAvaliacoes > 0 ? \App\Models\Avaliacao::where('estabelecimento_id', $item->estabelecimento_id)->avg('nota') : 0,
            'total' => $totalAvaliacoes,
            'estrelas' => [
                '5' => \App\Models\Avaliacao::where('estabelecimento_id', $item->estabelecimento_id)->where('nota', 5)->count(),
                '4' => \App\Models\Avaliacao::where('estabelecimento_id', $item->estabelecimento_id)->where('nota', 4)->count(),
                '3' => \App\Models\Avaliacao::where('estabelecimento_id', $item->estabelecimento_id)->where('nota', 3)->count(),
                '2' => \App\Models\Avaliacao::where('estabelecimento_id', $item->estabelecimento_id)->where('nota', 2)->count(),
                '1' => \App\Models\Avaliacao::where('estabelecimento_id', $item->estabelecimento_id)->where('nota', 1)->count(),
            ],
            'categorias' => [
                'limpeza' => \App\Models\Avaliacao::where('estabelecimento_id', $item->estabelecimento_id)->avg('nota_limpeza') ?? 0,
                'precisao' => \App\Models\Avaliacao::where('estabelecimento_id', $item->estabelecimento_id)->avg('nota_precisao') ?? 0,
                'comunicacao' => \App\Models\Avaliacao::where('estabelecimento_id', $item->estabelecimento_id)->avg('nota_comunicacao') ?? 0,
                'localizacao' => \App\Models\Avaliacao::where('estabelecimento_id', $item->estabelecimento_id)->avg('nota_localizacao') ?? 0,
                'checkin' => \App\Models\Avaliacao::where('estabelecimento_id', $item->estabelecimento_id)->avg('nota_checkin') ?? 0,
                'custo_beneficio' => \App\Models\Avaliacao::where('estabelecimento_id', $item->estabelecimento_id)->avg('nota_custo_beneficio') ?? 0,
            ]
        ];

        return \Inertia\Inertia::render('Cliente/Avaliacoes', [
            'item' => $item,
            'avaliacoes' => $avaliacoes,
            'estatisticas' => $estatisticas,
            'itemNaoEncontrado' => false
        ]);
    }

    /**
     * POST /api/avaliacoes
     * O cliente avalia o atendimento e ganha 50 pontos.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'estabelecimento_id' => 'required|exists:estabelecimentos,id',
            'agendamento_id'     => 'nullable|exists:agendamentos,id',
            'nota'               => 'required|integer|min:1|max:5',
            'nota_limpeza'       => 'nullable|numeric|min:1|max:5',
            'nota_precisao'      => 'nullable|numeric|min:1|max:5',
            'nota_comunicacao'   => 'nullable|numeric|min:1|max:5',
            'nota_localizacao'   => 'nullable|numeric|min:1|max:5',
            'nota_checkin'       => 'nullable|numeric|min:1|max:5',
            'nota_custo_beneficio'=> 'nullable|numeric|min:1|max:5',
            'comentario'         => 'nullable|string|max:1000',
            'fotos'              => 'nullable|array|max:3', // Máximo de 3 fotos
            'fotos.*'            => 'image|mimes:jpeg,png,jpg,webp|max:2048', // 2MB max
            'publica'            => 'boolean'
        ]);

        // BLINDAGEM 1: Sanitização contra XSS e HTML Injections
        $comentario = strip_tags($request->comentario);

        // BLINDAGEM 2: Filtro básico de palavras maliciosas/ofensivas
        $palavrasProibidas = ['merda', 'porra', 'caralho', 'filho da puta', 'fdp', 'golpe', 'fraude'];
        foreach ($palavrasProibidas as $palavra) {
            if (stripos($comentario, $palavra) !== false) {
                return response()->json(['error' => 'O comentário contém palavras não permitidas pelas nossas diretrizes.'], 422);
            }
        }
        $validated['comentario'] = $comentario;

        // Processamento de Fotos (Para ImageKit ou Local)
        $fotosCaminhos = [];
        if ($request->has('fotos') && is_array($request->fotos)) {
            foreach ($request->fotos as $foto) {
                if (is_file($foto)) {
                    // Como você usa ImageKit, pode fazer o upload aqui ou apenas salvar o path.
                    // Exemplo salvando localmente:
                    $fotosCaminhos[] = '/storage/' . $foto->store('avaliacoes', 'public');
                } elseif (is_string($foto)) {
                    // Se o frontend já subiu pro ImageKit e mandou a URL
                    $fotosCaminhos[] = $foto;
                }
            }
        }
        $validated['fotos'] = json_encode($fotosCaminhos);
        $validated['usuario_id'] = Auth::id();

        // Salva a Avaliação
        $avaliacao = Avaliacao::create($validated);

        // RECOMPENSA: Adiciona 50 pontos ao usuário
        $user = User::find(Auth::id());
        $user->increment('pontos_saldo', 50);

        // RECALCULA MÉDIA DO ESTABELECIMENTO/SERVIÇO
        $this->atualizarMediaEstabelecimento($validated['estabelecimento_id']);

        return redirect()->back()->with('success', 'Avaliação enviada com sucesso! Você ganhou 50 pontos.');
    }

    /**
     * PUT/PATCH /api/avaliacoes/{id}
     */
    public function update(Request $request, string $id)
    {
        $avaliacao = Avaliacao::findOrFail($id);

        if ($avaliacao->usuario_id !== Auth::id() && !Auth::user()->is_admin) {
            abort(403, 'Ação não autorizada.');
        }

        $validated = $request->validate([
            'nota' => 'sometimes|integer|min:1|max:5',
            'comentario' => 'sometimes|string|max:1000',
        ]);

        if (isset($validated['comentario'])) {
            $validated['comentario'] = strip_tags($validated['comentario']);
        }

        $avaliacao->update($validated);
        $this->atualizarMediaEstabelecimento($avaliacao->estabelecimento_id);

        return redirect()->back()->with('success', 'Avaliação atualizada.');
    }

    /**
     * DELETE /api/avaliacoes/{id}
     */
    public function destroy(string $id)
    {
        $avaliacao = Avaliacao::findOrFail($id);
        
        if ($avaliacao->usuario_id !== Auth::id() && !Auth::user()->is_admin) {
            abort(403, 'Ação não autorizada.');
        }

        $estabelecimentoId = $avaliacao->estabelecimento_id;
        $avaliacao->delete();

        $this->atualizarMediaEstabelecimento($estabelecimentoId);

        return redirect()->back()->with('success', 'Avaliação removida.');
    }



    public function show($id)
    {
        // Usa find() no lugar de findOrFail() para não quebrar a tela
        $item = ItemAluguel::with('estabelecimento:id,name,foto_perfil,cidade,estado')->find($id);

        if (!$item) {
            return Inertia::render('Cliente/DetalhesItem', [
                'itemNaoEncontrado' => true
            ]);
        }

        $item->fotos = is_string($item->fotos) ? json_decode($item->fotos, true) : ($item->fotos ?? []);
        $item->recursos_oferecidos = is_string($item->recursos_oferecidos) ? json_decode($item->recursos_oferecidos, true) : ($item->recursos_oferecidos ?? []);
        $item->acessorios = is_string($item->acessorios) ? json_decode($item->acessorios, true) : ($item->acessorios ?? []);

        return Inertia::render('Cliente/DetalhesItem', [
            'item' => $item,
            'itemNaoEncontrado' => false
        ]);
    }



    /**
     * Função auxiliar para manter os dados do estabelecimento sempre atualizados
     */
    private function atualizarMediaEstabelecimento($id)
    {
        $media = Avaliacao::where('estabelecimento_id', $id)->avg('nota');
        $total = Avaliacao::where('estabelecimento_id', $id)->count();

        Estabelecimento::where('id', $id)->update([
            'avaliacao_media' => round($media ?? 0, 1),
            'total_avaliacoes' => $total
        ]);
    }
}