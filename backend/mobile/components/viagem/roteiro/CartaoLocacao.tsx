import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { T } from '../../../constants/ClientTheme';
import { CATEGORIAS, Locacao } from '../../../services/roteirosApi';
import { brl } from '../../../services/viagensApi';

/** Cartão de uma locação do Lokyva perto do destino (Guia do Local e "Adicionar ao roteiro"). */
export default function CartaoLocacao({ l, acao, onAcao, largura = 220 }: { l: Locacao; acao: string; onAcao: () => void; largura?: number | `${number}%` }) {
  const cat = CATEGORIAS[l.categoria] || CATEGORIAS.servicos;
  return (
    <View style={[s.card, { width: largura }]}>
      <View style={s.foto}>
        {l.foto ? <Image source={{ uri: l.foto }} style={StyleSheet.absoluteFill} accessibilityIgnoresInvertColors /> : <Ionicons name={cat.icone as any} size={30} color={T.faint} />}
        <View style={s.distancia}><Text style={s.distanciaTxt}>{String(l.distancia_km).replace('.', ',')} km</Text></View>
      </View>
      <View style={{ padding: 10, flex: 1 }}>
        <View style={s.selos}>
          {l.destaque_premium && <Text style={[s.selo, { backgroundColor: '#FEF3C7', color: '#92400E' }]}>PREMIUM</Text>}
          {l.aceita_pontos && <Text style={[s.selo, { backgroundColor: '#EDE9FE', color: '#5B21B6' }]}>PONTOS</Text>}
          {!!l.flash_deal && <Text style={[s.selo, { backgroundColor: '#FEE2E2', color: '#B91C1C' }]}>⚡ -{l.flash_deal.percentual}%</Text>}
        </View>
        <Text style={s.titulo} numberOfLines={2}>{l.titulo}</Text>
        {!!l.local?.nome && <Text style={s.local} numberOfLines={1}>{l.local.nome}</Text>}
        <View style={s.rodape}>
          <View style={{ flex: 1 }}>
            {l.tem_promocao && <Text style={s.riscado}>{brl(l.valor)}</Text>}
            <Text style={s.preco}>{brl(l.valor_com_promocao)} <Text style={s.unidade}>{l.unidade}</Text></Text>
          </View>
          <TouchableOpacity style={s.botao} onPress={onAcao} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={`${acao}: ${l.titulo}`}>
            <Text style={s.botaoTxt}>{acao}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  foto: { height: 110, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  distancia: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  distanciaTxt: { fontSize: 11, fontWeight: '800', color: T.ink },
  selos: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 2 },
  selo: { fontSize: 9, fontWeight: '900', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  titulo: { fontSize: 14, fontWeight: '800', color: T.ink },
  local: { fontSize: 11, color: T.muted, marginTop: 1 },
  rodape: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 8 },
  riscado: { fontSize: 10, color: T.faint, textDecorationLine: 'line-through' },
  preco: { fontSize: 14, fontWeight: '900', color: T.ink },
  unidade: { fontSize: 10, fontWeight: '600', color: T.muted },
  botao: { backgroundColor: T.primary, borderRadius: 12, paddingHorizontal: 12, minHeight: 40, justifyContent: 'center' },
  botaoTxt: { color: '#fff', fontWeight: '900', fontSize: 12 },
});
