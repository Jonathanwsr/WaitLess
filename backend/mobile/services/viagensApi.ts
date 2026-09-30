import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';

export type Resposta<T = any> = { ok: boolean; status: number; dados: T; erro: string | null };

/** Chamada autenticada à API de viagens; nunca lança — devolve o erro já em português. */
export async function apiViagem<T = any>(caminho: string, metodo: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', corpo?: unknown): Promise<Resposta<T>> {
  try {
    const token = (await AsyncStorage.getItem('@waitless_token')) || (await AsyncStorage.getItem('@lokyva_token'));
    const r = await fetch(`${API_URL}/viagens${caminho}`, {
      method: metodo,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
    });
    const dados = await r.json().catch(() => null);
    if (r.ok) return { ok: true, status: r.status, dados, erro: null };

    const primeiroErro = dados?.errors ? (Object.values(dados.errors)[0] as string[])?.[0] : null;
    return { ok: false, status: r.status, dados, erro: dados?.erro || primeiroErro || dados?.message || 'Não conseguimos concluir agora. Tente novamente em instantes.' };
  } catch {
    return { ok: false, status: 0, dados: null as any, erro: 'Sem conexão com o servidor. Verifique sua internet e tente de novo.' };
  }
}

export const brl = (v: unknown) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

const parse = (d?: string | null) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`) : null);
export const dia = (d?: string | null) => parse(d)?.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '') ?? '';
export const diaLongo = (d?: string | null) => parse(d)?.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }) ?? '';
export const hora = (h?: string | null) => (h ? String(h).slice(0, 5) : '');
export const isoData = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export type TipoMeta = { nome: string; icone: keyof typeof Ionicons.glyphMap; cor: string; bg: string };
export const TIPOS: Record<string, TipoMeta> = {
  hospedagem: { nome: 'Hospedagem', icone: 'bed-outline', cor: '#4F46E5', bg: '#EEF2FF' },
  transporte: { nome: 'Veículo', icone: 'car-outline', cor: '#0284C7', bg: '#E0F2FE' },
  servico: { nome: 'Serviço', icone: 'sparkles-outline', cor: '#F0561D', bg: '#FDEEE6' },
  atracao: { nome: 'Passeio', icone: 'location-outline', cor: '#059669', bg: '#D1FAE5' },
  livre: { nome: 'Tempo livre', icone: 'time-outline', cor: '#6B7280', bg: '#F3F4F6' },
  personalizado: { nome: 'Compromisso', icone: 'star-outline', cor: '#D97706', bg: '#FEF3C7' },
};

export const STATUS_ITEM: Record<string, { texto: string; cor: string; bg: string }> = {
  sugerido: { texto: 'Sugerido', cor: '#6B7280', bg: '#F3F4F6' },
  reservado: { texto: 'Reservado', cor: '#B45309', bg: '#FEF3C7' },
  confirmado: { texto: 'Confirmado', cor: '#15803D', bg: '#DCFCE7' },
  cancelado: { texto: 'Cancelado', cor: '#B91C1C', bg: '#FEE2E2' },
};

export const PRESENCA: Record<string, { texto: string; cor: string; bg: string }> = {
  confirmado: { texto: 'Vou', cor: '#15803D', bg: '#DCFCE7' },
  talvez: { texto: 'Talvez', cor: '#B45309', bg: '#FEF3C7' },
  recusado: { texto: 'Não vou', cor: '#B91C1C', bg: '#FEE2E2' },
  pendente: { texto: 'Aguardando', cor: '#6B7280', bg: '#F3F4F6' },
};

/** Agrupa por dia; hospedagem/veículo de vários dias ficam em "fixos". */
export function agruparPorDia<T extends { tipo: string; dia: string | null; data_fim: string | null; hora_inicio: string | null; ordem: number }>(itens: T[]) {
  const fixos = itens.filter((i) => ['hospedagem', 'transporte'].includes(i.tipo) && i.data_fim && i.data_fim !== i.dia);
  const porDia: Record<string, T[]> = {};
  itens.filter((i) => !fixos.includes(i)).forEach((i) => {
    const chave = i.dia || 'sem-data';
    (porDia[chave] = porDia[chave] || []).push(i);
  });
  Object.values(porDia).forEach((l) => l.sort((a, b) => (a.hora_inicio || '99').localeCompare(b.hora_inicio || '99') || a.ordem - b.ordem));
  return { fixos, dias: Object.keys(porDia).sort().map((d) => ({ dia: d, itens: porDia[d] })) };
}
