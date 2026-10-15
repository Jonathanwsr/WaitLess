<?php

namespace App\Support;

use App\Services\PlanoService;

/**
 * Benefícios de cada plano, explicados para quem vai assinar (web e app usam esta mesma lista).
 * Só entra aqui o que o sistema faz de verdade — cada item aponta para a regra que o aplica.
 */
class BeneficiosPlanos
{
    private const CLIENTE_PREMIUM = [
        ['icone' => 'star', 'titulo' => 'Use pontos em qualquer serviço ou reserva', 'texto' => 'Pague parte ou todo o valor com seus pontos, mesmo nos locais que não aceitam pontos para quem não é Premium.'],
        ['icone' => 'gift', 'titulo' => '50 pontos de bônus todo mês', 'texto' => 'Caem na sua conta a cada mês de assinatura, além dos pontos que você já ganha usando o app.'],
        ['icone' => 'sparkles', 'titulo' => 'Ofertas e serviços exclusivos', 'texto' => 'Acesso aos serviços, reservas e promoções marcados como "Só Premium".'],
        ['icone' => 'ticket', 'titulo' => 'Cupons exclusivos para assinantes', 'texto' => 'Cupons de desconto que os locais liberam só para quem é Premium.'],
        ['icone' => 'chat', 'titulo' => 'Pontos em dobro ao avaliar', 'texto' => 'Cada avaliação que você faz depois de um atendimento rende o dobro de pontos.'],
        ['icone' => 'bag', 'titulo' => '1 ponto a cada R$ 1 em produtos', 'texto' => 'Nas compras de produtos com entrega ou retirada (sem plano, é meio ponto por real).'],
        ['icone' => 'map', 'titulo' => 'Viagem montada automaticamente', 'texto' => 'Na mala de viagem, o roteiro inteligente sugere hospedagem, passeios e transporte de uma vez.'],
        ['icone' => 'chart', 'titulo' => 'Seu relatório pessoal', 'texto' => 'Quanto você gastou, os serviços que mais usa e os pontos que acumulou.'],
    ];

    private const CLIENTE_PLUS_EXTRA = [
        ['icone' => 'gift', 'titulo' => '150 pontos de bônus todo mês', 'texto' => 'Três vezes o bônus mensal do Premium.'],
        ['icone' => 'bag', 'titulo' => '3 pontos a cada R$ 1 em produtos', 'texto' => 'O triplo de pontos nas compras de produtos com entrega ou retirada.'],
        ['icone' => 'sparkles', 'titulo' => 'Ofertas do nível Plus', 'texto' => 'Além das ofertas Premium, as ofertas mais exclusivas, liberadas só para o Plus.'],
    ];

    private const SOCIO_PREMIUM = [
        ['icone' => 'percent', 'titulo' => 'Taxa 50% menor nos pagamentos no local', 'texto' => 'A taxa da plataforma sobre o que o cliente paga no balcão cai pela metade.'],
        ['icone' => 'trophy', 'titulo' => 'Destaque no Explorar', 'texto' => 'Seus serviços e reservas aparecem antes dos locais sem plano nas buscas e recomendações.'],
        ['icone' => 'chart', 'titulo' => 'Relatório avançado', 'texto' => 'Faturamento, ranking da equipe, serviços mais vendidos, horários de pico e perfil dos clientes.'],
        ['icone' => 'map', 'titulo' => 'Clientes a caminho, ao vivo', 'texto' => 'Veja no mapa onde está o cliente que vem para o seu local e quanto falta para chegar.'],
        ['icone' => 'doc', 'titulo' => 'Contratos de locação', 'texto' => 'Gere contratos para as suas reservas e envie para o cliente assinar.'],
        ['icone' => 'mail', 'titulo' => 'Resumo financeiro semanal por e-mail', 'texto' => 'Toda semana, entradas, taxas e repasses dos seus locais no seu e-mail.'],
        ['icone' => 'gift', 'titulo' => '50 pontos de bônus todo mês', 'texto' => 'Para você usar como cliente em qualquer local da Lokyva.'],
    ];

    private const SOCIO_PREMIUM_SOCIO_EXTRA = [
        ['icone' => 'percent', 'titulo' => 'Isenção total da taxa no balcão', 'texto' => 'Nos pagamentos feitos no local, a plataforma não cobra taxa nenhuma.'],
        ['icone' => 'doc', 'titulo' => 'Nota fiscal automática de cada venda', 'texto' => 'A cada venda online, a nota sai sozinha para o cliente, com a sua configuração fiscal.'],
        ['icone' => 'users', 'titulo' => 'Equipe sem limite', 'texto' => 'Cadastre quantos funcionários e gerentes quiser (sem plano, o limite é de ' . PlanoService::LIMITE_FUNCIONARIOS_PLANO_GRATUITO . ' por local) e convide outros sócios.'],
        ['icone' => 'trophy', 'titulo' => 'Destaque máximo no Explorar', 'texto' => 'Prioridade máxima nas buscas e recomendações do app.'],
        ['icone' => 'gift', 'titulo' => '300 pontos de bônus todo mês', 'texto' => 'Seis vezes o bônus do Premium.'],
    ];

    /** Lista completa e explicada para um plano. */
    public static function de(string $plano, string $papel): array
    {
        $socio = in_array($papel, ['socio', 'proprietario', 'gerente'], true);

        return match (true) {
            $socio && $plano === 'premium' => self::SOCIO_PREMIUM,
            $socio && $plano === 'premium-anual' => array_merge(
                [['icone' => 'gift', 'titulo' => '600 pontos na ativação', 'texto' => 'Recebidos assim que o plano anual é pago.'], ['icone' => 'percent', 'titulo' => '30% mais barato que o mensal', 'texto' => 'Equivale a R$ 10,50 por mês, pago uma vez por ano.']],
                array_values(array_filter(self::SOCIO_PREMIUM, fn ($b) => !str_contains($b['titulo'], 'pontos de bônus')))
            ),
            $socio && $plano === 'premium-socio' => array_merge(self::SOCIO_PREMIUM_SOCIO_EXTRA, self::semBonus(self::SOCIO_PREMIUM, ['Taxa 50% menor nos pagamentos no local', 'Destaque no Explorar'])),
            $socio && $plano === 'premium-socio-anual' => array_merge(
                [['icone' => 'gift', 'titulo' => '3.600 pontos na ativação', 'texto' => 'Recebidos assim que o plano anual é pago.'], ['icone' => 'percent', 'titulo' => '30% mais barato que o mensal', 'texto' => 'Equivale a R$ 21,00 por mês, pago uma vez por ano.']],
                self::semBonus(self::SOCIO_PREMIUM_SOCIO_EXTRA, []),
                self::semBonus(self::SOCIO_PREMIUM, ['Taxa 50% menor nos pagamentos no local', 'Destaque no Explorar'])
            ),
            $plano === 'premium-plus' => array_merge(self::CLIENTE_PLUS_EXTRA, self::semBonus(self::CLIENTE_PREMIUM, ['1 ponto a cada R$ 1 em produtos'])),
            default => self::CLIENTE_PREMIUM,
        };
    }

    /** Tira o bônus mensal (substituído pelo do plano) e os itens que o plano superior já cobre. */
    private static function semBonus(array $lista, array $sem): array
    {
        return array_values(array_filter($lista, fn ($b) => !str_contains($b['titulo'], 'pontos de bônus') && !in_array($b['titulo'], $sem, true)));
    }

    /** Catálogo de planos para a tela de assinatura (preço, ciclo e benefícios explicados). */
    public static function catalogo(string $papel): array
    {
        $grupo = in_array($papel, ['socio', 'proprietario', 'gerente'], true) ? 'socio' : 'user';
        $nomes = [
            'premium' => 'Premium', 'premium-plus' => 'Premium Plus', 'premium-socio' => 'Sócio Premium',
            'premium-anual' => 'Premium Anual', 'premium-socio-anual' => 'Sócio Anual',
        ];

        return collect(PlanoService::PLANOS_PREMIUM[$grupo] ?? [])
            ->map(fn ($p, $id) => [
                'id' => $id,
                'nome' => $nomes[$id] ?? ucfirst($id),
                'valor' => (float) $p['valor'],
                'ciclo' => $p['ciclo'],
                'beneficios' => self::de($id, $grupo === 'socio' ? 'socio' : 'user'),
            ])
            ->values()
            ->all();
    }
}
