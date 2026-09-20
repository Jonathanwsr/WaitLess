<?php

namespace App\Services;

use App\Models\User;
use App\Models\HistoricoPonto;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class PlanoService
{
    // Catálogo Oficial com as Regras de Negócio e Pontuação
    const CATALOGO = [
        'cliente_flex' => [
            'valor' => 14.90, 'pontos' => 500, 'ciclo' => 'mensal', 'tipo' => 'cliente'
        ],
        'cliente_anual' => [
            'valor' => 9.90, 'pontos' => 600, 'ciclo' => 'anual', 'tipo' => 'cliente'
        ],
        'proprietario' => [
            'valor' => 25.00, 'pontos' => 1000, 'ciclo' => 'mensal', 'tipo' => 'estabelecimento',
            'max_estabelecimentos' => 1, 'max_servicos' => 20
        ],
        'socio_mensal' => [
            'valor' => 50.00, 'pontos' => 2500, 'ciclo' => 'mensal', 'tipo' => 'estabelecimento',
            'max_estabelecimentos' => 3, 'max_servicos' => 999
        ],
        'socio_anual' => [
            'valor' => 520.00, 'pontos' => 2500, 'ciclo' => 'anual', 'tipo' => 'estabelecimento',
            'parcelas' => 5, 'valor_parcela' => 104.00,
            'max_estabelecimentos' => 3, 'max_servicos' => 999
        ]
    ];

    /**
     * Catálogo dos planos "premium" vendidos hoje via tela de assinatura
     * (web e mobile). Fica centralizado aqui para que as duas camadas
     * (Api\AssinaturaController e Api\Mobile\AssinaturaMobileController)
     * nunca fiquem com regras de preço/ciclo divergentes entre si.
     */
    const PLANOS_PREMIUM = [
        'socio' => [
            'premium'             => ['valor' => 15.00,  'tipo_publico' => 'estabelecimento', 'ciclo' => 'mensal'],
            'premium-socio'       => ['valor' => 30.00,  'tipo_publico' => 'estabelecimento', 'ciclo' => 'mensal'],
            'premium-anual'       => ['valor' => 126.00, 'tipo_publico' => 'estabelecimento', 'ciclo' => 'anual'],
            'premium-socio-anual' => ['valor' => 252.00, 'tipo_publico' => 'estabelecimento', 'ciclo' => 'anual'],
        ],
        'user' => [
            'premium'      => ['valor' => 8.00,  'tipo_publico' => 'cliente', 'ciclo' => 'mensal'],
            'premium-plus' => ['valor' => 14.00, 'tipo_publico' => 'cliente', 'ciclo' => 'mensal'],
        ],
    ];

    /**
     * Lista os planos premium que um determinado papel (socio/user) pode assinar.
     */
    public function planosPermitidos(string $papel): array
    {
        return array_keys(self::PLANOS_PREMIUM[$papel] ?? []);
    }

    /**
     * Resolve valor, tipo de público e ciclo de um plano premium para o papel informado.
     */
    public function resolverDetalhesPlano(string $papel, string $plano): array
    {
        return self::PLANOS_PREMIUM[$papel][$plano]
            ?? ['valor' => 0, 'tipo_publico' => 'cliente', 'ciclo' => 'mensal'];
    }

    /**
     * Adiciona os pontos ao usuário e registra no histórico de forma segura
     */
    public function distribuirPontosAssinatura(User $user, string $plano)
    {
        if (!array_key_exists($plano, self::CATALOGO)) return false;

        $pontosGanhos = self::CATALOGO[$plano]['pontos'];

        DB::transaction(function () use ($user, $pontosGanhos, $plano) {
            // Acumula no saldo principal do usuário
            $user->increment('pontos_saldo', $pontosGanhos);

            // Grava o extrato
            HistoricoPonto::create([
                'usuario_id' => $user->id,
                'estabelecimento_id' => null, // Pontos globais da plataforma
                'tipo' => 'ganho',
                'descricao' => "Renovação do plano {$plano}",
                'quantidade' => $pontosGanhos,
            ]);
        });

        // Dispara notificação push (exemplo abstrato)
        // $user->notify(new PontosDisponiveisNotification($pontosGanhos));

        return true;
    }

    /**
     * Retorna os benefícios ativos, permitindo o uso até a data de expiração 
     * mesmo se cancelado antes (controle de ciclo de vida)
     */
    public function obterStatusBeneficios(User $user)
    {
        if ($user->plano_expira_em && Carbon::now()->lessThanOrEqualTo($user->plano_expira_em)) {
            return 'ativo';
        }
        return 'inativo';
    }
}