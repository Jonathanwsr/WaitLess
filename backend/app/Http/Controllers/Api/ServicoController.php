<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agendamento;
use App\Models\Pagamento;
use App\Services\MercadoPagoService;
use App\Services\ImageKitService; 
use Carbon\Carbon;
use Exception;
use App\Models\Servico;
use App\Models\Funcionario;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

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
            abort(403, 'Acesso Negado: Você não tem permissão para gerenciar serviços.');
        }
    }

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
                // 👉 Salva a lista de URLs como formato JSON no banco
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

      
        if ($request->hasFile('fotos')) {
            $urlsFotos = [];
            foreach ($request->file('fotos') as $foto) {
                $urlsFotos[] = ImageKitService::upload($foto, '/waitless/servicos');
            }
            $dadosParaAtualizar['fotos'] = json_encode($urlsFotos);
        }

        $servico->update($dadosParaAtualizar);

        return redirect()->back()->with('success', 'Serviço atualizado com sucesso!');
    }

   
    public function destroy($id, MercadoPagoService $mpService)
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
}