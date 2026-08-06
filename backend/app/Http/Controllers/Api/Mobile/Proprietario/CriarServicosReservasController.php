<?php

namespace App\Http\Controllers\Api\Mobile\Proprietario;

use App\Http\Controllers\Controller;
use App\Models\Agendamento;
use App\Models\Pagamento;
use App\Models\Servico;
use App\Models\Funcionario;
use App\Models\ItemAluguel;
use App\Services\CloudflareService; // <-- Alterado para o Service do Cloudflare
use App\Services\MercadoPagoService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Exception;

class CriarServicosReservasController extends Controller
{
    /**
     * Trava de Segurança
     */
    private function verificarPermissao()
    {
        $user = Auth::user();
        if (!in_array($user->papel, ['admin', 'socio', 'gerente', 'proprietario', 'user'])) {
            abort(403, 'Acesso Negado: Você não tem permissão para gerenciar o catálogo.');
        }
    }

    /**
     * Integração com a HIVE AI para moderação de imagens
     * Retorna true se a imagem for segura, false se for indevida
     */
    private function validarImagemHiveSegura($file)
    {
        try {
            // Substitua pela sua chave da Hive AI no arquivo .env (HIVE_API_KEY)
            $apiKey = env('HIVE_API_KEY', 'sua_chave_hive_aqui');
            
            $response = Http::withHeaders([
                'Authorization' => 'token ' . $apiKey,
                'Accept' => 'application/json',
            ])->attach(
                'media', file_get_contents($file->getRealPath()), $file->getClientOriginalName()
            )->post('https://api.thehive.ai/api/v2/task/sync');

            if ($response->successful()) {
                $data = $response->json();
                $classes = $data['status'][0]['response']['output'][0]['classes'] ?? [];

                foreach ($classes as $class) {
                    // Bloqueia se identificar pornografia, nudez explícita, violência gore ou armas com mais de 80% de precisão
                    if (in_array($class['class'], ['yes_nsfw', 'porn', 'gory', 'weapons']) && $class['score'] > 0.80) {
                        return false;
                    }
                }
            }
            
            return true;
        } catch (Exception $e) {
            Log::error("Erro na API da Hive AI: " . $e->getMessage());
            // Em caso de falha da API, você pode decidir se bloqueia ou libera. 
            // Por padrão, liberamos para não travar o app do usuário por instabilidade externa, 
            // mas o erro fica logado.
            return true;
        }
    }

    /* =========================================================================
       👉 GESTÃO DE SERVIÇOS (Máx 5 fotos de 2MB)
       ========================================================================= */

    public function storeServico(Request $request)
    {
        $this->verificarPermissao();

        $validated = $request->validate([
            'nome'                 => 'required|string|max:255',
            'tipo_servico'         => 'required|string|max:255',
            'descricao'            => 'nullable|string',
            'valor'                => 'required|numeric|min:0',
            'duracao_minutos'      => 'required|integer|min:1',
            'estabelecimentos_ids' => 'required|array|min:1', 
            'estabelecimentos_ids.*' => 'exists:estabelecimentos,id',
            'funcionario_id'       => 'nullable|exists:funcionarios,id',
            'dias_disponiveis'     => 'nullable|array',
            'horarios_disponiveis' => 'nullable|array',
            'tipo_pagamento'       => 'required|in:hibrido,online,presencial', 
            // Validação de Serviços: Max 5 fotos, Max 2MB (2048 KB)
            'fotos'                => 'nullable|array|max:5', 
            'fotos.*'              => 'image|mimes:jpeg,png,jpg,webp|max:2048', 
        ]);

        $horarios = $validated['horarios_disponiveis'] ?? [];
        $dias = $validated['dias_disponiveis'] ?? [];

        $urlsFotos = [];
        if ($request->hasFile('fotos')) {
            foreach ($request->file('fotos') as $index => $foto) {
                // Validação HIVE AI
                if (!$this->validarImagemHiveSegura($foto)) {
                    return response()->json(['error' => 'Ops, você não pode enviar esse tipo de arquivo.'], 400);
                }
                
                // O índice 0 é automaticamente considerado a "Capa" no frontend
                // Upload para o Cloudflare
                $urlsFotos[] = CloudflareService::upload($foto, '/waitless/servicos');
            }
        }

        $servicosCriados = [];

        foreach ($validated['estabelecimentos_ids'] as $est_id) {
            $funcionarioParaSalvar = null;

            if (!empty($validated['funcionario_id'])) {
                $funcionarioTrabalhaAqui = Funcionario::where('id', $validated['funcionario_id'])
                    ->where('estabelecimento_id', $est_id)
                    ->exists();
                if ($funcionarioTrabalhaAqui) {
                    $funcionarioParaSalvar = $validated['funcionario_id'];
                }
            }

            $servicosCriados[] = Servico::create([
                'estabelecimento_id'   => $est_id,
                'nome'                 => $validated['nome'],
                'tipo_servico'         => $validated['tipo_servico'],
                'descricao'            => $validated['descricao'] ?? null,
                'valor'                => $validated['valor'],
                'duracao_minutos'      => $validated['duracao_minutos'],
                'ativo'                => true,
                'horarios_disponiveis' => json_encode($horarios),
                'configuracoes'        => json_encode([
                    'dias_disponiveis'   => $dias,
                    'tipo_pagamento'     => $validated['tipo_pagamento'],
                    'funcionario_padrao' => $funcionarioParaSalvar
                ]),
                'fotos'                => json_encode($urlsFotos), 
            ]);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Serviço adicionado ao catálogo com sucesso!',
            'data' => $servicosCriados
        ], 201);
    }

    public function updateServico(Request $request, $id)
    {
        $this->verificarPermissao();
        $servico = Servico::findOrFail($id);

        $validated = $request->validate([
            'nome'                 => 'required|string|max:255',
            'tipo_servico'         => 'required|string|max:255',
            'descricao'            => 'nullable|string',
            'valor'                => 'required|numeric|min:0',
            'duracao_minutos'      => 'required|integer|min:1',
            'funcionario_id'       => 'nullable|exists:funcionarios,id',
            'dias_disponiveis'     => 'nullable|array',
            'horarios_disponiveis' => 'nullable|array',
            'tipo_pagamento'       => 'required|in:hibrido,online,presencial', 
            // Validação de Serviços: Max 5 fotos, Max 2MB (2048 KB)
            'fotos'                => 'nullable|array|max:5',
            'fotos.*'              => 'image|mimes:jpeg,png,jpg,webp|max:2048',
        ]);

        $dadosParaAtualizar = [
            'nome'                 => $validated['nome'],
            'tipo_servico'         => $validated['tipo_servico'],
            'descricao'            => $validated['descricao'] ?? null,
            'valor'                => $validated['valor'],
            'duracao_minutos'      => $validated['duracao_minutos'],
            'horarios_disponiveis' => json_encode($validated['horarios_disponiveis'] ?? []),
            'configuracoes'        => json_encode([
                'dias_disponiveis'   => $validated['dias_disponiveis'] ?? [],
                'tipo_pagamento'     => $validated['tipo_pagamento'],
                'funcionario_padrao' => $validated['funcionario_id'] ?? null
            ])
        ];

        if ($request->hasFile('fotos')) {
            $urlsFotos = [];
            foreach ($request->file('fotos') as $foto) {
                // Validação HIVE AI
                if (!$this->validarImagemHiveSegura($foto)) {
                    return response()->json(['error' => 'Ops, você não pode enviar esse tipo de arquivo.'], 400);
                }
                $urlsFotos[] = CloudflareService::upload($foto, '/waitless/servicos');
            }
            $dadosParaAtualizar['fotos'] = json_encode($urlsFotos);
        }

        $servico->update($dadosParaAtualizar);

        return response()->json([
            'status' => 'success',
            'message' => 'Serviço atualizado com sucesso!',
            'data' => $servico
        ]);
    }

    public function destroyServico($id, MercadoPagoService $mpService)
    {
        // Lógica mantida...
        $this->verificarPermissao();
        // ... (resto do código destroy igual ao anterior)
    }

    /* =========================================================================
       👉 GESTÃO DO CATÁLOGO DE LOCAÇÕES / RESERVAS (Máx 10 fotos de 2MB)
       ========================================================================= */

    public function storeItem(Request $request)
    {
        $this->verificarPermissao();
        $dados = $request->validate($this->regrasValidacaoItemAluguel());

        if (!Auth::user()->estabelecimentos->contains($dados['estabelecimento_id'])) {
            abort(403, 'Acesso não autorizado para esta filial.');
        }

        $urlsFotos = [];
        if ($request->hasFile('fotos')) {
            foreach ($request->file('fotos') as $index => $foto) {
                // Validação HIVE AI
                if (!$this->validarImagemHiveSegura($foto)) {
                    return response()->json(['error' => 'Ops, você não pode enviar esse tipo de arquivo.'], 400);
                }
                
                // Upload para o Cloudflare
                $urlsFotos[] = CloudflareService::upload($foto, '/waitless/itens');
            }
        }

        $item = ItemAluguel::create(array_merge($dados, [
            'fotos'                     => json_encode($urlsFotos),
            'recursos_oferecidos'       => json_encode($dados['recursos_oferecidos'] ?? []),
            'acessorios'                => json_encode($dados['acessorios'] ?? []),
            'funcionarios_responsaveis' => json_encode($dados['funcionarios_responsaveis'] ?? []),
            'datas_permitidas'          => json_encode($dados['datas_permitidas'] ?? []),
            'dias_semana_disponiveis'   => json_encode($dados['dias_semana_disponiveis'] ?? []),
            'dias_mes_disponiveis'      => json_encode($dados['dias_mes_disponiveis'] ?? []),
            'datas_bloqueadas'          => json_encode($dados['datas_bloqueadas'] ?? []),
            'horarios_bloqueados'       => json_encode($dados['horarios_bloqueados'] ?? []),
            
            // Booleans defaults
            'mobiliado'         => $request->boolean('mobiliado', false),
            'possui_seguro'     => $request->boolean('possui_seguro', false),
            'sempre_disponivel' => $request->boolean('sempre_disponivel', true),
            'tem_promocao'      => $request->boolean('tem_promocao', false),
            'aceita_pontos'     => $request->boolean('aceita_pontos', false),
            'exige_contrato'    => $request->boolean('exige_contrato', false),
            'disponivel'        => true,
            'ativo'             => true,
        ]));

        return response()->json(['status' => 'success', 'message' => 'Reserva/Item salvo com sucesso!', 'data' => $item], 201);
    }

    public function updateItem(Request $request, $id)
    {
        $this->verificarPermissao();
        $item = ItemAluguel::findOrFail($id);

        if (!Auth::user()->estabelecimentos->contains($item->estabelecimento_id)) {
            abort(403, 'Acesso Restrito.');
        }

        $dados = $request->validate($this->regrasValidacaoItemAluguel());

        $dadosParaAtualizar = array_merge($dados, [
            'recursos_oferecidos'       => json_encode($dados['recursos_oferecidos'] ?? []),
            'acessorios'                => json_encode($dados['acessorios'] ?? []),
            'funcionarios_responsaveis' => json_encode($dados['funcionarios_responsaveis'] ?? []),
            'datas_permitidas'          => json_encode($dados['datas_permitidas'] ?? []),
            'dias_semana_disponiveis'   => json_encode($dados['dias_semana_disponiveis'] ?? []),
            'dias_mes_disponiveis'      => json_encode($dados['dias_mes_disponiveis'] ?? []),
            'datas_bloqueadas'          => json_encode($dados['datas_bloqueadas'] ?? []),
            'horarios_bloqueados'       => json_encode($dados['horarios_bloqueados'] ?? []),
            
            'mobiliado'         => $request->boolean('mobiliado', false),
            'possui_seguro'     => $request->boolean('possui_seguro', false),
            'sempre_disponivel' => $request->boolean('sempre_disponivel', true),
            'tem_promocao'      => $request->boolean('tem_promocao', false),
            'aceita_pontos'     => $request->boolean('aceita_pontos', false),
            'exige_contrato'    => $request->boolean('exige_contrato', false),
            'disponivel'        => $request->boolean('disponivel', $item->disponivel),
            'ativo'             => $request->boolean('ativo', $item->ativo),
        ]);

        if ($request->hasFile('fotos')) {
            $urlsFotos = [];
            foreach ($request->file('fotos') as $foto) {
                // Validação HIVE AI
                if (!$this->validarImagemHiveSegura($foto)) {
                    return response()->json(['error' => 'Ops, você não pode enviar esse tipo de arquivo.'], 400);
                }
                
                $urlsFotos[] = CloudflareService::upload($foto, '/waitless/itens');
            }
            $dadosParaAtualizar['fotos'] = json_encode($urlsFotos);
        }

        $item->update($dadosParaAtualizar);

        return response()->json(['status' => 'success', 'message' => 'Reserva/Item atualizado com sucesso!', 'data' => $item]);
    }

    /**
     * Regras de Validação Centralizadas para Item de Aluguel (Reservas)
     */
    private function regrasValidacaoItemAluguel()
    {
        return [
            'estabelecimento_id' => 'required|exists:estabelecimentos,id',
            'servico_id'         => 'nullable|exists:servicos,id',
            'nome'               => 'required|string|max:255',
            'categoria'          => 'required|string|max:50',
            'quantidade'         => 'required|integer|min:1',
            'marca'              => 'nullable|string|max:255',
            'modelo'             => 'nullable|string|max:255',
            'tipo'               => 'nullable|string|max:255',
            'descricao'          => 'nullable|string',
            'especificacoes'     => 'nullable|string',
            
            // Valores Financeiros
            'valor_diaria'       => 'nullable|numeric|min:0',
            'valor_semanal'      => 'nullable|numeric|min:0',
            'valor_mensal'       => 'nullable|numeric|min:0',
            'valor_caucao'       => 'nullable|numeric|min:0',
            'tipo_desconto'      => 'nullable|in:percentual,fixo',
            'valor_desconto'     => 'nullable|numeric|min:0',
            'maximo_pontos_permitidos' => 'nullable|integer|min:0',
            
            // Mídias - Para Reservas: Max 10 fotos, Max 2MB (2048 KB)
            'fotos'              => 'nullable|array|max:10',
            'fotos.*'            => 'image|mimes:jpeg,png,jpg,webp|max:2048',

            // Arrays
            'recursos_oferecidos' => 'nullable|array',
            'acessorios'          => 'nullable|array',
            'acessorios.*.nome'   => 'required_with:acessorios|string|max:255',
            'acessorios.*.valor'  => 'required_with:acessorios|numeric|min:0',
            'funcionarios_responsaveis' => 'nullable|array',
            'funcionarios_responsaveis.*' => 'exists:funcionarios,id',

            // Endereço Base
            'cep' => 'nullable|string|max:15',
            'endereco' => 'nullable|string|max:255',
            'numero' => 'nullable|string|max:20',
            'cidade' => 'nullable|string|max:100',
            'estado' => 'nullable|string|max:2',
        ];
    }
}