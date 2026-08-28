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

class AvaliacaoController extends Controller
{
    /**
     * Rota para renderizar a página de avaliações (Geral, Estabelecimento, Serviço ou Aluguel)
     */
    public function indexReact(Request $request, $id = null)
    {
        $tipo = $request->query('tipo', 'geral');

        try {
            // Traz as relações + ORDENADO POR DATA (latest)
            $avaliacoesQuery = Avaliacao::with([
                    'usuario:id,name,foto_perfil',
                    'agendamento.servico:id,nome',
                    'aluguel.itemAluguel:id,nome',
                    'estabelecimento:id,nome'
                ])
                ->where('publica', true)
                ->latest();

            $item = null;

            // Se um ID foi passado, filtra pelo tipo
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
                // Se não tem ID, é a listagem global
                $item = (object)[
                    'nome' => 'Todas as Avaliações',
                    'cidade' => 'Plataforma Lokyva',
                    'id' => null
                ];
            }

            // PAGINAÇÃO COM 15 ITENS
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
                'tipo' => $id ? $tipo : 'geral',
                'itemNaoEncontrado' => false
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return Inertia::render('Cliente/Avaliacoes', [
                'itemNaoEncontrado' => true,
                'mensagem' => 'O item, serviço ou local que você tentou acessar não existe mais.'
            ]);
        }
    }

    /**
     * POST /api/avaliacoes
     * Salva a avaliação e envia as fotos para o ImageKit de forma correta (Multipart)
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'estabelecimento_id' => 'nullable|exists:estabelecimentos,id', // Opcional no input, descoberto no backend
            'agendamento_id'     => 'nullable|exists:agendamentos,id',
            'aluguel_id'         => 'nullable|exists:alugueis,id',
            'nota'               => 'required|integer|min:1|max:5',
            'nota_localizacao'   => 'nullable|integer|min:1|max:5', // Avaliação do Local físico
            'comentario'         => 'nullable|string|max:1000',
            'fotos'              => 'nullable|array|max:4',
            'fotos.*'            => 'image|mimes:jpeg,png,jpg,webp|max:2048',
            'publica'            => 'boolean'
        ]);

        if (empty($validated['agendamento_id']) && empty($validated['aluguel_id'])) {
            return back()->withErrors(['error' => 'A avaliação deve estar vinculada a um agendamento ou a um aluguel.']);
        }

        $userId = Auth::id();
        $servicoId = null;
        $itemId = null;

        // =========================================================================
        // 1. AUTO-DESCOBERTA DO LOCAL E VERIFICAÇÃO DE DUPLICIDADE
        // =========================================================================
        
        if (!empty($validated['agendamento_id'])) {
            $agendamento = Agendamento::findOrFail($validated['agendamento_id']);
            
            if ($agendamento->usuario_id !== $userId) abort(403, 'Acesso Negado.');
            if (!in_array($agendamento->status, ['concluido', 'finalizado'])) {
                return back()->withErrors(['error' => 'Você só pode avaliar serviços finalizados.']);
            }
            if (Avaliacao::where('agendamento_id', $agendamento->id)->exists()) {
                return back()->withErrors(['error' => 'Você já avaliou este serviço.']);
            }
            
            $servicoId = $agendamento->servico_id;
            // Preenche o ID do estabelecimento baseado no dono do serviço (Serviço Autônomo)
            $validated['estabelecimento_id'] = $agendamento->estabelecimento_id; 
        }

        if (!empty($validated['aluguel_id'])) {
            $aluguel = Aluguel::findOrFail($validated['aluguel_id']);
            
            if ($aluguel->locatario_id !== $userId) abort(403, 'Acesso Negado.');
            if (!in_array($aluguel->status, ['concluido', 'finalizado'])) {
                return back()->withErrors(['error' => 'Você só pode avaliar reservas finalizadas.']);
            }
            if (Avaliacao::where('aluguel_id', $aluguel->id)->exists()) {
                return back()->withErrors(['error' => 'Você já avaliou este aluguel.']);
            }

            $itemId = $aluguel->item_aluguel_id;
            // Preenche o ID do estabelecimento baseado no dono do item
            $validated['estabelecimento_id'] = $aluguel->estabelecimento_id; 
        }

        // Filtro de Palavrões
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

            // =========================================================================
            // 2. PROCESSAMENTO DE FOTOS NO IMAGEKIT (Correção do Erro Malformed)
            // =========================================================================
            $fotosCaminhos = [];
            $quantidadeFotosValidas = 0;

            if ($request->hasFile('fotos')) {
                foreach ($request->file('fotos') as $foto) {
                    
                    // Enviando a foto usando multipart/form-data corretamente
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

            $validated['fotos'] = json_encode($fotosCaminhos);
            $validated['usuario_id'] = $userId;

            // 3. Salva a Avaliação
            Avaliacao::create($validated);

            // 4. Salva colunas originais
            if (!empty($validated['agendamento_id'])) {
                $agendamento->update(['nota' => $validated['nota'], 'comentario_avaliacao' => $validated['comentario']]);
            }
            if (!empty($validated['aluguel_id'])) {
                $aluguel->update(['avaliacao_locatario' => $validated['nota']]);
            }

            // 5. Atualização de Médias
            if ($validated['estabelecimento_id']) {
                $this->atualizarMediaEstabelecimento($validated['estabelecimento_id']);
            }
            if ($servicoId) $this->atualizarMediaServico($servicoId);
            if ($itemId) $this->atualizarMediaItemAluguel($itemId);

            // 6. Gamificação
            $pontosGanhos = 100;
            if ($quantidadeFotosValidas === 4) {
                $pontosGanhos += 100;
            } elseif ($quantidadeFotosValidas > 0) {
                $pontosGanhos += ($quantidadeFotosValidas * 20);
            }

            $user = User::find($userId);
            $user->increment('pontos_saldo', $pontosGanhos);

            DB::table('historico_pontos')->insert([
                'usuario_id'         => $userId,
                'estabelecimento_id' => $validated['estabelecimento_id'],
                'agendamento_id'     => $validated['agendamento_id'] ?? null,
                'tipo'               => 'ganho',
                'descricao'          => 'Recompensa por Avaliação' . ($quantidadeFotosValidas > 0 ? ' (com fotos)' : ''),
                'quantidade'         => $pontosGanhos,
                'created_at'         => now()
            ]);

            if ($validated['estabelecimento_id']) {
                $registroLoja = DB::table('pontos_usuario_estabelecimento')
                    ->where('usuario_id', $userId)
                    ->where('estabelecimento_id', $validated['estabelecimento_id'])
                    ->first();

                if ($registroLoja) {
                    DB::table('pontos_usuario_estabelecimento')
                        ->where('id', $registroLoja->id)
                        ->increment('total_pontos', $pontosGanhos, ['updated_at' => now()]);
                } else {
                    DB::table('pontos_usuario_estabelecimento')->insert([
                        'usuario_id'         => $userId,
                        'estabelecimento_id' => $validated['estabelecimento_id'],
                        'total_pontos'       => $pontosGanhos,
                        'created_at'         => now(),
                        'updated_at'         => now()
                    ]);
                }
            }

            DB::commit();
            return redirect()->back()->with('success', "Avaliação enviada! Você ganhou {$pontosGanhos} pontos de fidelidade.");

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("Erro Crítico ao Salvar Avaliação: " . $e->getMessage());
            return back()->withErrors(['error' => 'Ocorreu uma falha no sistema ao salvar sua avaliação.']);
        }
    }

    private function atualizarMediaEstabelecimento($id)
    {
        // Pega as notas principais e também a nota_localizacao (Passo 1 do app)
        $media = Avaliacao::where('estabelecimento_id', $id)->avg('nota_localizacao') 
                 ?? Avaliacao::where('estabelecimento_id', $id)->avg('nota');
                 
        $total = Avaliacao::where('estabelecimento_id', $id)->count();

        Estabelecimento::where('id', $id)->update([
            'avaliacao_media' => round($media ?? 0, 2),
            'total_avaliacoes' => $total
        ]);
    }

    private function atualizarMediaServico($servicoId)
    {
        $media = Avaliacao::whereIn('agendamento_id', Agendamento::where('servico_id', $servicoId)->pluck('id'))->avg('nota');
        $total = Avaliacao::whereIn('agendamento_id', Agendamento::where('servico_id', $servicoId)->pluck('id'))->count();

        Servico::where('id', $servicoId)->update([
            'avaliacao_media' => round($media ?? 0, 1),
            'total_avaliacoes' => $total
        ]);
    }

    private function atualizarMediaItemAluguel($itemId)
    {
        $media = Avaliacao::whereIn('aluguel_id', Aluguel::where('item_aluguel_id', $itemId)->pluck('id'))->avg('nota');
        $total = Avaliacao::whereIn('aluguel_id', Aluguel::where('item_aluguel_id', $itemId)->pluck('id'))->count();

        ItemAluguel::where('id', $itemId)->update([
            'avaliacao_media' => round($media ?? 0, 1),
            'total_avaliacoes' => $total
        ]);
    }
}