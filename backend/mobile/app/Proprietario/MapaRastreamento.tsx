import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Mapbox, { MapView, Camera, MarkerView, ShapeSource, LineLayer } from '@rnmapbox/maps';
import { obterEcho } from '../../services/echo';

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '');

const COLORS = {
  primary: '#FF5A00',
  primaryLight: '#FFF0E6',
  secondary: '#111827',
  gray: '#6B7280',
  lightGray: '#F9FAFB',
  white: '#FFFFFF',
  border: '#E5E7EB',
  green: '#10B981',
};

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';

interface AgendamentoAtivo {
  id: number;
  status: string;
  hora_agendamento: string;
  usuario: { name: string; foto_perfil?: string | null };
  estabelecimento: { id: number; nome: string; latitude: number | null; longitude: number | null };
  servico: string | null;
}

interface Coordenada {
  latitude: number;
  longitude: number;
}

async function pegarToken() {
  return (await AsyncStorage.getItem('@lokyva_token')) || (await AsyncStorage.getItem('@waitless_token'));
}

function calcularDistanciaKm(a: Coordenada, b: Coordenada) {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

export default function MapaRastreamento() {
  const router = useRouter();
  const cameraRef = useRef<Camera | null>(null);

  const [agendamentos, setAgendamentos] = useState<AgendamentoAtivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecionado, setSelecionado] = useState<AgendamentoAtivo | null>(null);
  const [posicaoCliente, setPosicaoCliente] = useState<Coordenada | null>(null);
  const [statusConexao, setStatusConexao] = useState('');
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);

  const carregarAgendamentos = useCallback(async () => {
    setLoading(true);
    try {
      const token = await pegarToken();
      const res = await fetch(`${API_URL}/proprietario/rastreamento`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const json = await res.json();
      setAgendamentos(json.agendamentos_ativos || []);
    } catch (e) {
      console.log('Erro ao carregar agendamentos ativos');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregarAgendamentos();
    }, [carregarAgendamentos])
  );

  useEffect(() => {
    if (!selecionado) return undefined;

    setPosicaoCliente(null);
    setUltimaAtualizacao(null);
    setStatusConexao(`Aguardando sinal GPS de ${selecionado.usuario.name}...`);

    const canalNome = `rastreamento.${selecionado.id}`;
    let cancelado = false;

    obterEcho().then((echo) => {
      if (cancelado) return;

      echo
        .private(canalNome)
        .listen('.client.moved', (dados: { latitude: number; longitude: number }) => {
          const novaPosicao = { latitude: dados.latitude, longitude: dados.longitude };
          setPosicaoCliente(novaPosicao);
          setStatusConexao('Sinal GPS ativo — cliente se movendo');
          setUltimaAtualizacao(new Date());

          if (selecionado.estabelecimento.latitude && selecionado.estabelecimento.longitude) {
            const lats = [novaPosicao.latitude, selecionado.estabelecimento.latitude];
            const lngs = [novaPosicao.longitude, selecionado.estabelecimento.longitude];
            cameraRef.current?.fitBounds(
              [Math.max(...lngs), Math.max(...lats)],
              [Math.min(...lngs), Math.min(...lats)],
              80,
              800
            );
          }
        })
        .error(() => {
          setStatusConexao('Erro ao conectar ao rastreamento.');
        });
    });

    return () => {
      cancelado = true;
      obterEcho().then((echo) => echo.leave(canalNome));
    };
  }, [selecionado]);

  const coordEstabelecimento: Coordenada | null =
    selecionado?.estabelecimento.latitude && selecionado?.estabelecimento.longitude
      ? { latitude: selecionado.estabelecimento.latitude, longitude: selecionado.estabelecimento.longitude }
      : null;

  const distanciaKm = posicaoCliente && coordEstabelecimento ? calcularDistanciaKm(posicaoCliente, coordEstabelecimento) : null;
  const etaMinutos = distanciaKm !== null ? Math.max(1, Math.round((distanciaKm / 25) * 60)) : null; // estimativa a 25km/h

  const linhaRota =
    posicaoCliente && coordEstabelecimento
      ? {
          type: 'Feature' as const,
          properties: {},
          geometry: {
            type: 'LineString' as const,
            coordinates: [
              [posicaoCliente.longitude, posicaoCliente.latitude],
              [coordEstabelecimento.longitude, coordEstabelecimento.latitude],
            ],
          },
        }
      : null;

  const renderChip = ({ item }: { item: AgendamentoAtivo }) => {
    const ativo = selecionado?.id === item.id;
    return (
      <TouchableOpacity
        style={[styles.chip, ativo && styles.chipAtivo]}
        onPress={() => setSelecionado(item)}
      >
        {item.usuario.foto_perfil ? (
          <Image source={{ uri: item.usuario.foto_perfil }} style={styles.chipAvatar} />
        ) : (
          <View style={styles.chipAvatarFallback}>
            <Text style={styles.chipAvatarTexto}>{(item.usuario.name || '?').charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View>
          <Text style={[styles.chipNome, ativo && styles.chipNomeAtivo]} numberOfLines={1}>{item.usuario.name}</Text>
          <Text style={[styles.chipHorario, ativo && styles.chipNomeAtivo]}>{item.hora_agendamento?.slice(0, 5)} · {item.servico}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rastreamento em tempo real</Text>
        <View style={styles.headerBtn} />
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : agendamentos.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="navigate-circle-outline" size={56} color={COLORS.gray} />
          <Text style={styles.emptyTitle}>Nenhum atendimento ativo hoje</Text>
          <Text style={styles.emptyDesc}>
            Assim que um cliente tiver um agendamento confirmado para hoje, ele aparecerá aqui para você acompanhar a chegada em tempo real.
          </Text>
        </View>
      ) : (
        <>
          <FlatList
            data={agendamentos}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderChip}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.listaChips}
          />

          {selecionado && coordEstabelecimento ? (
            <>
              <MapView style={styles.map} styleURL={Mapbox.StyleURL.Street}>
                <Camera
                  ref={cameraRef}
                  defaultSettings={{
                    centerCoordinate: [coordEstabelecimento.longitude, coordEstabelecimento.latitude],
                    zoomLevel: 14,
                  }}
                />

                <MarkerView coordinate={[coordEstabelecimento.longitude, coordEstabelecimento.latitude]}>
                  <View style={styles.marcadorLoja}>
                    <Ionicons name="storefront" size={16} color={COLORS.white} />
                  </View>
                </MarkerView>

                {posicaoCliente && (
                  <MarkerView coordinate={[posicaoCliente.longitude, posicaoCliente.latitude]}>
                    <View style={styles.marcadorCliente}>
                      <Ionicons name="navigate" size={16} color={COLORS.white} />
                    </View>
                  </MarkerView>
                )}

                {linhaRota && (
                  <ShapeSource id="rota-cliente" shape={linhaRota}>
                    <LineLayer id="linha-rota" style={{ lineColor: COLORS.primary, lineWidth: 3, lineDasharray: [1, 1.5] }} />
                  </ShapeSource>
                )}
              </MapView>

              <View style={styles.painelStatus}>
                <View style={styles.statusRow}>
                  <View style={[styles.dot, { backgroundColor: posicaoCliente ? COLORS.green : COLORS.gray }]} />
                  <Text style={styles.statusTexto} numberOfLines={1}>{statusConexao}</Text>
                </View>

                {distanciaKm !== null && (
                  <View style={styles.metricasRow}>
                    <View style={styles.metricaBox}>
                      <Text style={styles.metricaValor}>{distanciaKm.toFixed(1)} km</Text>
                      <Text style={styles.metricaLabel}>Distância</Text>
                    </View>
                    <View style={styles.metricaBox}>
                      <Text style={styles.metricaValor}>~{etaMinutos} min</Text>
                      <Text style={styles.metricaLabel}>Chegada estimada</Text>
                    </View>
                    {ultimaAtualizacao && (
                      <View style={styles.metricaBox}>
                        <Text style={styles.metricaValor}>{ultimaAtualizacao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</Text>
                        <Text style={styles.metricaLabel}>Última atualização</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </>
          ) : (
            <View style={styles.selecioneContainer}>
              <Ionicons name="hand-left-outline" size={40} color={COLORS.gray} />
              <Text style={styles.selecioneTexto}>Selecione um cliente acima para começar a rastrear</Text>
            </View>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white, paddingTop: Platform.OS === 'android' ? 25 : 0 },
  headerBar: {
    height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerBtn: { padding: 6, width: 34 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.secondary },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: COLORS.secondary, marginTop: 16, textAlign: 'center' },
  emptyDesc: { fontSize: 13, color: COLORS.gray, textAlign: 'center', marginTop: 8, lineHeight: 19 },

  listaChips: { paddingHorizontal: 12, paddingVertical: 12, gap: 10 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.lightGray,
    borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12, marginRight: 10, maxWidth: 220,
    borderWidth: 1, borderColor: COLORS.border,
  },
  chipAtivo: { backgroundColor: COLORS.secondary, borderColor: COLORS.secondary },
  chipAvatar: { width: 32, height: 32, borderRadius: 16 },
  chipAvatarFallback: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  chipAvatarTexto: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  chipNome: { fontSize: 12, fontWeight: '700', color: COLORS.secondary },
  chipNomeAtivo: { color: COLORS.white },
  chipHorario: { fontSize: 10, color: COLORS.gray, marginTop: 1 },

  map: { flex: 1 },
  marcadorLoja: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.secondary,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.white,
  },
  marcadorCliente: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.white,
  },

  painelStatus: {
    position: 'absolute', bottom: 16, left: 12, right: 12, backgroundColor: COLORS.white,
    borderRadius: 18, padding: 14, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusTexto: { fontSize: 12, fontWeight: '700', color: COLORS.secondary, flex: 1 },
  metricasRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10 },
  metricaBox: { alignItems: 'center', flex: 1 },
  metricaValor: { fontSize: 14, fontWeight: '800', color: COLORS.secondary },
  metricaLabel: { fontSize: 10, color: COLORS.gray, marginTop: 2, textAlign: 'center' },

  selecioneContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  selecioneTexto: { fontSize: 13, color: COLORS.gray, textAlign: 'center', marginTop: 12 },
});
