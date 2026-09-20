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
  beneficios: string[];
}

export const PLANOS_SOCIO: Plano[] = [
  {
    id: 'premium', nome: 'Premium', preco: '15,00', ciclo: 'mensal', destaque: false,
    desc: 'Ideal para iniciar e ganhar visibilidade na plataforma.',
    beneficios: ['Taxas reduzidas', 'Suporte padrão', 'Painel de métricas básico'],
  },
  {
    id: 'premium-socio', nome: 'Premium Sócio', preco: '30,00', ciclo: 'mensal', destaque: true,
    badge: 'Máximo Retorno', gradiente: ['#14B8A6', '#059669'],
    desc: 'Destaque máximo e isenção de taxas presenciais.',
    beneficios: ['Isenção da taxa de 12% no balcão', 'Destaque no app', 'Suporte VIP 24/7', 'Métricas avançadas'],
  },
  {
    id: 'premium-anual', nome: 'Premium Anual', preco: '126,00', precoOriginal: '180,00', ciclo: 'anual', destaque: false,
    badge: '30% OFF',
    desc: '1 ano inteiro de visibilidade com 30% de desconto.',
    beneficios: ['Equivale a apenas R$ 10,50/mês', 'Ganha 600 pontos na hora', 'Taxas reduzidas', 'Suporte padrão'],
  },
  {
    id: 'premium-socio-anual', nome: 'Sócio Anual', preco: '252,00', precoOriginal: '360,00', ciclo: 'anual', destaque: true,
    badge: 'Melhor Custo-Benefício', gradiente: ['#2563EB', '#4338CA'],
    desc: 'O pacote definitivo de 1 ano com isenção total de taxas e 30% OFF.',
    beneficios: ['Equivale a apenas R$ 21,00/mês', 'Ganha 3600 pontos na hora', 'Isenção da taxa de 12%', 'Suporte VIP 24/7'],
  },
];

export const PLANOS_CLIENTE: Plano[] = [
  {
    id: 'premium', nome: 'Premium', preco: '8,00', ciclo: 'mensal', destaque: false,
    desc: 'Ideal para quem quer começar a economizar e pontuar.',
    beneficios: ['Ganhe 1 ponto a cada R$ 1', 'Acesso a promoções', 'Até 5% de desconto nas lojas'],
  },
  {
    id: 'premium-plus', nome: 'Premium Plus', preco: '14,00', ciclo: 'mensal', destaque: true,
    badge: 'Mais Vantagens', gradiente: ['#C026D3', '#7E22CE'],
    desc: 'A experiência completa com atendimento VIP e retornos altos.',
    beneficios: ['Ganhe 3 pontos a cada R$ 1', 'Descontos de 15% a 30%', 'Promoções secretas', 'Consultoria personalizada'],
  },
];

export function catalogoPorPapel(papel: string): Plano[] {
  return papel === 'socio' ? PLANOS_SOCIO : PLANOS_CLIENTE;
}
