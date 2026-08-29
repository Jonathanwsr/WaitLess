<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Avaliacao;
use App\Models\Estabelecimento;
use App\Models\ItemAluguel;
use App\Models\Servico;
use App\Models\User;
use App\Models\Agendamento;
use App\Models\Aluguel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class AvaliacaoController extends Controller
{
    public function indexReact(Request $request, $id = null)
    {
        $tipo = $request->query('tipo', 'geral');
        $usuarioAtual = Auth::user();

        try {
            $avaliacoesQuery = Avaliacao::with([
                    'usuario:id,name,foto_perfil',
                    'agendamento.servico:id,nome',
                    'aluguel.itemAluguel:id,nome',
                    'estabelecimento:id,nome'
                ])
                ->latest();

            // Se for rota de 'Minhas Avaliações' (Cliente vendo as dele mesmo)
            if ($request->routeIs('avaliacoes.geral') || $tipo === 'minhas') {
                $avaliacoesQuery->where('usuario_id', $usuarioAtual->id);
                $item = (object)[
                    'nome' => 'Minhas Avaliações',
                    'cidade' => 'Plataforma Lokyva',
                    'id' => null
                ];
            } else {
                // Se for visualização pública de um local/serviço
                $avaliacoesQuery->where('publica', true)->whereNull('justificativa_admin');

                $item = null;
                if ($id) {
                    if ($tipo === 'aluguel') {
                        $item = ItemAluguel::findOrFail($id);
                        $avaliacoesQuery->whereHas('aluguel', function ($q) use ($id) {
                            $q->where('item_aluguel_id', $id);
                        });
                    } elseif ($tipo === 'servico') {
                        $item = Servico::findOrFail($id);
                        $avaliacoesQuery->whereHas('agendamento', function ($q) use ($id) {
                            $q->where('servico_id', $id);
                        });
                    } else {
                        $item = Estabelecimento::findOrFail($id);
                        $avaliacoesQuery->where('estabelecimento_id', $item->id);
                    }
                } else {
                    $item = (object)[
                        'nome' => 'Todas as Avaliações',
                        'cidade' => 'Plataforma Lokyva',
                        'id' => null
                    ];
                }
            }

            $avaliacoes = $avaliacoesQuery->paginate(15);
            $totalAvaliacoes = $avaliacoes->total();
            
            $estatisticas = [
                'media_geral' => $totalAvaliacoes > 0 ? $avaliacoesQuery->avg('nota') : 0,
                'total' => $totalAvaliacoes,
                'estrelas' => [
                    '5' => (clone $avaliacoesQuery)->where('nota', 5)->count(),
                    '4' => (clone $avaliacoesQuery)->where('nota', 4)->count(),
                    '3' => (clone $avaliacoesQuery)->where('nota', 3)->count(),
                    '2' => (clone $avaliacoesQuery)->where('nota', 2)->count(),
                    '1' => (clone $avaliacoesQuery)->where('nota', 1)->count(),
                ],
                'categorias' => [
                    'limpeza' => $avaliacoesQuery->avg('nota_limpeza') ?? 0,
                    'precisao' => $avaliacoesQuery->avg('nota_precisao') ?? 0,
                    'comunicacao' => $avaliacoesQuery->avg('nota_comunicacao') ?? 0,
                    'localizacao' => $avaliacoesQuery->avg('nota_localizacao') ?? 0,
                    'checkin' => $avaliacoesQuery->avg('nota_checkin') ?? 0,
                    'custo_beneficio' => $avaliacoesQuery->avg('nota_custo_beneficio') ?? 0,
                ]
            ];

            return Inertia::render('Cliente/Avaliacoes', [
                'item' => $item,
                'avaliacoes' => $avaliacoes,
                'estatisticas' => $estatisticas,
                'tipo' => $tipo,
                'itemNaoEncontrado' => false
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return Inertia::render('Cliente/Avaliacoes', [
                'itemNaoEncontrado' => true,
                'mensagem' => 'O item, serviço ou local que você tentou acessar não existe mais.'
            ]);
        }
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'estabelecimento_id' => 'nullable|exists:estabelecimentos,id',
            'agendamento_id'     => 'nullable|exists:agendamentos,id',
            'aluguel_id'         => 'nullable|exists:alugueis,id',
            'nota'               => 'required|integer|min:1|max:5',
            'nota_localizacao'   => 'nullable|integer|min:1|max:10', 
            'nota_custo_beneficio'=> 'nullable|integer|min:1|max:5',
            'comentario'         => 'nullable|string|max:1000',
            'fotos'              => 'nullable|array|max:4',
            'fotos.*'            => 'image|mimes:jpeg,png,jpg,webp|max:2048',
            'publica'            => 'boolean'
        ]);

        if (empty($validated['agendamento_id']) && empty($validated['aluguel_id'])) {
            return back()->withErrors(['error' => 'A avaliação deve estar vinculada a um agendamento ou a um aluguel.']);
        }

        $validated['nota_custo_beneficio'] = $validated['nota_custo_beneficio'] ?? 5;

        $userId = Auth::id();
        $user = User::find($userId);
        $servicoId = null;
        $itemId = null;

        $prazoAvaliacao = Carbon::now()->subDays(15);

        if (!empty($validated['agendamento_id'])) {
            $agendamento = Agendamento::findOrFail($validated['agendamento_id']);
            
            if ($agendamento->usuario_id !== $userId) abort(403, 'Acesso Negado.');
            if (!in_array($agendamento->status, ['concluido', 'finalizado'])) return back()->withErrors(['error' => 'Você só pode avaliar serviços finalizados.']);
            if (Avaliacao::where('agendamento_id', $agendamento->id)->exists()) return back()->withErrors(['error' => 'Você já avaliou este serviço. Só é permitido uma avaliação por agendamento.']);
            if (Carbon::parse($agendamento->updated_at)->lessThan($prazoAvaliacao)) return back()->withErrors(['error' => 'O prazo para avaliar este serviço expirou (15 dias).']);
            
            $servicoId = $agendamento->servico_id;
            $validated['estabelecimento_id'] = $agendamento->estabelecimento_id; 
        }

        if (!empty($validated['aluguel_id'])) {
            $aluguel = Aluguel::findOrFail($validated['aluguel_id']);
            
            if ($aluguel->locatario_id !== $userId) abort(403, 'Acesso Negado.');
            if (!in_array($aluguel->status, ['concluido', 'finalizado'])) return back()->withErrors(['error' => 'Você só pode avaliar reservas finalizadas.']);
            if (Avaliacao::where('aluguel_id', $aluguel->id)->exists()) return back()->withErrors(['error' => 'Você já avaliou este aluguel. Só é permitido uma avaliação por reserva.']);
            if (Carbon::parse($aluguel->updated_at)->lessThan($prazoAvaliacao)) return back()->withErrors(['error' => 'O prazo para avaliar esta reserva expirou (15 dias).']);

            $itemId = $aluguel->item_aluguel_id;
            $validated['estabelecimento_id'] = $aluguel->estabelecimento_id; 
        }

        if (empty($validated['estabelecimento_id'])) return back()->withErrors(['error' => 'Prestador não identificado.']);

        $comentario = strip_tags($request->comentario);
        $palavrasProibidas = ['merda', 'porra', 'caralho', 'filho da puta', 'fdp', 'golpe', 'fraude', 'lixo', 'bosta'];
        foreach ($palavrasProibidas as $palavra) {
            if (stripos($comentario, $palavra) !== false) {
                return back()->withErrors(['error' => 'Linguagem imprópria detectada. Por favor, seja educado.']);
            }
        }
        $validated['comentario'] = $comentario;

        try {
            DB::beginTransaction();

            $fotosCaminhos = [];
            $quantidadeFotosValidas = 0;

            if ($request->hasFile('fotos')) {
                foreach ($request->file('fotos') as $foto) {
                    $response = Http::withBasicAuth(config('services.imagekit.private_key'), '')
                        ->asMultipart()
                        ->attach('file', file_get_contents($foto->getRealPath()), $foto->getClientOriginalName())
                        ->post('https://upload.imagekit.io/api/v1/files/upload', [
                            'fileName' => 'aval_' . time() . '_' . uniqid() . '.' . $foto->getClientOriginalExtension(),
                            'folder' => '/waitless/avaliacoes'
                        ]);

                    if ($response->successful()) {
                        $fotosCaminhos[] = $response->json()['url'];
                        $quantidadeFotosValidas++;
                    } else {
                        Log::error('Falha Upload ImageKit: ' . $response->body());
                    }
                }
            }

            $validated['fotos'] = $fotosCaminhos;
            $validated['usuario_id'] = $userId;

            Avaliacao::create($validated);

            if (!empty($validated['agendamento_id'])) {
                $agendamento->update(['nota' => $validated['nota'], 'comentario_avaliacao' => $validated['comentario']]);
            }
            if (!empty($validated['aluguel_id'])) {
                $aluguel->update(['avaliacao_locatario' => $validated['nota']]);
            }

            $this->atualizarMediaEstabelecimento($validated['estabelecimento_id']);
            if ($servicoId) $this->atualizarMediaServico($servicoId);
            if ($itemId) $this->atualizarMediaItemAluguel($itemId);

            // REGRA DE PONTOS EM DOBRO PARA PREMIUM/PLUS
            $pontosBase = $quantidadeFotosValidas > 0 ? 150 : 5;
            $pontosGanhos = in_array(strtolower($user->assinatura), ['premium', 'plus']) ? ($pontosBase * 2) : $pontosBase;

            if($user) {
                $user->increment('pontos_saldo', $pontosGanhos);
            }

            DB::table('historico_pontos')->insert([
                'usuario_id'         => $userId,
                'estabelecimento_id' => $validated['estabelecimento_id'],
                'agendamento_id'     => $validated['agendamento_id'] ?? null,
                'tipo'               => 'ganho',
                'descricao'          => 'Recompensa por Avaliação' . (in_array(strtolower($user->assinatura), ['premium', 'plus']) ? ' (Dobrado - Plano Premium)' : '') . ($quantidadeFotosValidas > 0 ? ' (com fotos)' : ''),
                'quantidade'         => $pontosGanhos,
                'created_at'         => now()
            ]);

            $registroLoja = DB::table('pontos_usuario_estabelecimento')
                ->where('usuario_id', $userId)
                ->where('estabelecimento_id', $validated['estabelecimento_id'])
                ->first();

            if ($registroLoja) {
                DB::table('pontos_usuario_estabelecimento')->where('id', $registroLoja->id)->increment('total_pontos', $pontosGanhos, ['updated_at' => now()]);
            } else {
                DB::table('pontos_usuario_estabelecimento')->insert([
                    'usuario_id' => $userId, 'estabelecimento_id' => $validated['estabelecimento_id'], 'total_pontos' => $pontosGanhos, 'created_at' => now(), 'updated_at' => now()
                ]);
            }

            DB::commit();
            return redirect()->back()->with('success', "Avaliação enviada! Você ganhou {$pontosGanhos} pontos de fidelidade.");

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("Erro Crítico ao Salvar Avaliação: " . $e->getMessage());
            return back()->withErrors(['error' => 'Ocorreu uma falha no sistema ao salvar sua avaliação.']);
        }
    }

    public function denunciar(Request $request, $id)
    {
        $request->validate([
            'motivo' => 'nullable|string|max:500'
        ]);

        $avaliacao = Avaliacao::findOrFail($id);
        
        $avaliacao->increment('denuncias_count');
        
        if ($request->filled('motivo')) {
            $motivos = $avaliacao->motivo_denuncia ? $avaliacao->motivo_denuncia . " | " . $request->motivo : $request->motivo;
            $avaliacao->update(['motivo_denuncia' => strip_tags($motivos)]);
        }

        return back()->with('success', 'Avaliação denunciada com sucesso. Nossa equipe irá analisar.');
    }

    public function indexAnfitriao(Request $request)
    {
        $userId = Auth::id();
        
        $estabelecimentosIds = DB::table('estabelecimento_usuario')
            ->where('usuario_id', $userId)
            ->whereIn('tipo', ['admin', 'socio', 'gerente', 'proprietario'])
            ->pluck('estabelecimento_id');

        if ($estabelecimentosIds->isEmpty()) {
            abort(403, 'Você não possui estabelecimentos vinculados.');
        }

        $query = Avaliacao::with([
                'usuario:id,name,foto_perfil',
                'agendamento.servico:id,nome',
                'aluguel.itemAluguel:id,nome',
                'estabelecimento:id,nome'
            ])
            ->whereIn('estabelecimento_id', $estabelecimentosIds)
            ->whereNull('justificativa_admin') 
            ->latest();

        $avaliacoes = $query->paginate(20)->withQueryString();

        $estatisticas = [
            'total_avaliacoes' => (clone $query)->count(),
            'media_geral' => (clone $query)->avg('nota'),
            'media_limpeza' => (clone $query)->avg('nota_limpeza'),
            'media_precisao' => (clone $query)->avg('nota_precisao'),
            'media_comunicacao' => (clone $query)->avg('nota_comunicacao'),
            'media_localizacao' => (clone $query)->avg('nota_localizacao'),
            'media_checkin' => (clone $query)->avg('nota_checkin'),
            'media_custo_beneficio' => (clone $query)->avg('nota_custo_beneficio'),
            'estrelas' => [
                '5' => (clone $query)->where('nota', 5)->count(),
                '4' => (clone $query)->where('nota', 4)->count(),
                '3' => (clone $query)->where('nota', 3)->count(),
                '2' => (clone $query)->where('nota', 2)->count(),
                '1' => (clone $query)->where('nota', 1)->count(),
            ]
        ];

        return Inertia::render('Cliente/Avaliacoes', [
            'item' => null,
            'avaliacoes' => $avaliacoes,
            'estatisticas' => $estatisticas,
            'tipo' => 'geral',
            'itemNaoEncontrado' => false,
            'filtros' => $request->all()
        ]);
    }

    public function responder(Request $request, $id)
    {
        $request->validate(['resposta_anfitriao' => 'required|string|max:1500']);
        $avaliacao = Avaliacao::findOrFail($id);

        $temPermissao = DB::table('estabelecimento_usuario')
            ->where('usuario_id', Auth::id())
            ->where('estabelecimento_id', $avaliacao->estabelecimento_id)
            ->whereIn('tipo', ['admin', 'socio', 'gerente', 'proprietario'])
            ->exists();

        if (!$temPermissao && strtolower(trim(Auth::user()->papel)) !== 'admin') {
            abort(403, 'Acesso Negado: Você não tem permissão para responder por este estabelecimento.');
        }

        $avaliacao->update([
            'resposta_anfitriao' => strip_tags($request->resposta_anfitriao),
            'data_resposta' => now()
        ]);

        return back()->with('success', 'Resposta publicada com sucesso!');
    }

    public function indexAdmin(Request $request)
    {
        if (strtolower(trim(Auth::user()->papel)) !== 'admin') {
            abort(403, 'Acesso restrito a administradores.');
        }

        $query = Avaliacao::with([
                'usuario:id,name,foto_perfil,email',
                'agendamento.servico:id,nome',
                'aluguel.itemAluguel:id,nome',
                'estabelecimento:id,nome'
            ]);

        if ($request->filled('denuncias')) {
            $query->where('denuncias_count', '>', 0)->orderBy('denuncias_count', 'desc');
        } else {
            $query->latest();
        }

        $avaliacoes = $query->paginate(20)->withQueryString();

        $totalAvaliacoes = Avaliacao::count();
        $estatisticas = [
            'total' => $totalAvaliacoes,
            'media_geral' => Avaliacao::avg('nota'),
            'estrelas' => [
                '5' => Avaliacao::where('nota', 5)->count(),
                '4' => Avaliacao::where('nota', 4)->count(),
                '3' => Avaliacao::where('nota', 3)->count(),
                '2' => Avaliacao::where('nota', 2)->count(),
                '1' => Avaliacao::where('nota', 1)->count(),
            ],
            'categorias' => [
                'limpeza' => Avaliacao::avg('nota_limpeza') ?? 0,
                'precisao' => Avaliacao::avg('nota_precisao') ?? 0,
                'comunicacao' => Avaliacao::avg('nota_comunicacao') ?? 0,
                'localizacao' => Avaliacao::avg('nota_localizacao') ?? 0,
                'checkin' => Avaliacao::avg('nota_checkin') ?? 0,
                'custo_beneficio' => Avaliacao::avg('nota_custo_beneficio') ?? 0,
            ]
        ];

        return Inertia::render('Cliente/Avaliacoes', [
            'item' => null,
            'avaliacoes' => $avaliacoes,
            'estatisticas' => $estatisticas,
            'tipo' => 'geral',
            'itemNaoEncontrado' => false,
            'filtros' => $request->all()
        ]);
    }

    public function destroy(Request $request, $id)
    {
        if (strtolower(trim(Auth::user()->papel)) !== 'admin') {
            abort(403, 'Acesso restrito a administradores.');
        }

        $request->validate([
            'justificativa_admin' => 'required|string|max:500'
        ]);

        $avaliacao = Avaliacao::findOrFail($id);
        
        try {
            DB::beginTransaction();

            if (!empty($avaliacao->fotos)) {
                $this->apagarFotosImageKit($avaliacao->fotos);
            }

            $estabelecimentoId = $avaliacao->estabelecimento_id;
            $agendamento = Agendamento::find($avaliacao->agendamento_id);
            $aluguel = Aluguel::find($avaliacao->aluguel_id);
            $userId = $avaliacao->usuario_id;

            $fotosArray = is_array($avaliacao->fotos) ? $avaliacao->fotos : json_decode($avaliacao->fotos, true);
            $pontosRemovidos = (is_array($fotosArray) && count($fotosArray) > 0) ? 150 : 5;

            // Se o usuário foi Premium na hora de avaliar, remove o dobro
            $user = User::find($userId);
            if ($user && in_array(strtolower($user->assinatura), ['premium', 'plus'])) {
                $pontosRemovidos = $pontosRemovidos * 2;
            }

            if ($user) {
                if ($user->pontos_saldo >= $pontosRemovidos) {
                    $user->decrement('pontos_saldo', $pontosRemovidos);
                } else {
                    $user->update(['pontos_saldo' => 0]);
                }
            }

            DB::table('pontos_usuario_estabelecimento')
                ->where('usuario_id', $userId)
                ->where('estabelecimento_id', $estabelecimentoId)
                ->decrement('total_pontos', $pontosRemovidos, ['updated_at' => now()]);

            DB::table('historico_pontos')->insert([
                'usuario_id'         => $userId,
                'estabelecimento_id' => $estabelecimentoId,
                'agendamento_id'     => $avaliacao->agendamento_id ?? null,
                'tipo'               => 'uso', 
                'descricao'          => 'Punição: Avaliação banida por violar os termos da plataforma.',
                'quantidade'         => $pontosRemovidos,
                'created_at'         => now()
            ]);

            $avaliacao->update([
                'nota' => null,
                'nota_localizacao' => null,
                'nota_limpeza' => null,
                'nota_precisao' => null,
                'nota_comunicacao' => null,
                'nota_checkin' => null,
                'nota_custo_beneficio' => null,
                'comentario' => '[Comentário removido pela administração. Violou os Termos de Uso.]',
                'fotos' => null,
                'justificativa_admin' => strip_tags($request->justificativa_admin),
                'pontos_retirados' => $pontosRemovidos,
                'publica' => false
            ]);

            if ($agendamento) $agendamento->update(['nota' => null]);
            if ($aluguel) $aluguel->update(['avaliacao_locatario' => null]);

            $this->atualizarMediaEstabelecimento($estabelecimentoId);
            if ($agendamento) $this->atualizarMediaServico($agendamento->servico_id);
            if ($aluguel) $this->atualizarMediaItemAluguel($aluguel->item_aluguel_id);

            DB::commit();
            return back()->with('success', "Avaliação punida com sucesso! {$pontosRemovidos} pontos foram estornados da conta do infrator.");

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("Erro Crítico ao Punir Avaliação pelo Admin: " . $e->getMessage());
            return back()->withErrors(['error' => 'Falha ao punir a avaliação: ' . $e->getMessage()]);
        }
    }

    private function apagarFotosImageKit($fotos)
    {
        $fotosArray = is_array($fotos) ? $fotos : json_decode($fotos, true);
        if (!$fotosArray || count($fotosArray) === 0) return;

        foreach ($fotosArray as $fotoUrl) {
            $basename = basename(parse_url($fotoUrl, PHP_URL_PATH));
            
            $search = Http::withBasicAuth(config('services.imagekit.private_key'), '')
                ->get('https://api.imagekit.io/v1/files', [
                    'searchQuery' => 'name="' . $basename . '"'
                ]);

            if ($search->successful() && !empty($search->json())) {
                $fileId = $search->json()[0]['fileId'] ?? null;
                
                if ($fileId) {
                    Http::withBasicAuth(config('services.imagekit.private_key'), '')
                        ->delete('https://api.imagekit.io/v1/files/' . $fileId);
                }
            }
        }
    }

    private function atualizarMediaEstabelecimento($id)
    {
        $media = Avaliacao::where('estabelecimento_id', $id)->where('publica', true)->whereNotNull('nota')->avg('nota_localizacao') 
                 ?? Avaliacao::where('estabelecimento_id', $id)->where('publica', true)->whereNotNull('nota')->avg('nota');
                 
        $total = Avaliacao::where('estabelecimento_id', $id)->where('publica', true)->whereNotNull('nota')->count();

        Estabelecimento::where('id', $id)->update([
            'avaliacao_media' => round($media ?? 0, 2),
            'total_avaliacoes' => $total
        ]);
    }

    private function atualizarMediaServico($servicoId)
    {
        $media = Avaliacao::whereIn('agendamento_id', Agendamento::where('servico_id', $servicoId)->pluck('id'))->where('publica', true)->whereNotNull('nota')->avg('nota');
        $total = Avaliacao::whereIn('agendamento_id', Agendamento::where('servico_id', $servicoId)->pluck('id'))->where('publica', true)->whereNotNull('nota')->count();

        Servico::where('id', $servicoId)->update([
            'avaliacao_media' => round($media ?? 0, 1),
            'total_avaliacoes' => $total
        ]);
    }

    private function atualizarMediaItemAluguel($itemId)
    {
        $media = Avaliacao::whereIn('aluguel_id', Aluguel::where('item_aluguel_id', $itemId)->pluck('id'))->where('publica', true)->whereNotNull('nota')->avg('nota');
        $total = Avaliacao::whereIn('aluguel_id', Aluguel::where('item_aluguel_id', $itemId)->pluck('id'))->where('publica', true)->whereNotNull('nota')->count();

        ItemAluguel::where('id', $itemId)->update([
            'avaliacao_media' => round($media ?? 0, 1),
            'total_avaliacoes' => $total
        ]);
    }
}