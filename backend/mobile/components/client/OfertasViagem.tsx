import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { T } from '../../constants/ClientTheme';
import { apiMobile } from '../../services/entregasApi';

type Oferta = {
  id: number;
  tipo: 'veiculo_pre_checkin' | 'chegada_restaurante' | 'chegada_spa' | string;
  titulo: string;
  mensagem: string;
  cidade: string | null;
  alvo_tipo: 'item_aluguel' | 'estabelecimento' | 'servico';
  alvo_id: number;
  foto: string | null;
};

const ROTULOS: Record<string, { texto: string; icone: React.ComponentProps<typeof Ionicons>['name'] }> = {
  veiculo_pre_checkin: { texto: 'Transporte', icone: 'car-sport-outline' },
  chegada_restaurante: { texto: 'Onde comer', icone: 'restaurant-outline' },
  chegada_spa: { texto: 'Relaxar', icone: 'flower-outline' },
};

// Avisa a chegada no máximo a cada 30 min: a home recarrega muitas vezes e o servidor só precisa saber de vez em quando.
const CHAVE_ULTIMO_AVISO = '@lokyva_viagem_chegada_em';
const INTERVALO_AVISO_MS = 30 * 60 * 1000;

/** Abre o destino de uma oferta de viagem (também usado pelo toque na notificação). */
export function abrirOferta(router: ReturnType<typeof useRouter>, oferta: Pick<Oferta, 'alvo_tipo' | 'alvo_id'>) {
  if (oferta.alvo_tipo === 'estabelecimento') {
    router.push({ pathname: '/src/screens/EstabelecimentoDetalhes' as never, params: { id: String(oferta.alvo_id) } });
    return;
  }
  router.push({
    pathname: '/src/screens/ExplorarDetalhes' as never,
    params: { id: String(oferta.alvo_id), tipo: oferta.alvo_tipo === 'servico' ? 'servicos' : 'reservas' },
  });
}

/**
 * "Para sua viagem": ofertas da venda cruzada (veículo antes do check-in, restaurante e spa na chegada).
 * Com a localização do cliente, avisa o servidor da chegada na cidade da hospedagem.
 */
export default function OfertasViagem({ coordenadas, cidade }: { coordenadas: { lat: number; lng: number } | null; cidade: string | null }) {
  const router = useRouter();
  const [ofertas, setOfertas] = useState<Oferta[]>([]);

  const carregar = useCallback(async () => {
    try {
      const { ok, data } = await apiMobile<{ ofertas: Oferta[] }>('/ofertas-viagem');
      if (ok) setOfertas(data.ofertas || []);
    } catch {
      // sem ofertas, sem card
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    if (!coordenadas) return;
    (async () => {
      try {
        const ultimo = Number((await AsyncStorage.getItem(CHAVE_ULTIMO_AVISO)) || 0);
        if (Date.now() - ultimo < INTERVALO_AVISO_MS) return;
        await AsyncStorage.setItem(CHAVE_ULTIMO_AVISO, String(Date.now()));

        const { ok, data } = await apiMobile<{ ofertas: Oferta[] }>('/viagem/chegada', {
          method: 'POST',
          json: { latitude: coordenadas.lat, longitude: coordenadas.lng, cidade },
        });
        if (ok) setOfertas(data.ofertas || []);
      } catch {
        // tenta de novo na próxima vez
      }
    })();
  }, [coordenadas, cidade]);

  const abrir = (oferta: Oferta) => {
    apiMobile(`/ofertas-viagem/${oferta.id}/clique`, { method: 'POST' }).catch(() => {});
    abrirOferta(router, oferta);
  };

  if (ofertas.length === 0) return null;

  return (
    <View style={s.secao}>
      <View style={s.topo}>
        <Ionicons name="airplane" size={18} color={T.primary} />
        <Text style={s.titulo}>Para sua viagem{ofertas[0]?.cidade ? ` em ${ofertas[0].cidade}` : ''}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
        {ofertas.map((oferta) => {
          const rotulo = ROTULOS[oferta.tipo] || { texto: 'Sugestão', icone: 'sparkles-outline' as const };
          return (
            <TouchableOpacity key={oferta.id} style={s.card} onPress={() => abrir(oferta)} activeOpacity={0.85}>
              {oferta.foto ? (
                <Image source={{ uri: oferta.foto }} style={s.foto} contentFit="cover" />
              ) : (
                <View style={[s.foto, s.fotoVazia]}><Ionicons name={rotulo.icone} size={32} color={T.primary} /></View>
              )}
              <View style={s.corpo}>
                <View style={s.pilula}>
                  <Ionicons name={rotulo.icone} size={12} color={T.tag} />
                  <Text style={s.pilulaTxt}>{rotulo.texto}</Text>
                </View>
                <Text style={s.cardTitulo} numberOfLines={1}>{oferta.titulo}</Text>
                <Text style={s.cardMsg} numberOfLines={3}>{oferta.mensagem}</Text>
                <Text style={s.ver}>Ver oferta</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  secao: { marginTop: 8, marginBottom: 12 },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, marginBottom: 10 },
  titulo: { fontSize: 18, fontWeight: '800', color: T.ink, letterSpacing: -0.4 },
  card: { width: 260, backgroundColor: T.card, borderRadius: 16, borderWidth: 1, borderColor: T.line, overflow: 'hidden' },
  foto: { width: '100%', height: 110 },
  fotoVazia: { backgroundColor: T.primarySoft, alignItems: 'center', justifyContent: 'center' },
  corpo: { padding: 12, gap: 4 },
  pilula: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: T.primarySoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  pilulaTxt: { fontSize: 11, fontWeight: '700', color: T.tag },
  cardTitulo: { fontSize: 15, fontWeight: '800', color: T.ink },
  cardMsg: { fontSize: 13, color: T.muted, lineHeight: 18 },
  ver: { marginTop: 4, fontSize: 13, fontWeight: '800', color: T.primary },
});
