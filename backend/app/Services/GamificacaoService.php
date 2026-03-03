<?php

namespace App\Services;

use App\Models\User;
use App\Models\Estabelecimento;
use Illuminate\Support\Facades\Log;

class GamificacaoService
{
    // Tabela de Pontuação Padrão
    const PONTOS_AGENDAMENTO_CONCLUIDO = 10;
    const PONTOS_PAGAMENTO_RAPIDO = 5;
    const PONTOS_AVALIACAO = 15;
    
    // Benefícios do Plano Plus
    const MULTIPLICADOR_PLUS = 2; // Assinantes ganham o dobro de pontos!

    /**
     * Verifica se o usuário tem o plano Plus ativo
     */
    public function isUserPlus(User $user): bool
    {
        return $user->plano_assinatura === 'plus' && 
               $user->plano_expira_em && 
               $user->plano_expira_em->isFuture();
    }

    /**
     * Adiciona pontos ao usuário com base na ação que ele fez
     */
    public function adicionarPontos(User $user, string $acao)
    {
        $pontosGanhos = 0;

        switch ($acao) {
            case 'agendamento':
                $pontosGanhos = self::PONTOS_AGENDAMENTO_CONCLUIDO;
                break;
            case 'pagamento_rapido':
                $pontosGanhos = self::PONTOS_PAGAMENTO_RAPIDO;
                break;
            case 'avaliacao':
                $pontosGanhos = self::PONTOS_AVALIACAO;
                break;
        }

        // 👉 A MÁGICA DO PLANO PLUS: Multiplicador de pontos!
        if ($this->isUserPlus($user)) {
            $pontosGanhos *= self::MULTIPLICADOR_PLUS;
        }

        if ($pontosGanhos > 0) {
            $user->increment('pontos_saldo', $pontosGanhos);
            
            // Aqui futuramente podemos salvar num "historico_pontos" para ele ver o extrato
            Log::info("Usuário {$user->id} ganhou {$pontosGanhos} pontos por {$acao}. Saldo: {$user->pontos_saldo}");
        }

        return $pontosGanhos;
    }

    /**
     * Resgata pontos por um desconto num estabelecimento
     */
    public function usarPontos(User $user, Estabelecimento $estabelecimento, int $pontosCustos)
    {
        // 1. O usuário tem pontos suficientes?
        if ($user->pontos_saldo < $pontosCustos) {
            throw new \Exception("Pontos insuficientes.");
        }

        // 2. REGRA DO PLANO PLUS: Pode usar em qualquer estabelecimento?
        // Se for gratuito, ele só poderia usar num estabelecimento onde ele tem "vínculo" (teremos que refinar essa regra na tabela de cupons).
        // Por enquanto, vamos assumir que o Plus deixa ele burlar regras locais.
        $podeUsar = true; 
        
        if (!$this->isUserPlus($user)) {
            // Lógica restritiva: Exemplo: Verificar se o estabelecimento aceita pontos de plano gratuito
            if (!$estabelecimento->aceita_pontos_gratuitos) {
                 throw new \Exception("Apenas usuários WaitLess Plus podem usar pontos neste estabelecimento.");
            }
        }

        // 3. Debita os pontos
        if ($podeUsar) {
            $user->decrement('pontos_saldo', $pontosCustos);
            return true; // Resgate com sucesso!
        }

        return false;
    }

    /**
     * Retorna os benefícios que o usuário tem na fila
     */
    public function getBeneficiosFila(User $user): array
    {
        if ($this->isUserPlus($user)) {
            return [
                'preferencia_fila' => true,
                'estorno_garantido_2h' => true,
                'acesso_antecipado' => true,
            ];
        }

        return [
            'preferencia_fila' => false,
            'estorno_garantido_2h' => false,
            'acesso_antecipado' => false,
        ];
    }
}