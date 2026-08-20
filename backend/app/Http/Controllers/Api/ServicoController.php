<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agendamento;
use App\Models\Pagamento;
use App\Services\PagamentoService;
use App\Services\ImageKitService; 
use Carbon\Carbon;
use Exception;
use App\Models\Servico;
use App\Models\Funcionario;
use App\Models\ItemAluguel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class ServicoController extends Controller
{
    /**
     * Trava de Segurança: Verifica se o utilizador tem o papel adequado
     */
    private function verificarPermissao()
    {
        $user = Auth::user();
        
        // Bloqueia se o utilizador não tiver um destes papéis
        if (!in_array($user->papel, ['admin', 'socio', 'gerente', 'user'])) {
            abort(403, 'Acesso Negado: Você não tem permissão para gerenciar o catálogo.');
        }
    }

    /* =========================================================================
       👉 MÉTODOS ORIGINAIS - GESTÃO DE SERVIÇOS (MANTIDOS)
       ========================================================================= */

    public function store(Request $request)
    {
        // 1. Aciona a trava de segurança
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
            
            'fotos'                => 'nullable|array|max:5', 
            'fotos.*'              => 'image|mimes:jpeg,png,jpg,webp|max:2048', 
        ]);

        $horarios = $validated['horarios_disponiveis'] ?? [];
        $dias = $validated['dias_disponiveis'] ?? [];

        $urlsFotos = [];
        if ($request->hasFile('fotos')) {
            foreach ($request->file('fotos') as $foto) {
                $urlsFotos[] = ImageKitService::upload($foto, '/waitless/servicos');
            }
        }

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

            Servico::create([
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

        return redirect()->back()->with('success', 'Serviço adicionado ao catálogo com imagens!');
    }

    public function update(Request $request, Servico $servico)
    {
        $this->verificarPermissao();

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
            
            // Campos de imagem ajustados para a edição
            'fotos_existentes'     => 'nullable|array',
            'fotos_existentes.*'   => 'string',
            'fotos'                => 'nullable|array|max:5',
            'fotos.*'              => 'image|mimes:jpeg,png,jpg,webp|max:2048',
        ]);

        $horarios = $validated['horarios_disponiveis'] ?? [];
        $dias = $validated['dias_disponiveis'] ?? [];

        $dadosParaAtualizar = [
            'nome'                 => $validated['nome'],
            'tipo_servico'         => $validated['tipo_servico'],
            'descricao'            => $validated['descricao'] ?? null,
            'valor'                => $validated['valor'],
            'duracao_minutos'      => $validated['duracao_minutos'],
            'horarios_disponiveis' => json_encode($horarios),
            'configuracoes'        => json_encode([
                'dias_disponiveis'   => $dias,
                'tipo_pagamento'     => $validated['tipo_pagamento'],
                'funcionario_padrao' => $validated['funcionario_id'] ?? null
            ])
        ];

        // --- LÓGICA DE IMAGENS ---
        // 1. Pega as imagens antigas que o front-end decidiu manter
        $urlsFotos = $request->input('fotos_existentes', []);

        // Se o frontend não enviar o array 'fotos_existentes', garantimos que as imagens antigas não sumam por acidente
        if (!$request->has('fotos_existentes') && $servico->fotos) {
            $urlsFotos = json_decode($servico->fotos, true) ?? [];
        }

        // 2. Faz o upload das novas fotos (se houver) e adiciona na lista
        if ($request->hasFile('fotos')) {
            foreach ($request->file('fotos') as $foto) {
                // Limite de 5 fotos no total
                if (count($urlsFotos) < 5) {
                    $urlsFotos[] = ImageKitService::upload($foto, '/waitless/servicos');
                }
            }
        }

        // 3. Atualiza o banco com a junção das que ficaram + as novas
        if ($request->has('fotos_existentes') || $request->hasFile('fotos')) {
            $dadosParaAtualizar['fotos'] = json_encode(array_values($urlsFotos));
        }

        $servico->update($dadosParaAtualizar);

        return redirect()->back()->with('success', 'Serviço atualizado com sucesso!');
    }

    public function destroy($id, PagamentoService $mpService) // Ajustado nome da classe do serviço conforme os imports
    {
        $this->verificarPermissao();

        try {
            $servico = Servico::findOrFail($id);
            $estabelecimento = $servico->estabelecimento;

            $agendamentosAfetados = Agendamento::where('servico_id', $servico->id)
                ->whereIn('status', ['pendente', 'aguardando_pagamento', 'confirmado'])
                ->whereDate('data_agendamento', '>=', now()->toDateString())
                ->get();

            $estornosComSucesso = 0;
            $cancelamentosSimples = 0;

            foreach ($agendamentosAfetados as $agendamento) {
                $pagamento = Pagamento::where('agendamento_id', $agendamento->id)->first();

                if ($agendamento->status_pagamento === 'pago' && $pagamento && $pagamento->id_transacao_gateway) {
                    try {
                        $tokenSalao = $estabelecimento->token_mercadopago ?? null;
                         
                        $mpService->estornarPagamento($pagamento->id_transacao_gateway, $tokenSalao);
                        
                        $pagamento->update(['status' => 'estornado']);
                        $agendamento->update(['status' => 'cancelado', 'status_pagamento' => 'estornado']);
                        
                        $estornosComSucesso++;

                    } catch (Exception $e) {
                        \Log::error("Falha ao estornar agendamento {$agendamento->id}: " . $e->getMessage());
                    }
                } 
                else {
                    $agendamento->update(['status' => 'cancelado', 'status_pagamento' => 'cancelado']);
                    if ($pagamento && $pagamento->status !== 'pago') {
                        $pagamento->update(['status' => 'cancelado']);
                    }
                    $cancelamentosSimples++;
                }
            }

            $servico->delete(); 

            return back()->with('success', "Serviço removido com sucesso! $estornosComSucesso clientes foram reembolsados e $cancelamentosSimples vagas foram canceladas.");

        } catch (Exception $e) {
            return back()->with('error', 'Ocorreu um erro ao tentar remover o serviço: ' . $e->getMessage());
        }
    }

    /* =========================================================================
       👉 GESTÃO DO CATÁLOGO DE LOCAÇÕES (ItemAluguel) - COMPLETO COM ACESSÓRIOS
       ========================================================================= */

    public function indexItens(Request $request)
    {
        $estabelecimentosIds = Auth::user()->estabelecimentos()->pluck('id');

        $itens = ItemAluguel::whereIn('estabelecimento_id', $estabelecimentosIds)
            ->when($request->search, function ($query, $search) {
                $query->where('nome', 'like', "%{$search}%")
                      ->orWhere('modelo', 'like', "%{$search}%");
            })
            ->latest()
            ->paginate(10);

        return response()->json($itens);
    }

    public function storeItem(Request $request)
    {
        $this->verificarPermissao();

        $validated = $request->validate([
            'estabelecimento_id' => 'required|exists:estabelecimentos,id',
            'servico_id'         => 'nullable|exists:servicos,id',
            'nome'               => 'required|string|max:255',
            'categoria'          => 'required|in:casa,apartamento,sala,quadra,chacara,sitio,galpao,carro,moto,bicicleta,patinete,van,caminhao,barco,equipamento,ferramenta,camera,drone,audio_video,outro,casa_praia,flat',
            'modelo'             => 'nullable|string|max:255',
            'marca'              => 'nullable|string|max:255',
            'tipo'               => 'nullable|string|max:255',
            'descricao'          => 'nullable|string',
            'especificacoes'     => 'nullable|string',
            'quantidade'         => 'required|integer|min:1',
            'capacidade_pessoas' => 'nullable|integer|min:1',

            'valor_diaria'       => 'nullable|numeric|min:0',
            'valor_semanal'      => 'nullable|numeric|min:0',
            'valor_mensal'       => 'nullable|numeric|min:0',
            'valor_caucao'       => 'nullable|numeric|min:0',

            'fotos'              => 'nullable|array|max:5',
            'fotos.*'            => 'image|mimes:jpeg,png,jpg,webp|max:2048',

            'recursos_oferecidos'       => 'nullable|array',
            'acessorios'                => 'nullable|array',
            'acessorios.*.nome'         => 'required_with:acessorios|string|max:255',
            'acessorios.*.valor'        => 'required_with:acessorios|numeric|min:0',
            'funcionarios_responsaveis' => 'nullable|array',
            'funcionarios_responsaveis.*' => 'exists:funcionarios,id',

            'endereco'           => 'nullable|string|max:255',
            'numero'             => 'nullable|string|max:20',
            'complemento'        => 'nullable|string|max:255',
            'bairro'             => 'nullable|string|max:255',
            'cidade'             => 'nullable|string|max:255',
            'estado'             => 'nullable|string|size:2',
            'cep'                => 'nullable|string|max:10',
            'latitude'           => 'nullable|numeric',
            'longitude'          => 'nullable|numeric',
            'numero_quartos'     => 'nullable|integer|min:0',
            'numero_banheiros'   => 'nullable|integer|min:0',
            'numero_suites'      => 'nullable|integer|min:0',
            'numero_comodos'     => 'nullable|integer|min:0',
            'numero_vagas'       => 'nullable|integer|min:0',
            'area_total'         => 'nullable|numeric|min:0',
            'area_construida'    => 'nullable|numeric|min:0',
            'mobiliado'          => 'nullable|boolean',
            'aceita_pet'         => 'nullable|boolean',
            'possui_wifi'        => 'nullable|boolean',
            'possui_ar_condicionado' => 'nullable|boolean',
            'piscina'            => 'nullable|boolean',
            'churrasqueira'      => 'nullable|boolean',

            'placa'              => 'nullable|string|max:20',
            'renavam'            => 'nullable|string|max:20',
            'chassis'            => 'nullable|string|max:30',
            'marca_veiculo'      => 'nullable|string|max:255',
            'modelo_veiculo'     => 'nullable|string|max:255',
            'ano'                => 'nullable|integer|min:1900|max:'.(date('Y')+1),
            'cor'                => 'nullable|string|max:50',
            'combustivel'        => 'nullable|string|max:50',
            'cambio'             => 'nullable|string|max:50',
            'quilometragem'      => 'nullable|integer|min:0',
            'cilindrada'         => 'nullable|string|max:50',
            'potencia'           => 'nullable|string|max:50',
            'portas'             => 'nullable|integer|min:0',
            'lugares'            => 'nullable|integer|min:0',
            'possui_seguro'      => 'nullable|boolean',

            'fabricante'         => 'nullable|string|max:255',
            'numero_serie'       => 'nullable|string|max:255',
            'patrimonio'         => 'nullable|string|max:255',
            'voltagem'           => 'nullable|string|max:50',
            'potencia_equipamento' => 'nullable|string|max:50',
            'peso'               => 'nullable|string|max:50',
            'dimensoes'          => 'nullable|string|max:100',
            'garantia'           => 'nullable|string|max:255',

            'observacoes'        => 'nullable|string',
        ]);

        if (!Auth::user()->estabelecimentos->contains($validated['estabelecimento_id'])) {
            abort(403, 'Acesso não autorizado para esta filial.');
        }

        $urlsFotos = [];
        if ($request->hasFile('fotos')) {
            foreach ($request->file('fotos') as $foto) {
                $urlsFotos[] = ImageKitService::upload($foto, '/waitless/itens');
            }
        }

        $item = ItemAluguel::create(array_merge($validated, [
            'fotos'                     => json_encode($urlsFotos),
            'recursos_oferecidos'       => json_encode($validated['recursos_oferecidos'] ?? []),
            'acessorios'                => json_encode($validated['acessorios'] ?? []),
            'funcionarios_responsaveis' => json_encode($validated['funcionarios_responsaveis'] ?? []),
            'disponivel'                => true,
            'ativo'                     => true,
        ]));

        return response()->json(['success' => 'Sua reserva foi salva com sucesso!', 'item' => $item], 201);
    }

    public function showItem($id)
    {
        $item = ItemAluguel::with('estabelecimento')->findOrFail($id);
        
        if (!Auth::user()->estabelecimentos->contains($item->estabelecimento_id)) {
            abort(403, 'Acesso Restrito.');
        }

        return response()->json($item);
    }

    public function updateItem(Request $request, $id)
    {
        $this->verificarPermissao();
        $item = ItemAluguel::findOrFail($id);

        if (!Auth::user()->estabelecimentos->contains($item->estabelecimento_id)) {
            abort(403, 'Acesso Restrito.');
        }

        $validated = $request->validate([
            'servico_id'         => 'nullable|exists:servicos,id',
            'nome'               => 'required|string|max:255',
            'categoria'          => 'required|in:casa,apartamento,sala,quadra,chacara,sitio,galpao,carro,moto,bicicleta,patinete,van,caminhao,barco,equipamento,ferramenta,camera,drone,audio_video,outro,casa_praia,flat',
            'modelo'             => 'nullable|string|max:255',
            'marca'              => 'nullable|string|max:255',
            'tipo'               => 'nullable|string|max:255',
            'descricao'          => 'nullable|string',
            'especificacoes'     => 'nullable|string',
            'quantidade'         => 'required|integer|min:1',
            'capacidade_pessoas' => 'nullable|integer|min:1',
            'disponivel'         => 'required|boolean',
            'ativo'              => 'required|boolean',
            
            'valor_diaria'       => 'nullable|numeric|min:0',
            'valor_semanal'      => 'nullable|numeric|min:0',
            'valor_mensal'       => 'nullable|numeric|min:0',
            'valor_caucao'       => 'nullable|numeric|min:0',

            // Campos de imagem ajustados para edição
            'fotos_existentes'   => 'nullable|array',
            'fotos_existentes.*' => 'string',
            'fotos'              => 'nullable|array|max:5',
            'fotos.*'            => 'image|mimes:jpeg,png,jpg,webp|max:2048',

            'recursos_oferecidos'       => 'nullable|array',
            'acessorios'                => 'nullable|array',
            'acessorios.*.nome'         => 'required_with:acessorios|string|max:255',
            'acessorios.*.valor'        => 'required_with:acessorios|numeric|min:0',
            'funcionarios_responsaveis' => 'nullable|array',
            'funcionarios_responsaveis.*' => 'exists:funcionarios,id',

            'endereco'           => 'nullable|string|max:255',
            'numero'             => 'nullable|string|max:20',
            'complemento'        => 'nullable|string|max:255',
            'bairro'             => 'nullable|string|max:255',
            'cidade'             => 'nullable|string|max:255',
            'estado'             => 'nullable|string|size:2',
            'cep'                => 'nullable|string|max:10',
            'numero_quartos'     => 'nullable|integer|min:0',
            'numero_banheiros'   => 'nullable|integer|min:0',
            'numero_suites'      => 'nullable|integer|min:0',
            'numero_vagas'       => 'nullable|integer|min:0',
            'area_total'         => 'nullable|numeric|min:0',
            
            'placa'              => 'nullable|string|max:20',
            'renavam'            => 'nullable|string|max:20',
            'chassis'            => 'nullable|string|max:30',
            'quilometragem'      => 'nullable|integer|min:0',
            'possui_seguro'      => 'nullable|boolean',
            
            'fabricante'         => 'nullable|string|max:255',
            'numero_serie'       => 'nullable|string|max:255',
            'patrimonio'         => 'nullable|string|max:255',
            'voltagem'           => 'nullable|string|max:50',
        ]);

        $dadosParaAtualizar = array_merge($validated, [
            'recursos_oferecidos'       => json_encode($validated['recursos_oferecidos'] ?? []),
            'acessorios'                => json_encode($validated['acessorios'] ?? []),
            'funcionarios_responsaveis' => json_encode($validated['funcionarios_responsaveis'] ?? []),
        ]);

        // --- LÓGICA DE IMAGENS (Item Aluguel) ---
        $urlsFotos = $request->input('fotos_existentes', []);

        if (!$request->has('fotos_existentes') && $item->fotos) {
            $urlsFotos = json_decode($item->fotos, true) ?? [];
        }

        if ($request->hasFile('fotos')) {
            foreach ($request->file('fotos') as $foto) {
                if (count($urlsFotos) < 5) {
                    $urlsFotos[] = ImageKitService::upload($foto, '/waitless/itens');
                }
            }
        }

        if ($request->has('fotos_existentes') || $request->hasFile('fotos')) {
            $dadosParaAtualizar['fotos'] = json_encode(array_values($urlsFotos));
        }

        $item->update($dadosParaAtualizar);

        return response()->json(['success' => 'Item atualizado com sucesso!', 'item' => $item]);
    }

    public function destroyItem($id)
    {
        $this->verificarPermissao();
        $item = ItemAluguel::findOrFail($id);

        if (!Auth::user()->estabelecimentos->contains($item->estabelecimento_id)) {
            abort(403, 'Acesso Restrito.');
        }

        $item->delete(); 
        return response()->json(['success' => 'Item removido do catálogo com sucesso!']);
    }
}