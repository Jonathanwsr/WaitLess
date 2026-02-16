<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;

use App\Models\Servico;
use Illuminate\Http\Request;
use App\Models\Funcionario;


class ServicoController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'nome'                 => 'required|string|max:255',
            'descricao'            => 'nullable|string',
            'valor'                => 'required|numeric|min:0',
            'duracao_minutos'      => 'required|integer|min:1',
            'estabelecimentos_ids' => 'required|array|min:1', 
            'estabelecimentos_ids.*' => 'exists:estabelecimentos,id',
            'funcionario_id'       => 'nullable|exists:funcionarios,id',
            'dias_disponiveis'     => 'required|array',
            'tipo_pagamento'       => 'required|in:hibrido,online,local', 
        ]);

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
                'estabelecimento_id' => $est_id,
                'nome'               => $validated['nome'],
                'descricao'          => $validated['descricao'] ?? null,
                'valor'              => $validated['valor'],
                'duracao_minutos'    => $validated['duracao_minutos'],
                'ativo'              => true,
                'configuracoes'      => json_encode([
                    'dias_disponiveis'   => $validated['dias_disponiveis'],
                    'tipo_pagamento'     => $validated['tipo_pagamento'],
                    'funcionario_padrao' => $funcionarioParaSalvar
                ])
            ]);
        }

        return redirect()->back()->with('success', 'Serviço adicionado ao catálogo!');
    }
}