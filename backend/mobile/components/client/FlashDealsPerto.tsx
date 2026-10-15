import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { T } from '../../constants/ClientTheme';
import { apiMobile, brl } from '../../services/entregasApi';

type Deal = {
  id: number;
  alvo_tipo: 'item_aluguel' | 'servico';
  alvo_id: number;
  nome: string;
  percentual: number;
  valor_original: number;
  valor_com_desconto: number;
  restantes: number;
  cidade: string | null;
  expira_em: string;
  distancia_km: number | null;
  foto: string | null;
};

function Contagem({ ate, aoAcabar }: { ate: string; aoAcabar: () => void }) {
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = new Date(ate).getTime() - agora;
  useEffect(() => { if (ms <= 0) aoAcabar(); }, [ms <= 0]); // eslint-disable-line react-hooks/exhaustive-deps
  const resto = Math.max(0, ms);
  const h = Math.floor(resto / 3600000);
  const m = Math.floor((resto % 3600000) / 60000);
  const sec = Math.floor((resto % 60000) / 1000);
  return <Text style={s.contagem}>{h > 0 ? `${h}:` : ''}{String(m).padStart(2, '0')}:{String(sec).padStart(2, '0')}</Text>;
}

/** "Ofertas relâmpago perto de você": Flash Deals ativos na cidade do cliente, com contagem regressiva. */
export default function FlashDealsPerto({ coordenadas, cidade }: { coordenadas: { lat: number; lng: number } | null; cidade: string | null }) {
  const router = useRouter();
  const [deals, setDeals] = useState<Deal[]>([]);

  const carregar = useCallback(async () => {
    try {
      const qs = coordenadas
        ? `?latitude=${coordenadas.lat}&longitude=${coordenadas.lng}${cidade ? `&cidade=${encodeURIComponent(cidade)}` : ''}`
        : '';
      const { ok, data } = await apiMobile<{ deals: Deal[] }>(`/flash-deals/perto${qs}`);
      if (ok) setDeals(data.deals || []);
    } catch {
      // sem deals, sem card
    }
  }, [coordenadas, cidade]);

  useEffect(() => { carregar(); }, [carregar]);
  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  const abrir = (deal: Deal) => {
    apiMobile(`/flash-deals/${deal.id}/clique`, { method: 'POST' }).catch(() => {});
    router.push({
      pathname: '/src/screens/ExplorarDetalhes' as never,
      params: { id: String(deal.alvo_id), tipo: deal.alvo_tipo === 'servico' ? 'servicos' : 'reservas' },
    });
  };

  const remover = (id: number) => setDeals((lista) => lista.filter((d) => d.id !== id));

  if (deals.length === 0) return null;

  return (
    <View style={s.secao}>
      <View style={s.topo}>
        <View style={s.raio}><Ionicons name="flash" size={16} color="#fff" /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.titulo}>Ofertas relâmpago perto de você</Text>
          <Text style={s.sub}>Descontos que acabam em poucas horas. Corra!</Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
        {deals.map((d) => (
          <TouchableOpacity key={d.id} style={s.card} onPress={() => abrir(d)} activeOpacity={0.85}>
            <View>
              {d.foto ? (
                <Image source={{ uri: d.foto }} style={s.foto} contentFit="cover" />
              ) : (
                <View style={[s.foto, s.fotoVazia]}><Ionicons name="flash-outline" size={34} color={T.primary} /></View>
              )}
              <View style={s.selo}><Text style={s.seloTxt}>-{d.percentual}%</Text></View>
              <View style={s.tempo}>
                <Ionicons name="time-outline" size={12} color="#fff" />
                <Contagem ate={d.expira_em} aoAcabar={() => remover(d.id)} />
              </View>
            </View>
            <View style={s.corpo}>
              <Text style={s.nome} numberOfLines={1}>{d.nome}</Text>
              <Text style={s.local} numberOfLines={1}>
                {[d.cidade, d.distancia_km !== null ? `${d.distancia_km.toString().replace('.', ',')} km` : null].filter(Boolean).join(' · ')}
              </Text>
              <View style={s.precos}>
                <Text style={s.antigo}>{brl(d.valor_original)}</Text>
                <Text style={s.novo}>{brl(d.valor_com_desconto)}</Text>
              </View>
              <Text style={s.restam}>{d.restantes === 1 ? 'Última vaga!' : `Restam ${d.restantes} vagas`}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  secao: { marginTop: 8, marginBottom: 12 },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, marginBottom: 10 },
  raio: { width: 30, height: 30, borderRadius: 10, backgroundColor: T.primary, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 18, fontWeight: '800', color: T.ink, letterSpacing: -0.4 },
  sub: { fontSize: 12, color: T.muted },
  card: { width: 220, backgroundColor: T.card, borderRadius: 16, borderWidth: 1.5, borderColor: T.primary, overflow: 'hidden' },
  foto: { width: '100%', height: 120 },
  fotoVazia: { backgroundColor: T.primarySoft, alignItems: 'center', justifyContent: 'center' },
  selo: { position: 'absolute', top: 8, left: 8, backgroundColor: T.danger, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  seloTxt: { color: '#fff', fontWeight: '900', fontSize: 13 },
  tempo: { position: 'absolute', bottom: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  contagem: { color: '#fff', fontWeight: '800', fontSize: 12, fontVariant: ['tabular-nums'] },
  corpo: { padding: 12, gap: 2 },
  nome: { fontSize: 15, fontWeight: '800', color: T.ink },
  local: { fontSize: 12, color: T.muted },
  precos: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 },
  antigo: { fontSize: 12, color: T.faint, textDecorationLine: 'line-through' },
  novo: { fontSize: 17, fontWeight: '900', color: T.primary },
  restam: { fontSize: 12, fontWeight: '700', color: T.danger, marginTop: 2 },
});
