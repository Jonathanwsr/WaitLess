// Catálogo único de planos de assinatura, espelhando exatamente o mesmo
// esquema usado na tela web (Cliente/StatusAssinatura.jsx) e no
// AssinaturaController: cada tipo de usuário (cliente ou sócio) tem vários
// planos à escolha, mensais e anuais. Este é o único catálogo de planos do
// app mobile — todas as telas de assinatura devem importar daqui.

export interface Plano {
  id: string;
  nome: string;
  preco: string;
  precoOriginal?: string;
  ciclo: 'mensal' | 'anual';
  desc: string;
  destaque: boolean;
  badge?: string;
  gradiente?: [string, string];
  // Do servidor vêm explicados ({ titulo, texto }); a lista local antiga ainda é texto simples.
  beneficios: (string | { titulo: string; texto: string })[];
}

export const PLANOS_SOCIO: Plano[] = [
  {
    id: 'premium', nome: 'Premium', preco: '15,00', ciclo: 'mensal', destaque: false,
    desc: 'Ideal para iniciar e ganhar visibilidade na plataforma.',
    beneficios: ['Taxa 50% menor nos pagamentos no local', 'Destaque no Explorar', 'Relatório avançado', 'Clientes a caminho, ao vivo', 'Resumo financeiro semanal por e-mail', '50 pontos de bônus todo mês'],
  },
  {
    id: 'premium-socio', nome: 'Premium Sócio', preco: '30,00', ciclo: 'mensal', destaque: true,
    badge: 'Máximo Retorno', gradiente: ['#14B8A6', '#00A868'],
    desc: 'Destaque máximo e isenção de taxas presenciais.',
    beneficios: ['Isenção total da taxa no balcão', 'Nota fiscal automática de cada venda', 'Equipe sem limite', 'Destaque máximo no Explorar', 'Relatório avançado', '300 pontos de bônus todo mês'],
  },
  {
    id: 'premium-anual', nome: 'Premium Anual', preco: '126,00', precoOriginal: '180,00', ciclo: 'anual', destaque: false,
    badge: '30% OFF',
    desc: '1 ano inteiro de visibilidade com 30% de desconto.',
    beneficios: ['600 pontos na ativação', '30% mais barato que o mensal', 'Taxa 50% menor nos pagamentos no local', 'Destaque no Explorar', 'Relatório avançado'],
  },
  {
    id: 'premium-socio-anual', nome: 'Sócio Anual', preco: '252,00', precoOriginal: '360,00', ciclo: 'anual', destaque: true,
    badge: 'Melhor Custo-Benefício', gradiente: ['#2563EB', '#4338CA'],
    desc: 'O pacote definitivo de 1 ano com isenção total de taxas e 30% OFF.',
    beneficios: ['3.600 pontos na ativação', '30% mais barato que o mensal', 'Isenção total da taxa no balcão', 'Nota fiscal automática de cada venda', 'Equipe sem limite'],
  },
];

export const PLANOS_CLIENTE: Plano[] = [
  {
    id: 'premium', nome: 'Premium', preco: '8,00', ciclo: 'mensal', destaque: false,
    desc: 'Para economizar com pontos e ter acesso a ofertas exclusivas.',
    beneficios: ['Use pontos em qualquer serviço ou reserva', '50 pontos de bônus todo mês', 'Ofertas e serviços exclusivos', 'Cupons exclusivos para assinantes', 'Pontos em dobro ao avaliar'],
  },
  {
    id: 'premium-plus', nome: 'Premium Plus', preco: '14,00', ciclo: 'mensal', destaque: true,
    badge: 'Mais Vantagens', gradiente: ['#C026D3', '#7E22CE'],
    desc: 'A experiência completa: mais pontos e as ofertas mais exclusivas.',
    beneficios: ['150 pontos de bônus todo mês', '3 pontos a cada R$ 1 em produtos', 'Ofertas do nível Plus', 'Use pontos em qualquer serviço ou reserva', 'Cupons exclusivos para assinantes'],
  },
];

export function catalogoPorPapel(papel: string): Plano[] {
  return papel === 'socio' ? PLANOS_SOCIO : PLANOS_CLIENTE;
}
