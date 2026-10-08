import AsyncStorage from '@react-native-async-storage/async-storage';

const ENV_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';
const cleanBaseUrl = ENV_URL.replace(/\/mobile\/?$/, '').replace(/\/+$/, '');
export const API_MOBILE = `${cleanBaseUrl}/mobile`;

export async function pegarToken(): Promise<string | null> {
  return (await AsyncStorage.getItem('@waitless_token')) || (await AsyncStorage.getItem('@lokyva_token'));
}

type Opcoes = Omit<RequestInit, 'body'> & { json?: unknown; body?: BodyInit | null };

/** Chamada autenticada à API mobile. Devolve sempre { ok, status, data } — nunca lança por status. */
export async function apiMobile<T = any>(caminho: string, opcoes: Opcoes = {}): Promise<{ ok: boolean; status: number; data: T }> {
  const token = await pegarToken();
  const { json, headers, body, ...resto } = opcoes;

  const res = await fetch(`${API_MOBILE}${caminho}`, {
    ...resto,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...((headers as Record<string, string>) || {}),
    },
    body: json !== undefined ? JSON.stringify(json) : body,
  });

  const data = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, data };
}

export function mensagemDeErro(data: any, padrao: string): string {
  if (data?.error && typeof data.error === 'string') return data.error;
  if (data?.message && typeof data.message === 'string') return data.message;
  if (data?.errors) {
    const primeiro = Object.values(data.errors)[0];
    if (Array.isArray(primeiro) && primeiro.length) return String(primeiro[0]);
  }
  return padrao;
}

export const brl = (valor: unknown) => `R$ ${Number(valor || 0).toFixed(2).replace('.', ',')}`;

export const COMO_FUNCIONA = [
  ['Pague do seu jeito', 'Online (protegido até a entrega), no local ou direto com o vendedor. O online só aparece quando o vendedor recebe pela plataforma.'],
  ['Entrega ou retirada', 'Escolha receber em casa, informando o endereço completo, ou buscar no endereço do vendedor.'],
  ['Código de 6 dígitos', 'Em "Meus pedidos" você vê o seu código. Mostre ao vendedor na entrega: só com ele o pagamento é liberado.'],
  ['Comprovante e estorno', 'Baixe o comprovante em PDF, fale com o vendedor e peça estorno se algo der errado, em até 4 dias depois da entrega.'],
];

export type ProdutoEntrega = {
  id: number;
  vendedor_premium?: boolean;
  total_vendidos?: number;
  nome: string;
  descricao?: string | null;
  categoria?: string | null;
  marca?: string | null;
  unidade_medida?: string | null;
  peso_volume?: string | null;
  sku?: string | null;
  tags?: string[] | null;
  valor: number | string;
  valor_final: number | string;
  tem_promocao: boolean;
  taxa_entrega: number | string;
  estoque_disponivel: number;
  quantidade_minima?: number;
  aceita_entrega?: boolean;
  aceita_retirada?: boolean;
  aceita_pagamento_online?: boolean;
  favoritado?: boolean;
  fotos?: string[] | null;
  endereco_rua?: string;
  endereco_numero?: string;
  endereco_bairro?: string;
  endereco_cidade?: string;
  endereco_estado?: string;
  endereco_cep?: string;
  estabelecimento?: { id: number; nome: string } | null;
  vendedor?: { id: number; name: string } | null;
};

export type PedidoEntrega = {
  id: number;
  codigo_pedido: string;
  status: string;
  quantidade: number;
  valor_total: number | string;
  taxa_entrega: number | string;
  modo_recebimento: 'entrega' | 'retirada';
  modo_pagamento: 'online' | 'local' | 'direto_vendedor';
  metodo_pagamento?: string | null;
  forma_pagamento_label: string;
  endereco_recebimento: string;
  entrega_observacoes?: string | null;
  codigo_confirmacao_visivel?: string | null;
  disputa_status?: string | null;
  produto_entrega_id: number;
  produto?: { id: number; nome: string; fotos?: string[] | null; categoria?: string | null } | null;
  estabelecimento?: { id: number; nome: string } | null;
  vendedor?: { id: number; name: string; mobile_phone?: string | null } | null;
  created_at?: string;
  data_conclusao?: string | null;
  avaliado?: boolean;
  pontos_ganhos?: number;
  em_rota?: boolean;
};

export const STATUS_PEDIDO: Record<string, { label: string; cor: string; fundo: string }> = {
  pendente_pagamento: { label: 'Aguardando pagamento', cor: '#B45309', fundo: '#FEF3C7' },
  pago: { label: 'Pago · aguardando entrega', cor: '#1D4ED8', fundo: '#DBEAFE' },
  aguardando_confirmacao: { label: 'Aguardando entrega', cor: '#1D4ED8', fundo: '#DBEAFE' },
  concluido: { label: 'Entregue', cor: '#047857', fundo: '#D1FAE5' },
  cancelado: { label: 'Cancelado', cor: '#525252', fundo: '#F3F4F6' },
  estornado: { label: 'Estornado', cor: '#525252', fundo: '#F3F4F6' },
};
