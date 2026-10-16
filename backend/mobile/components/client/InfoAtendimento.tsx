import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { T } from '../../constants/ClientTheme';

export type Atendimento = {
  modalidade: string; modalidade_rotulo: string; atende_24h: boolean; raio_atendimento_km: number | null;
  taxa_deslocamento: number | null; tempo_chegada_minutos: number | null; tipo_preco: string; tipo_preco_rotulo: string;
  preco_prefixo: string | null; preco_sufixo: string | null; sob_orcamento: boolean; o_que_inclui: string | null;
  como_se_preparar: string | null; garantia_dias: number | null; exige_endereco: boolean; pede_endereco: boolean;
  selos: { id: string; texto: string; icone: string }[];
};

const brl = (v: number) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;
const ICONES: Record<string, string> = { '24h': 'time', domicilio: 'navigate', online: 'videocam', chegada: 'flash', garantia: 'shield-checkmark' };

/** Taxa de deslocamento que entra no total (mesma regra do servidor). */
export function taxaDoAtendimento(a: Atendimento | null | undefined, endereco: string): number {
  if (!a?.taxa_deslocamento) return 0;
  if (a.modalidade === 'a_domicilio') return Number(a.taxa_deslocamento);
  if (a.modalidade === 'ambos' && endereco.trim()) return Number(a.taxa_deslocamento);
  return 0;
}

/** Selos curtos: "Atende 24h", "Vai até você", "Chega em ~40 min"... */
export function SelosAtendimento({ atendimento, max = 3, style }: { atendimento?: Atendimento | null; max?: number; style?: any }) {
  const selos = atendimento?.selos || [];
  if (!selos.length) return null;
  return (
    <View style={[s.selos, style]}>
      {selos.slice(0, max).map((sl) => (
        <View key={sl.id} style={[s.selo, sl.id === '24h' && { backgroundColor: '#FEF2F2' }]}>
          <Ionicons name={(ICONES[sl.id] || 'checkmark-circle') as any} size={12} color={sl.id === '24h' ? '#B91C1C' : '#C2410C'} />
          <Text style={[s.seloTxt, sl.id === '24h' && { color: '#B91C1C' }]}>{sl.texto}</Text>
        </View>
      ))}
    </View>
  );
}

/** Bloco "Como funciona o atendimento" (detalhes do serviço). */
export default function InfoAtendimento({ atendimento }: { atendimento?: Atendimento | null }) {
  if (!atendimento) return null;
  const temAlgo = atendimento.modalidade !== 'no_local' || atendimento.atende_24h || atendimento.tipo_preco !== 'fixo'
    || atendimento.o_que_inclui || atendimento.como_se_preparar || atendimento.garantia_dias;
  if (!temAlgo) return null;

  const linhas = [
    ['Atendimento', atendimento.modalidade_rotulo],
    atendimento.raio_atendimento_km ? ['Raio de atendimento', `até ${atendimento.raio_atendimento_km} km`] : null,
    atendimento.taxa_deslocamento ? ['Taxa de deslocamento', brl(atendimento.taxa_deslocamento)] : null,
    atendimento.tempo_chegada_minutos ? ['Tempo médio de chegada', `${atendimento.tempo_chegada_minutos} min`] : null,
    atendimento.tipo_preco !== 'fixo' ? ['Cobrança', atendimento.tipo_preco_rotulo] : null,
    atendimento.garantia_dias ? ['Garantia', `${atendimento.garantia_dias} dias`] : null,
  ].filter(Boolean) as string[][];

  return (
    <View style={s.caixa}>
      <Text style={s.titulo}>Como funciona o atendimento</Text>
      <SelosAtendimento atendimento={atendimento} max={5} style={{ marginTop: 8 }} />
      {linhas.map(([r, v]) => (
        <View key={r} style={s.linha}>
          <Text style={s.rot}>{r}</Text>
          <Text style={s.val}>{v}</Text>
        </View>
      ))}
      {!!atendimento.o_que_inclui && (
        <>
          <Text style={s.sub}><Ionicons name="checkmark-circle" size={14} color="#16A34A" /> O que está incluído</Text>
          <Text style={s.texto}>{atendimento.o_que_inclui}</Text>
        </>
      )}
      {!!atendimento.como_se_preparar && (
        <>
          <Text style={s.sub}><Ionicons name="clipboard-outline" size={14} color={T.primary} /> Como se preparar</Text>
          <Text style={s.texto}>{atendimento.como_se_preparar}</Text>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  selos: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  selo: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF4EA', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  seloTxt: { fontSize: 11, fontWeight: '800', color: '#C2410C' },
  caixa: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#FFE4CC', padding: 14, marginTop: 16 },
  titulo: { fontSize: 16, fontWeight: '900', color: T.ink },
  linha: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#F4F4F6' },
  rot: { fontSize: 13, color: T.muted },
  val: { fontSize: 13, fontWeight: '800', color: T.ink, flexShrink: 1, textAlign: 'right' },
  sub: { fontSize: 13, fontWeight: '800', color: T.ink, marginTop: 12 },
  texto: { fontSize: 13, color: T.muted, lineHeight: 19, marginTop: 3 },
});
