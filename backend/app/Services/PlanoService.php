<?php

namespace App\Services;

use App\Models\User;

class PlanoService
{
   
    const LIMITES = [
        'gratuito' => [ 
            'max_estabelecimentos' => 1,
            'max_servicos' => 5,
            'max_funcionarios' => 1,
            'tem_relatorio_avancado' => false,
            'pode_criar_cupons' => false,
        ],
        'basico' => [
            'max_estabelecimentos' => 3,
            'max_servicos' => 15,
            'max_funcionarios' => 2,
            'tem_relatorio_avancado' => false,
            'pode_criar_cupons' => false,
        ],
        'profissional' => [
            'max_estabelecimentos' => 15,
            'max_servicos' => 60,
            'max_funcionarios' => 10,
            'tem_relatorio_avancado' => true,
            'pode_criar_cupons' => true, 
        ],
        'premium' => [
            'max_estabelecimentos' => 9999, 
            'max_servicos' => 9999, 
            'max_funcionarios' => 9999, 
            'tem_relatorio_avancado' => true,
            'pode_criar_cupons' => true,
        ]
    ];

    /**
     * Verifica se o usuário pode criar mais um estabelecimento
     */
    public function podeCriarEstabelecimento(User $user): bool
    {
        $plano = $user->plano_atual; // Usa o helper que criamos no Model
        $limite = self::LIMITES[$plano]['max_estabelecimentos'] ?? 1;
        
        $cadastrados = $user->estabelecimentos()->count();
        
        return $cadastrados < $limite;
    }

    /**
     * Verifica se pode criar mais um serviço dentro de um estabelecimento
     */
    public function podeCriarServico(User $user, $estabelecimentoId): bool
    {
        $plano = $user->plano_atual;
        $limite = self::LIMITES[$plano]['max_servicos'] ?? 5;
        
        $cadastrados = \App\Models\Servico::where('estabelecimento_id', $estabelecimentoId)->count();
        
        return $cadastrados < $limite;
    }

    /**
     * Retorna se a loja tem acesso à aba de Marketing (Cupons)
     */
    public function temAcessoMarketing(User $user): bool
    {
        $plano = $user->plano_atual;
        return self::LIMITES[$plano]['pode_criar_cupons'] ?? false;
    }
}