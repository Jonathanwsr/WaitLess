import { API_MOBILE, pegarToken } from './entregasApi';

/** Guia do Local e Roteiros de Viagem (mesmos endpoints do site, em /api/mobile). */

export type Resposta<T = any> = { ok: boolean; status: number; dados: T; erro: string | null };

export async function apiRoteiro<T = any>(caminho: string, metodo: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', corpo?: unknown): Promise<Resposta<T>> {
  try {
    const token = await pegarToken();
    const r = await fetch(`${API_MOBILE}${caminho}`, {
      method: metodo,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
    });
    const dados = await r.json().catch(() => null);
    if (r.ok) return { ok: true, status: r.status, dados, erro: null };

    const primeiroErro = dados?.errors ? (Object.values(dados.errors)[0] as string[])?.[0] : null;
    const padrao = r.status === 429
      ? 'Muitas buscas seguidas. Espere um minutinho e tente de novo.'
      : r.status === 403 ? 'Você não tem acesso a este roteiro.' : 'Não conseguimos concluir agora. Tente novamente em instantes.';
    return { ok: false, status: r.status, dados, erro: primeiroErro || dados?.mensagem || padrao };
  } catch {
    return { ok: false, status: 0, dados: null as any, erro: 'Sem conexão com o servidor. Verifique sua internet e tente de novo.' };
  }
}

export type Locacao = {
  chave: string; tipo: 'servico' | 'item_aluguel'; id: number; titulo: string; local: { id: number; nome: string } | null;
  categoria: string; descricao: string | null; foto: string | null; valor: number; valor_com_promocao: number; tem_promocao: boolean;
  unidade: string; avaliacao: number | null; lat: number; lng: number; distancia_km: number; capacidade?: number | null;
  aceita_pontos: boolean; destaque_premium: boolean; aceita_pagamento_online: boolean; nivel: number;
  flash_deal: { percentual: number; expira_em: string; vagas_restantes: number } | null;
};

export type PontoTuristico = {
  titulo: string; descricao: string | null; resumo: string | null; imagem: string | null;
  coordenadas: { lat: number; lng: number }; distancia_km: number; link: string; aviso_horario: string;
};

export type Guia = {
  local: null | {
    titulo: string; subtitulo: string | null; descricao: string | null; resumo: string | null; imagem: string | null;
    coordenadas: { lat: number; lng: number } | null; dados: { populacao?: number; area_km2?: number; altitude_m?: number; estado?: string };
    infos_uteis: { secao: string; texto: string; link: string }[]; fonte: string; link: string;
  };
  centro: { lat: number; lng: number };
  pontos_turisticos: PontoTuristico[];
  locacoes_proximas: Record<string, { rotulo: string; itens: Locacao[] }>;
  raio_km: number;
  mensagem: string | null;
};

export type ItemRoteiro = {
  _k?: string; id?: number; tipo: 'ponto_turistico' | 'locacao' | 'anotacao'; periodo: Periodo; hora: string | null;
  titulo: string; descricao?: string | null; categoria?: string | null; latitude: number | null; longitude: number | null;
  link?: string | null; imagem?: string | null; servico_id?: number | null; item_aluguel_id?: number | null;
  custo_estimado: number; anotacao?: string | null;
  numero?: number | null; distancia_km?: number | null; minutos?: number | null; modo?: 'a_pe' | 'carro' | null; aviso_horario?: string | null;
  locacao?: { tipo: string; id: number; foto: string | null; disponivel: boolean; horario_a_combinar?: boolean } | null;
};

export type Periodo = 'manha' | 'tarde' | 'noite';
export const PERIODOS: [Periodo, string, string][] = [['manha', 'Manhã', '☀️'], ['tarde', 'Tarde', '🌤️'], ['noite', 'Noite', '🌙']];

export type DiaRoteiro = { numero: number; data: string; periodos: Record<Periodo, ItemRoteiro[]>; custo: number };

export type RoteiroDados = {
  id: number | null; titulo: string; destino: string; estado: string | null; latitude: number; longitude: number;
  data_inicio: string; data_fim: string; pessoas: number; orcamento: number | null; interesses: string[];
  partida: 'centro' | 'hospedagem' | 'localizacao'; partida_latitude: number | null; partida_longitude: number | null;
  compartilhado?: boolean; link_compartilhamento?: string | null;
};

export type TelaRoteiro = {
  roteiro: RoteiroDados; dias: DiaRoteiro[];
  resumo: { total: number; por_pessoa: number; orcamento: number | null; passou_orcamento: boolean; diferenca: number | null; locacoes: number };
  avisos: string[]; sugestoes_flash?: Locacao[]; guia?: { titulo: string; imagem: string | null; fonte: string; link: string } | null;
};

export const INTERESSES: [string, string, string][] = [
  ['praia', 'Praia', '🏖️'], ['natureza', 'Natureza', '🌿'], ['gastronomia', 'Gastronomia', '🍽️'], ['cultura', 'Cultura', '🏛️'],
  ['aventura', 'Aventura', '🧗'], ['compras', 'Compras', '🛍️'], ['vida_noturna', 'Vida noturna', '🌙'], ['pet', 'Viagem com pet', '🐾'],
];

export const CATEGORIAS: Record<string, { rotulo: string; icone: string; cor: string; bg: string }> = {
  hospedagem: { rotulo: 'Hospedagem', icone: 'bed-outline', cor: '#4338CA', bg: '#EEF2FF' },
  restaurantes: { rotulo: 'Restaurantes', icone: 'restaurant-outline', cor: '#BE123C', bg: '#FFE4E6' },
  passeios: { rotulo: 'Passeios', icone: 'boat-outline', cor: '#047857', bg: '#D1FAE5' },
  veiculos: { rotulo: 'Veículos', icone: 'car-outline', cor: '#0369A1', bg: '#E0F2FE' },
  bem_estar: { rotulo: 'Bem-estar', icone: 'flower-outline', cor: '#A21CAF', bg: '#FAE8FF' },
  servicos: { rotulo: 'Serviços', icone: 'sparkles-outline', cor: '#B45309', bg: '#FEF3C7' },
  espacos: { rotulo: 'Espaços', icone: 'business-outline', cor: '#374151', bg: '#F3F4F6' },
  ponto_turistico: { rotulo: 'Ponto turístico', icone: 'location-outline', cor: '#C2410C', bg: '#FFEDD5' },
  anotacao: { rotulo: 'Anotação', icone: 'create-outline', cor: '#A16207', bg: '#FEF9C3' },
};

// ---------- cálculo local (mesmas regras do servidor), para a tela reagir na hora ao mover itens ----------

const LIMITE_A_PE_KM = 1.5;
export const ORDEM: Periodo[] = ['manha', 'tarde', 'noite'];

export function distanciaKm(a: { lat: number; lng: number } | null, b: { lat: number; lng: number } | null): number | null {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export const minutos = (km: number) => (km <= LIMITE_A_PE_KM ? Math.max(1, Math.round((km / 4.5) * 60)) : Math.max(5, Math.round(((km * 1.3) / 30) * 60 + 5)));

let contador = 0;
export const novaChave = () => `k${Date.now().toString(36)}${(contador++).toString(36)}`;

export const comChaves = (dias: DiaRoteiro[]): DiaRoteiro[] => dias.map((d) => ({
  ...d,
  periodos: Object.fromEntries(ORDEM.map((p) => [p, (d.periodos[p] || []).map((i) => ({ ...i, _k: i._k || novaChave() }))])) as Record<Periodo, ItemRoteiro[]>,
}));

const ehFixo = (i: ItemRoteiro) => i.tipo === 'locacao' && ['hospedagem', 'veiculos'].includes(i.categoria || '');

export function recalcular(r: RoteiroDados, dias: DiaRoteiro[]) {
  const base = r.partida_latitude != null ? { lat: Number(r.partida_latitude), lng: Number(r.partida_longitude) } : { lat: Number(r.latitude), lng: Number(r.longitude) };
  const todos = dias.flatMap((d) => ORDEM.flatMap((p) => d.periodos[p]));
  const totalDias = Math.max(1, dias.length);
  const noites = Math.max(1, totalDias - 1);
  const hosp = todos.find((i) => i.tipo === 'locacao' && i.categoria === 'hospedagem' && i.latitude != null);
  const inicio = r.partida === 'hospedagem' && hosp ? { lat: Number(hosp.latitude), lng: Number(hosp.longitude) } : base;
  const soma = (f: (i: ItemRoteiro) => boolean) => todos.filter(f).reduce((s, i) => s + Number(i.custo_estimado || 0), 0);
  const porNoite = soma((i) => ehFixo(i) && i.categoria === 'hospedagem') / noites;
  const porDiaVeiculo = soma((i) => ehFixo(i) && i.categoria === 'veiculos') / totalDias;

  let total = 0;
  const novos = dias.map((d, idx) => {
    let pos = inicio;
    let numero = 0;
    let custo = 0;
    const periodos = {} as Record<Periodo, ItemRoteiro[]>;
    ORDEM.forEach((p) => {
      periodos[p] = d.periodos[p].map((i) => {
        let km: number | null = null;
        let num: number | null = null;
        if (i.latitude != null && i.longitude != null) {
          numero += 1;
          num = numero;
          const ponto = { lat: Number(i.latitude), lng: Number(i.longitude) };
          km = distanciaKm(pos, ponto);
          pos = ponto;
        }
        total += Number(i.custo_estimado || 0);
        if (!ehFixo(i)) custo += Number(i.custo_estimado || 0);
        return { ...i, numero: num, distancia_km: km == null ? null : Math.round(km * 10) / 10, minutos: km == null ? null : minutos(km), modo: km == null ? null : km <= LIMITE_A_PE_KM ? 'a_pe' : 'carro', aviso_horario: i.tipo === 'ponto_turistico' ? 'Confira o horário de funcionamento' : null };
      });
    });
    custo += (idx < noites ? porNoite : 0) + porDiaVeiculo;
    return { ...d, periodos, custo: Math.round(custo * 100) / 100 };
  });
  const orc = r.orcamento ? Number(r.orcamento) : null;
  return {
    dias: novos,
    resumo: { total: Math.round(total * 100) / 100, por_pessoa: Math.round((total / Math.max(1, r.pessoas)) * 100) / 100, orcamento: orc, passou_orcamento: !!orc && total > orc, diferenca: orc ? Math.round((orc - total) * 100) / 100 : null, locacoes: todos.filter((i) => i.tipo === 'locacao').length },
  };
}

export function paraSalvar(r: RoteiroDados, dias: DiaRoteiro[]) {
  const campos = ['tipo', 'hora', 'titulo', 'descricao', 'latitude', 'longitude', 'link', 'imagem', 'servico_id', 'item_aluguel_id', 'custo_estimado', 'anotacao'] as const;
  return {
    titulo: r.titulo, destino: r.destino, estado: r.estado, latitude: r.latitude, longitude: r.longitude,
    data_inicio: r.data_inicio, data_fim: r.data_fim, pessoas: r.pessoas, orcamento: r.orcamento, interesses: r.interesses, partida: r.partida,
    dias: dias.map((d) => ({ itens: ORDEM.flatMap((p) => d.periodos[p].map((i) => ({ periodo: p, ...Object.fromEntries(campos.map((c) => [c, (i as any)[c] ?? null])) }))) })),
  };
}
