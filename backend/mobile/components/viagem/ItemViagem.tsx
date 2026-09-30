import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { T } from '../../constants/ClientTheme';
import { TIPOS, STATUS_ITEM, PRESENCA, brl, hora } from '../../services/viagensApi';

export type ItemRoteiro = {
  id?: number; tipo: string; titulo: string; descricao?: string | null; endereco?: string | null;
  dia: string | null; data_fim: string | null; ordem: number; hora_inicio: string | null; hora_fim: string | null;
  custo_estimado: number; deslocamento_min?: number | null; distancia_km?: number | null;
  destaque_premium?: boolean; status?: string; servico_id?: number | null; item_aluguel_id?: number | null; estabelecimento_id?: number | null;
  reserva?: { por?: string; quando?: string; codigo?: string } | null;
  presencas?: { usuario_id: number; nome: string; status: string }[]; minha_presenca?: string | null;
};

type Props = {
  item: ItemRoteiro;
  euId?: number;
  previa?: boolean;
  onPresenca?: (item: ItemRoteiro, status: string) => void;
  onRemover?: (item: ItemRoteiro) => void;
};

/** Cartão de um item do roteiro (linha do tempo). */
export default function ItemViagem({ item, euId, previa, onPresenca, onRemover }: Props) {
  const router = useRouter();
  const tipo = TIPOS[item.tipo] || TIPOS.personalizado;
  const status = STATUS_ITEM[item.status || 'sugerido'] || STATUS_ITEM.sugerido;
  const vao = (item.presencas || []).filter((p) => p.status === 'confirmado').map((p) => (p.usuario_id === euId ? 'Você' : p.nome.split(' ')[0]));

  const reservar = () => {
    if (item.item_aluguel_id) router.push(`/src/screens/ExplorarDetalhes?id=${item.item_aluguel_id}&tipo=reservas` as never);
    else if (item.servico_id) router.push(`/src/screens/ExplorarDetalhes?id=${item.servico_id}` as never);
  };

  return (
    <View style={s.linha}>
      <View style={s.trilho}>
        <View style={[s.icone, { backgroundColor: tipo.bg }]}><Ionicons name={tipo.icone} size={20} color={tipo.cor} /></View>
        <View style={s.fio} />
      </View>

      <View style={{ flex: 1, paddingBottom: 16 }}>
        {item.deslocamento_min != null && (
          <View style={s.desloc}>
            <Ionicons name="arrow-forward" size={11} color={T.faint} />
            <Text style={s.deslocTxt}> {item.deslocamento_min} min de deslocamento{item.distancia_km != null ? ` · ${String(item.distancia_km).replace('.', ',')} km` : ''}</Text>
          </View>
        )}

        <View style={s.card}>
          <View style={s.topo}>
            <View style={{ flex: 1 }}>
              <Text style={s.tipoTxt}>
                {tipo.nome}
                {item.hora_inicio ? ` · ${hora(item.hora_inicio)}${item.hora_fim && item.tipo !== 'hospedagem' ? `–${hora(item.hora_fim)}` : ''}` : ''}
              </Text>
              <Text style={s.titulo}>{item.titulo}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              {item.custo_estimado > 0 && <Text style={s.preco}>{brl(item.custo_estimado)}</Text>}
              {!previa && <View style={[s.selo, { backgroundColor: status.bg }]}><Text style={[s.seloTxt, { color: status.cor }]}>{status.texto}</Text></View>}
            </View>
          </View>

          {item.destaque_premium && (
            <View style={s.premium}><Ionicons name="star" size={11} color="#B45309" /><Text style={s.premiumTxt}> Recomendado Premium</Text></View>
          )}
          {!!item.descricao && <Text style={s.desc} numberOfLines={2}>{item.descricao}</Text>}
          {!!item.endereco && <Text style={s.end}>{item.endereco}</Text>}

          {!!item.reserva && (
            <View style={s.reserva}><Text style={s.reservaTxt}><Text style={{ fontWeight: '800' }}>{item.reserva.por}</Text> reservou · {item.reserva.quando}{item.reserva.codigo ? ` · cód. ${item.reserva.codigo}` : ''}</Text></View>
          )}

          {!previa && !!onPresenca && (
            <View style={s.presencas}>
              {(['confirmado', 'talvez', 'recusado'] as const).map((st) => {
                const ativo = item.minha_presenca === st;
                return (
                  <TouchableOpacity key={st} onPress={() => onPresenca(item, st)} activeOpacity={0.8}
                    style={[s.chip, ativo && { backgroundColor: PRESENCA[st].bg, borderColor: PRESENCA[st].cor }]}>
                    <Text style={[s.chipTxt, ativo && { color: PRESENCA[st].cor }]}>{PRESENCA[st].texto}</Text>
                  </TouchableOpacity>
                );
              })}
              {vao.length > 0 && <Text style={s.quemVai}>{vao.join(', ')} vai</Text>}
            </View>
          )}

          <View style={s.acoes}>
            {!previa && !item.reserva && (item.item_aluguel_id || item.servico_id) && (
              <TouchableOpacity onPress={reservar}><Text style={s.acaoPrimaria}>Reservar</Text></TouchableOpacity>
            )}
            {!!onRemover && <TouchableOpacity onPress={() => onRemover(item)} style={{ marginLeft: 'auto' }}><Text style={s.acaoRemover}>Remover</Text></TouchableOpacity>}
          </View>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  linha: { flexDirection: 'row', gap: 12 },
  trilho: { alignItems: 'center' },
  icone: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  fio: { flex: 1, width: 1, backgroundColor: T.line, marginTop: 4 },
  desloc: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  deslocTxt: { fontSize: 11, color: T.faint },
  card: { backgroundColor: T.card, borderRadius: 20, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  topo: { flexDirection: 'row', gap: 10 },
  tipoTxt: { fontSize: 10, fontWeight: '800', color: T.faint, textTransform: 'uppercase', letterSpacing: 0.4 },
  titulo: { fontSize: 15, fontWeight: '800', color: T.ink, marginTop: 1 },
  preco: { fontSize: 14, fontWeight: '800', color: T.ink },
  selo: { marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  seloTxt: { fontSize: 10, fontWeight: '800' },
  premium: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 8, backgroundColor: '#FEF3C7', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  premiumTxt: { fontSize: 11, fontWeight: '700', color: '#B45309' },
  desc: { fontSize: 13, color: T.muted, marginTop: 8, lineHeight: 18 },
  end: { fontSize: 11, color: T.faint, marginTop: 4 },
  reserva: { marginTop: 10, backgroundColor: T.cream, borderRadius: 10, padding: 8 },
  reservaTxt: { fontSize: 12, color: T.muted },
  presencas: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, borderWidth: 1, borderColor: T.line, backgroundColor: '#fff' },
  chipTxt: { fontSize: 12, fontWeight: '700', color: T.faint },
  quemVai: { fontSize: 11, color: T.faint, marginLeft: 4 },
  acoes: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  acaoPrimaria: { fontSize: 13, fontWeight: '800', color: T.primary },
  acaoRemover: { fontSize: 12, fontWeight: '700', color: T.faint },
});
