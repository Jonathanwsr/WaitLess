<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Avaliacao;
use App\Models\Estabelecimento;
use App\Models\ItemAluguel;
use App\Models\Servico;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class AvaliacaoController extends Controller
{
    /**
     * Rota para renderizar a página completa de avaliações no React (Listar Tudo + Fotos)
     */
    public function indexReact($id)
    {
        $item = ItemAluguel::find($id); 

        // Se o item não existir, devolve a tela amigável
        if (!$item) {
            return Inertia::render('Cliente/Avaliacoes', [
                'itemNaoEncontrado' => true
            ]);
        }

        // Puxando as avaliações com os dados do usuário. As fotos já vêm na tabela Avaliacao.
        $avaliacoes = Avaliacao::with('usuario:id,name,foto_perfil')
            ->where('estabelecimento_id', $item->estabelecimento_id)
            ->where('publica', true)
            ->latest()
            ->paginate(15);

        $totalAvaliacoes = $avaliacoes->total();
        
        $estatisticas = [
            'media_geral' => $totalAvaliacoes > 0 ? Avaliacao::where('estabelecimento_id', $item->estabelecimento_id)->avg('nota') : 0,
            'total' => $totalAvaliacoes,
            'estrelas' => [
                '5' => Avaliacao::where('estabelecimento_id', $item->estabelecimento_id)->where('nota', 5)->count(),
                '4' => Avaliacao::where('estabelecimento_id', $item->estabelecimento_id)->where('nota', 4)->count(),
                '3' => Avaliacao::where('estabelecimento_id', $item->estabelecimento_id)->where('nota', 3)->count(),
                '2' => Avaliacao::where('estabelecimento_id', $item->estabelecimento_id)->where('nota', 2)->count(),
                '1' => Avaliacao::where('estabelecimento_id', $item->estabelecimento_id)->where('nota', 1)->count(),
            ],
            'categorias' => [
                'limpeza' => Avaliacao::where('estabelecimento_id', $item->estabelecimento_id)->avg('nota_limpeza') ?? 0,
                'precisao' => Avaliacao::where('estabelecimento_id', $item->estabelecimento_id)->avg('nota_precisao') ?? 0,
                'comunicacao' => Avaliacao::where('estabelecimento_id', $item->estabelecimento_id)->avg('nota_comunicacao') ?? 0,
                'localizacao' => Avaliacao::where('estabelecimento_id', $item->estabelecimento_id)->avg('nota_localizacao') ?? 0,
                'checkin' => Avaliacao::where('estabelecimento_id', $item->estabelecimento_id)->avg('nota_checkin') ?? 0,
                'custo_beneficio' => Avaliacao::where('estabelecimento_id', $item->estabelecimento_id)->avg('nota_custo_beneficio') ?? 0,
            ]
        ];

        return Inertia::render('Cliente/Avaliacoes', [
            'item' => $item,
            'avaliacoes' => $avaliacoes,
            'estatisticas' => $estatisticas,
            'itemNaoEncontrado' => false
        ]);
    }

    /**
     * POST /api/avaliacoes
     * Salva a avaliação e envia as fotos para o Cloudinary
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
            'fotos'              => 'nullable|array|max:3',
            'fotos.*'            => 'image|mimes:jpeg,png,jpg,webp|max:2048',
            'publica'            => 'boolean'
        ]);

        $comentario = strip_tags($request->comentario);

        $palavrasProibidas = ['merda', 'porra', 'caralho', 'filho da puta', 'fdp', 'golpe', 'fraude'];
        foreach ($palavrasProibidas as $palavra) {
            if (stripos($comentario, $palavra) !== false) {
                return response()->json(['error' => 'O comentário contém palavras não permitidas.'], 422);
            }
        }
        $validated['comentario'] = $comentario;

        // Processamento de Fotos usando CLOUDINARY
        $fotosCaminhos = [];
        if ($request->hasFile('fotos')) {
            foreach ($request->file('fotos') as $foto) {
                // Faz o upload direto para o Cloudinary na pasta 'avaliacoes'
                $uploadedUrl = cloudinary()->upload($foto->getRealPath(), [
                    'folder' => 'avaliacoes',
                ])->getSecurePath();
                
                $fotosCaminhos[] = $uploadedUrl;
            }
        } elseif ($request->has('fotos') && is_array($request->fotos)) {
            // Caso o frontend já tenha enviado URLs prontas (fallback)
            foreach ($request->fotos as $foto) {
                if (is_string($foto)) {
                    $fotosCaminhos[] = $foto;
                }
            }
        }

        $validated['fotos'] = json_encode($fotosCaminhos);
        $validated['usuario_id'] = Auth::id();

        $avaliacao = Avaliacao::create($validated);

        $user = User::find(Auth::id());
        $user->increment('pontos_saldo', 50);

        $this->atualizarMediaEstabelecimento($validated['estabelecimento_id']);

        return redirect()->back()->with('success', 'Avaliação enviada com sucesso! Você ganhou 50 pontos.');
    }

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