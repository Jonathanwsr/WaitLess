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
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Mapbox, { MapView, Camera, MarkerView, ShapeSource, LineLayer } from '../../services/mapboxSeguro';
import { obterEcho } from '../../services/echo';
import { api } from '../../components/owner/ui';
import PremiumGate from '../../components/owner/PremiumGate';

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '';

const COLORS = {
  primary: '#282828',
  primaryLight: '#F0F0F2',
  secondary: '#282828',
  gray: '#6A6C72',
  lightGray: '#F5F5F5',
  white: '#FFFFFF',
  border: '#E6E7E9',
  green: '#00A868',
};

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';

// A cada quantos ms a rota real (Mapbox Directions) é recalculada — não a
// cada ping de GPS (a cada ~4s), pra não estourar cota da API.
const INTERVALO_RECALCULO_ROTA_MS = 15000;
// Duração da animação de "deslizar" o marcador de uma posição pra outra.
const DURACAO_ANIMACAO_MS = 1800;
// Distância (metros) abaixo da qual consideramos que o cliente chegou.
const DISTANCIA_CHEGADA_M = 60;

interface AgendamentoAtivo {
  id: number;
  status: string;
  hora_agendamento: string;
  usuario: { name: string; foto_perfil?: string | null };
  estabelecimento: { id: number; nome: string; latitude: number | null; longitude: number | null };
  servico: string | null;
  ultima_localizacao?: {
    latitude: number;
    longitude: number;
    heading: number | null;
    velocidade: number | null;
    atualizado_em: string;
  } | null;
}

interface Coordenada {
  latitude: number;
  longitude: number;
}

interface Rota {
  distanciaKm: number;
  duracaoMin: number;
  geometria: any;
}

async function pegarToken() {
  return (await AsyncStorage.getItem('@lokyva_token')) || (await AsyncStorage.getItem('@waitless_token'));
}

function calcularDistanciaMetros(a: Coordenada, b: Coordenada) {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

function calcularBearing(a: Coordenada, b: Coordenada) {
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

async function buscarRotaReal(origem: Coordenada, destino: Coordenada): Promise<Rota | null> {
  if (!MAPBOX_TOKEN) return null;
  try {
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${origem.longitude},${origem.latitude};${destino.longitude},${destino.latitude}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
    const res = await fetch(url);
    const json = await res.json();
    const rota = json?.routes?.[0];
    if (!rota) return null;

    return {
      distanciaKm: rota.distance / 1000,
      duracaoMin: Math.max(1, Math.round(rota.duration / 60)),
      geometria: rota.geometry,
    };
  } catch (e) {
    return null;
  }
}

function MapaRastreamentoConteudo() {
  const router = useRouter();
  const cameraRef = useRef<any>(null);

  const [agendamentos, setAgendamentos] = useState<AgendamentoAtivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecionado, setSelecionado] = useState<AgendamentoAtivo | null>(null);
  const [posicaoCliente, setPosicaoCliente] = useState<Coordenada | null>(null);
  const [posicaoAnimada, setPosicaoAnimada] = useState<Coordenada | null>(null);
  const [headingCliente, setHeadingCliente] = useState(0);
  const [statusConexao, setStatusConexao] = useState('');
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);
  const [rota, setRota] = useState<Rota | null>(null);
  const [chegou, setChegou] = useState(false);

  const posicaoAnimadaRef = useRef<Coordenada | null>(null);
  const posicaoAnteriorRef = useRef<Coordenada | null>(null);
  const frameRef = useRef<number | null>(null);
  const centralizouMapaRef = useRef(false);

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

  // Animação suave: desliza o marcador da posição atual até a nova posição
  // recebida (GPS ou WebSocket), estilo Uber, em vez de "pular" de um ponto
  // pro outro a cada ping.
  const animarPara = useCallback((novaPosicao: Coordenada) => {
    const origem = posicaoAnimadaRef.current || novaPosicao;

    if (posicaoAnimadaRef.current) {
      const distancia = calcularDistanciaMetros(posicaoAnimadaRef.current, novaPosicao);
      if (distancia > 2) {
        setHeadingCliente(calcularBearing(posicaoAnimadaRef.current, novaPosicao));
      }
    }
    posicaoAnteriorRef.current = origem;

    const inicio = Date.now();
    if (frameRef.current) cancelAnimationFrame(frameRef.current);

    const passo = () => {
      const t = Math.min(1, (Date.now() - inicio) / DURACAO_ANIMACAO_MS);
      const suavizado = t * (2 - t); // ease-out
      const intermediaria: Coordenada = {
        latitude: origem.latitude + (novaPosicao.latitude - origem.latitude) * suavizado,
        longitude: origem.longitude + (novaPosicao.longitude - origem.longitude) * suavizado,
      };
      posicaoAnimadaRef.current = intermediaria;
      setPosicaoAnimada(intermediaria);

      if (t < 1) {
        frameRef.current = requestAnimationFrame(passo);
      }
    };
    passo();
  }, []);

  useEffect(() => {
    if (!selecionado) return undefined;

    // Se já temos a última posição conhecida (salva no backend), mostra ela
    // imediatamente em vez de esperar o próximo ping em tempo real.
    if (selecionado.ultima_localizacao) {
      const posInicial = { latitude: selecionado.ultima_localizacao.latitude, longitude: selecionado.ultima_localizacao.longitude };
      posicaoAnimadaRef.current = posInicial;
      setPosicaoCliente(posInicial);
      setPosicaoAnimada(posInicial);
      if (selecionado.ultima_localizacao.heading !== null) {
        setHeadingCliente(selecionado.ultima_localizacao.heading);
      }
      setUltimaAtualizacao(new Date(selecionado.ultima_localizacao.atualizado_em));
      setStatusConexao('Última posição conhecida — aguardando novo sinal...');
    } else {
      setPosicaoCliente(null);
      setPosicaoAnimada(null);
      posicaoAnimadaRef.current = null;
      setUltimaAtualizacao(null);
      setStatusConexao(`Aguardando sinal GPS de ${selecionado.usuario.name}...`);
    }

    setRota(null);
    setChegou(false);
    centralizouMapaRef.current = false;

    const canalNome = `rastreamento.${selecionado.id}`;
    let cancelado = false;

    obterEcho().then((echo) => {
      if (cancelado) return;

      echo
        .private(canalNome)
        .listen('.client.moved', (dados: { latitude: number; longitude: number; heading?: number | null }) => {
          const novaPosicao = { latitude: dados.latitude, longitude: dados.longitude };
          setPosicaoCliente(novaPosicao);
          animarPara(novaPosicao);
          if (dados.heading !== null && dados.heading !== undefined) {
            setHeadingCliente(dados.heading);
          }
          setStatusConexao('Sinal GPS ativo — cliente se movendo');
          setUltimaAtualizacao(new Date());
        })
        .error(() => {
          setStatusConexao('Erro ao conectar ao rastreamento.');
        });
    });

    return () => {
      cancelado = true;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      obterEcho().then((echo) => echo.leave(canalNome));
    };
  }, [selecionado, animarPara]);

  const coordEstabelecimento: Coordenada | null =
    selecionado?.estabelecimento.latitude && selecionado?.estabelecimento.longitude
      ? { latitude: selecionado.estabelecimento.latitude, longitude: selecionado.estabelecimento.longitude }
      : null;

  // Recalcula a rota real (Mapbox Directions) periodicamente enquanto houver
  // posição do cliente — não a cada ping de GPS, só de tempos em tempos.
  useEffect(() => {
    if (!posicaoCliente || !coordEstabelecimento) return undefined;

    let cancelado = false;

    const atualizarRota = async () => {
      const resultado = await buscarRotaReal(posicaoCliente, coordEstabelecimento);
      if (cancelado || !resultado) return;
      setRota(resultado);

      const distanciaAteLoja = calcularDistanciaMetros(posicaoCliente, coordEstabelecimento);
      setChegou(distanciaAteLoja <= DISTANCIA_CHEGADA_M);

      if (!centralizouMapaRef.current) {
        centralizouMapaRef.current = true;
        const lats = [posicaoCliente.latitude, coordEstabelecimento.latitude];
        const lngs = [posicaoCliente.longitude, coordEstabelecimento.longitude];
        cameraRef.current?.fitBounds(
          [Math.max(...lngs), Math.max(...lats)],
          [Math.min(...lngs), Math.min(...lats)],
          80,
          900
        );
      }
    };

    atualizarRota();
    const intervalo = setInterval(atualizarRota, INTERVALO_RECALCULO_ROTA_MS);

    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionado?.id, coordEstabelecimento?.latitude, coordEstabelecimento?.longitude]);

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
        {item.ultima_localizacao && (
          <View style={styles.chipLiveDot} />
        )}
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

                {posicaoAnimada && (
                  <MarkerView coordinate={[posicaoAnimada.longitude, posicaoAnimada.latitude]} allowOverlap>
                    <View style={[styles.marcadorClienteWrap, { transform: [{ rotate: `${headingCliente}deg` }] }]}>
                      <View style={styles.marcadorClientePulso} />
                      <View style={styles.marcadorCliente}>
                        <Ionicons name="navigate" size={16} color={COLORS.white} />
                      </View>
                    </View>
                  </MarkerView>
                )}

                {rota && (
                  <ShapeSource id="rota-cliente" shape={{ type: 'Feature', properties: {}, geometry: rota.geometria } as any}>
                    <LineLayer
                      id="linha-rota"
                      style={{ lineColor: COLORS.primary, lineWidth: 4, lineCap: 'round', lineJoin: 'round' }}
                    />
                  </ShapeSource>
                )}
              </MapView>

              <View style={styles.painelStatus}>
                <View style={styles.statusRow}>
                  <View style={[styles.dot, { backgroundColor: posicaoCliente ? COLORS.green : COLORS.gray }]} />
                  <Text style={styles.statusTexto} numberOfLines={1}>
                    {chegou ? `${selecionado.usuario.name} chegou!` : statusConexao}
                  </Text>
                </View>

                {rota && (
                  <View style={styles.metricasRow}>
                    <View style={styles.metricaBox}>
                      <Text style={styles.metricaValor}>{rota.distanciaKm.toFixed(1)} km</Text>
                      <Text style={styles.metricaLabel}>Distância (rota real)</Text>
                    </View>
                    <View style={styles.metricaBox}>
                      <Text style={styles.metricaValor}>{chegou ? 'Chegou' : `~${rota.duracaoMin} min`}</Text>
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
    borderWidth: 1, borderColor: COLORS.border, position: 'relative',
  },
  chipAtivo: { backgroundColor: COLORS.secondary, borderColor: COLORS.secondary },
  chipAvatar: { width: 32, height: 32, borderRadius: 16 },
  chipAvatarFallback: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  chipAvatarTexto: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  chipNome: { fontSize: 12, fontWeight: '700', color: COLORS.secondary },
  chipNomeAtivo: { color: COLORS.white },
  chipHorario: { fontSize: 10, color: COLORS.gray, marginTop: 1 },
  chipLiveDot: {
    position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4,
    backgroundColor: COLORS.green, borderWidth: 1.5, borderColor: COLORS.white,
  },

  map: { flex: 1 },
  marcadorLoja: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.secondary,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.white,
  },
  marcadorClienteWrap: { alignItems: 'center', justifyContent: 'center' },
  marcadorClientePulso: {
    position: 'absolute', width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(15,23,42,0.18)',
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

// Ver os clientes a caminho é um recurso Premium: sem plano, mostra o convite para assinar.
export default function MapaRastreamento() {
  const [premium, setPremium] = useState<boolean | null>(null);

  useEffect(() => {
    api('/proprietario/dashboard')
      .then((r: any) => setPremium(!!r?.premium))
      .catch(() => setPremium(true)); // se a checagem falhar, o servidor ainda bloqueia quem não é Premium
  }, []);

  if (premium === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F5F5' }}>
        <ActivityIndicator size="large" color="#FF7A00" />
      </View>
    );
  }

  if (!premium) {
    return (
      <PremiumGate
        titulo="Rastreamento de clientes"
        texto="Com o plano Premium você acompanha, em tempo real no mapa, cada cliente com agendamento hoje: onde ele está, quanto falta para chegar e o horário previsto."
        icone="navigate"
        beneficios={[
          { icone: 'location-outline', texto: 'Localização do cliente a caminho, ao vivo' },
          { icone: 'time-outline', texto: 'Tempo e distância até a chegada' },
          { icone: 'people-outline', texto: 'Menos atrasos e mais organização da fila' },
        ]}
      />
    );
  }

  return <MapaRastreamentoConteudo />;
}
