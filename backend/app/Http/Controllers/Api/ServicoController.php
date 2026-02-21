<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Servico;
use App\Models\Funcionario;
use Illuminate\Http\Request;

class ServicoController extends Controller
{
    
    public function store(Request $request)
    {
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
            'horarios_disponiveis' => 'nullable|array', // Tornamos nullable para não dar erro se for vazio
            'tipo_pagamento'       => 'required|in:hibrido,online,local', 
        ]);

        // PROTEÇÃO: Se não vier nada do React, assume um Array vazio
        $horarios = $validated['horarios_disponiveis'] ?? [];
        $dias = $validated['dias_disponiveis'] ?? [];

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
                ])
            ]);
        }

        return redirect()->back()->with('success', 'Serviço adicionado ao catálogo!');
    }

    
    public function update(Request $request, Servico $servico)
    {
        $validated = $request->validate([
            'nome'                 => 'required|string|max:255',
            'tipo_servico'         => 'required|string|max:255',
            'descricao'            => 'nullable|string',
            'valor'                => 'required|numeric|min:0',
            'duracao_minutos'      => 'required|integer|min:1',
            'funcionario_id'       => 'nullable|exists:funcionarios,id',
            'dias_disponiveis'     => 'nullable|array',
            'horarios_disponiveis' => 'nullable|array',
            'tipo_pagamento'       => 'required|in:hibrido,online,local', 
        ]);

        // PROTEÇÃO CONTRA O "UNDEFINED ARRAY KEY"
        $horarios = $validated['horarios_disponiveis'] ?? [];
        $dias = $validated['dias_disponiveis'] ?? [];

        $servico->update([
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
        ]);

        return redirect()->back()->with('success', 'Serviço atualizado com sucesso!');
    }
}