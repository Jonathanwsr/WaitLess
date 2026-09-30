import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator, Switch, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import Mapbox, { MapView, Camera, MarkerView, ShapeSource, LineLayer } from '../../../services/mapboxSeguro';
import * as Location from 'expo-location';
import { iniciarRastreamentoBackground, pararRastreamentoBackground, rastreamentoEstaAtivo } from '../../../services/rastreamentoTask';
import { T } from '../../../constants/ClientTheme';
import { alertar } from '../../../services/alertar';

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '';

interface Coordenada {
  latitude: number;
  longitude: number;
}

async function buscarRotaReal(origem: Coordenada, destino: Coordenada) {
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

const ENV_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api';
// O .env local já define EXPO_PUBLIC_API_URL terminando em "/mobile" — removemos
// esse sufixo antes de recompor as URLs para não gerar ".../api/mobile/mobile".
const cleanBaseUrl = ENV_URL.replace(/\/mobile\/?$/, '').replace(/\/+$/, '');
const API_URL = `${cleanBaseUrl}/mobile`;

interface DetalhesFila {
  estabelecimento_id: number;
  profissional: string;
  servico: string;
  valor: string;
  horario_previsto: string;
  data_agendamento?: string;
  estabelecimento: string;
  endereco: string;
  latitude?: number | null;
  longitude?: number | null;
  status?: string;
  pin?: string | null;
}

interface FilaData {
  id_agendamento?: number;
  posicao_atual: string;
  tempo_estimado_minutos: number;
  pessoas_na_frente: { id: number; nome_ficticio: string; status_texto: string; is_em_atendimento: boolean }[];
  detalhes: DetalhesFila;
  status?: string;
  mensagem?: string;
}

async function pegarToken() {
  return (await AsyncStorage.getItem('@lokyva_token')) || (await AsyncStorage.getItem('@waitless_token'));
}

export default function AcompanhamentoFilaScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const cameraRef = useRef<any>(null);

  const [filaData, setFilaData] = useState<FilaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [compartilhandoLocalizacao, setCompartilhandoLocalizacao] = useState(false);
  const [enviandoLocalizacao, setEnviandoLocalizacao] = useState(false);
  const [baixandoComprovante, setBaixandoComprovante] = useState(false);
  const [minhaPosicao, setMinhaPosicao] = useState<Coordenada | null>(null);
  const [rotaAteLoja, setRotaAteLoja] = useState<{ distanciaKm: number; duracaoMin: number; geometria: any } | null>(null);

  const fetchFilaStatus = useCallback(async () => {
    try {
      const token = await pegarToken();
      const res = await fetch(`${API_URL}/agendamentos/${id || '1'}/fila`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const data = await res.json();
      setFilaData(data);
    } catch (error) {
      console.log('Erro ao buscar fila', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchFilaStatus();
    rastreamentoEstaAtivo().then(setCompartilhandoLocalizacao);
  }, [fetchFilaStatus]);

  // Mostra a rota real (estilo Uber) do cliente até o estabelecimento,
  // como prévia — não depende de estar compartilhando localização em segundo plano.
  useEffect(() => {
    const lat = filaData?.detalhes?.latitude;
    const lng = filaData?.detalhes?.longitude;
    if (!lat || !lng) return;

    let cancelado = false;

    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        let permissao = status;
        if (permissao !== 'granted') {
          const resultado = await Location.requestForegroundPermissionsAsync();
          permissao = resultado.status;
        }
        if (permissao !== 'granted' || cancelado) return;

        const posicao = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const origem = { latitude: posicao.coords.latitude, longitude: posicao.coords.longitude };
        if (cancelado) return;
        setMinhaPosicao(origem);

        const rota = await buscarRotaReal(origem, { latitude: lat, longitude: lng });
        if (!cancelado && rota) {
          setRotaAteLoja(rota);
          const lats = [origem.latitude, lat];
          const lngs = [origem.longitude, lng];
          cameraRef.current?.fitBounds(
            [Math.max(...lngs), Math.max(...lats)],
            [Math.min(...lngs), Math.min(...lats)],
            40,
            600
          );
        }
      } catch (e) {
        // sem localização, a tela cai pro mapa estático de sempre
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [filaData?.detalhes?.latitude, filaData?.detalhes?.longitude]);

  // Atualiza a posição na fila periodicamente enquanto a tela estiver em foco
  useFocusEffect(
    useCallback(() => {
      const intervalo = setInterval(fetchFilaStatus, 15000);
      return () => clearInterval(intervalo);
    }, [fetchFilaStatus])
  );

  const alternarCompartilhamento = async (ativar: boolean) => {
    if (!id) {
      alertar('Atenção', 'Não foi possível identificar este agendamento.');
      return;
    }

    if (!ativar) {
      await pararRastreamentoBackground();
      setCompartilhandoLocalizacao(false);
      return;
    }

    setEnviandoLocalizacao(true);
    try {
      const resultado = await iniciarRastreamentoBackground(Number(id));
      if (!resultado.ok) {
        alertar('Permissão necessária', resultado.motivo || 'Não foi possível ativar o compartilhamento de localização.');
        return;
      }
      setCompartilhandoLocalizacao(true);
    } catch (error) {
      alertar('Erro', 'Não foi possível iniciar o compartilhamento de localização.');
    } finally {
      setEnviandoLocalizacao(false);
    }
  };

  const handleSairDaFila = () => {
    alertar('Sair da fila', 'Tem certeza que deseja cancelar seu atendimento?', [
      { text: 'Não', style: 'cancel' },
      {
        text: 'Sim, sair',
        style: 'destructive',
        onPress: async () => {
          try {
            const token = await pegarToken();
            await fetch(`${API_URL}/agendamentos/${id}/cancelar`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
            });
          } catch (e) {
            // segue para a Home mesmo se falhar; o usuário pode tentar cancelar de novo depois
          }
          router.push('/(tabs)/home' as never);
        },
      },
    ]);
  };

  const baixarComprovante = async () => {
    if (!id) return;
    setBaixandoComprovante(true);
    try {
      const token = await pegarToken();
      const destino = `${FileSystem.cacheDirectory}comprovante-lokyva-${id}.pdf`;

      const resultado = await FileSystem.downloadAsync(`${API_URL}/agendamentos/${id}/comprovante-pdf`, destino, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/pdf' },
      });

      if (resultado.status !== 200) {
        throw new Error('Não foi possível gerar o comprovante.');
      }

      const podeCompartilhar = await Sharing.isAvailableAsync();
      if (podeCompartilhar) {
        await Sharing.shareAsync(resultado.uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Comprovante Lokyva',
          UTI: 'com.adobe.pdf',
        });
      } else {
        alertar('Comprovante salvo', `O arquivo foi salvo em: ${resultado.uri}`);
      }
    } catch (error) {
      alertar('Erro', 'Não foi possível baixar o comprovante agora. Tente novamente.');
    } finally {
      setBaixandoComprovante(false);
    }
  };

  if (loading) {
    return (
      <View style={s.loading}>
        <ActivityIndicator size="large" color={T.primary} />
      </View>
    );
  }

  const info: FilaData = filaData || {
    posicao_atual: '01',
    tempo_estimado_minutos: 0,
    pessoas_na_frente: [],
    detalhes: {
      estabelecimento_id: 0,
      profissional: 'Profissional',
      servico: 'Serviço',
      valor: 'R$ 0,00',
      horario_previsto: '--:--',
      estabelecimento: 'Estabelecimento',
      endereco: 'Endereço não informado',
      pin: null,
    },
  };

  const statusAtual = info.status || info.detalhes?.status || 'pendente';
  const jaFinalizado = statusAtual === 'finalizado';
  const foiCancelado = statusAtual === 'cancelado';
  const temCoordenadas = !!(info.detalhes?.latitude && info.detalhes?.longitude);
  const naFrente = info.pessoas_na_frente?.length || 0;

  const Linha = ({ icone, rotulo, valor, destaque }: { icone: string; rotulo: string; valor: string; destaque?: boolean }) => (
    <View style={s.linha}>
      <View style={s.linhaEsq}>
        <Ionicons name={icone as never} size={16} color={T.muted} />
        <Text style={s.linhaRotulo}>{rotulo}</Text>
      </View>
      <Text style={[s.linhaValor, destaque && { color: T.primary }]} numberOfLines={1}>{valor}</Text>
    </View>
  );

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.voltar}>
          <Ionicons name="chevron-back" size={24} color={T.ink} />
        </TouchableOpacity>
        <TouchableOpacity onPress={fetchFilaStatus} style={s.voltar}>
          <Ionicons name="refresh" size={21} color={T.ink} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {jaFinalizado ? (
          <View style={s.banner}>
            <View style={[s.bannerIcone, { backgroundColor: T.successBg }]}><Ionicons name="checkmark-circle" size={34} color={T.success} /></View>
            <Text style={s.bannerTitulo}>Atendimento concluído!</Text>
            <Text style={s.bannerTxt}>Baixe seu comprovante e conte como foi a experiência.</Text>
          </View>
        ) : foiCancelado ? (
          <View style={s.banner}>
            <View style={[s.bannerIcone, { backgroundColor: '#FEE2E2' }]}><Ionicons name="close-circle" size={34} color={T.danger} /></View>
            <Text style={[s.bannerTitulo, { color: T.danger }]}>Agendamento cancelado</Text>
          </View>
        ) : (
          <>
            <Text style={s.titulo}>Acompanhe sua fila em tempo real</Text>
            <View style={s.atualizado}>
              <Text style={s.atualizadoTxt}>Atualizado agora há pouco</Text>
              <View style={s.pontoVerde} />
            </View>
          </>
        )}

        {/* CÓDIGO DE CHECK-IN */}
        {!!info.detalhes?.pin && !foiCancelado && (
          <View style={s.pinCard}>
            <Text style={s.pinRotulo}>Código de atendimento</Text>
            <View style={s.pinLinha}>
              {String(info.detalhes.pin).split('').map((d, i) => (
                <View key={i} style={s.pinBox}><Text style={s.pinNum}>{d}</Text></View>
              ))}
            </View>
            <Text style={s.pinDesc}>Apresente este código ao estabelecimento para confirmar sua chegada.</Text>
          </View>
        )}

        {!jaFinalizado && !foiCancelado && (
          <>
            {/* POSIÇÃO NA FILA */}
            <View style={s.hero}>
              <Text style={s.heroTitulo}>{naFrente ? 'Falta pouco!' : 'Você é o próximo!'}</Text>
              <Text style={s.heroSub}>{naFrente ? `Faltam ${naFrente} ${naFrente === 1 ? 'pessoa' : 'pessoas'} para o seu atendimento.` : 'Sua vez está chegando. Fique por perto.'}</Text>

              <View style={s.circulo}>
                <Text style={s.circuloRotulo}>SUA POSIÇÃO{'\n'}NA FILA</Text>
                <Text style={s.circuloNum}>{info.posicao_atual}</Text>
              </View>

              <Text style={s.tempoRotulo}>TEMPO ESTIMADO PARA SEU ATENDIMENTO</Text>
              <View style={s.tempo}>
                <Ionicons name="time-outline" size={19} color={T.primary} />
                <Text style={s.tempoValor}>{info.tempo_estimado_minutos} <Text style={s.tempoMin}>min</Text></Text>
              </View>

              {/* LINHA DO TEMPO */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.timeline}>
                {info.pessoas_na_frente?.map((pessoa, index) => (
                  <View key={index} style={s.etapa}>
                    <View style={s.etapaTopo}>
                      <View style={[s.no, pessoa.is_em_atendimento ? s.noOk : s.noEspera]}>
                        {pessoa.is_em_atendimento ? <Ionicons name="checkmark" size={14} color="#fff" /> : <Text style={s.noTxt}>{index + 1}</Text>}
                      </View>
                      <View style={s.etapaLinha} />
                    </View>
                    <Text style={s.etapaNome} numberOfLines={1}>{pessoa.nome_ficticio}</Text>
                    <Text style={s.etapaSub} numberOfLines={1}>{pessoa.status_texto}</Text>
                  </View>
                ))}
                <View style={s.etapa}>
                  <View style={s.etapaTopo}>
                    <View style={[s.no, s.noVoce]}><Ionicons name="person" size={14} color={T.primary} /></View>
                  </View>
                  <Text style={[s.etapaNome, { color: T.primary }]}>Você</Text>
                  <Text style={s.etapaSub}>Aguardando</Text>
                </View>
              </ScrollView>
            </View>

            {/* COMPARTILHAR CHEGADA */}
            <View style={s.card}>
              <View style={s.cardLinha}>
                <View style={s.cardIcone}><Ionicons name="navigate-outline" size={20} color={T.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitulo}>Compartilhar minha chegada</Text>
                  <Text style={s.cardTxt}>
                    {compartilhandoLocalizacao
                      ? 'Ativo mesmo com o app em segundo plano — você verá uma notificação enquanto isso.'
                      : 'Ative para o estabelecimento acompanhar você chegando, estilo Uber.'}
                  </Text>
                </View>
                {enviandoLocalizacao ? (
                  <ActivityIndicator size="small" color={T.primary} />
                ) : (
                  <Switch
                    value={compartilhandoLocalizacao}
                    onValueChange={alternarCompartilhamento}
                    trackColor={{ false: '#E7DED8', true: '#F8B899' }}
                    thumbColor={compartilhandoLocalizacao ? T.primary : '#FAFAFA'}
                  />
                )}
              </View>
            </View>
          </>
        )}

        {/* MAPA */}
        {temCoordenadas && (
          <View style={s.mapa}>
            <MapView style={s.mapaView} styleURL={Mapbox.StyleURL.Street} scrollEnabled={false} zoomEnabled={false}>
              <Camera
                ref={cameraRef}
                defaultSettings={{
                  centerCoordinate: [info.detalhes.longitude as number, info.detalhes.latitude as number],
                  zoomLevel: 15,
                }}
              />
              <MarkerView coordinate={[info.detalhes.longitude as number, info.detalhes.latitude as number]}>
                <View style={s.marcadorLoja}><Ionicons name="storefront" size={16} color="#fff" /></View>
              </MarkerView>

              {minhaPosicao && (
                <MarkerView coordinate={[minhaPosicao.longitude, minhaPosicao.latitude]}>
                  <View style={s.marcadorEu}><Ionicons name="person" size={14} color="#fff" /></View>
                </MarkerView>
              )}

              {rotaAteLoja && (
                <ShapeSource id="minha-rota" shape={{ type: 'Feature', properties: {}, geometry: rotaAteLoja.geometria } as any}>
                  <LineLayer id="minha-rota-linha" style={{ lineColor: T.primary, lineWidth: 4, lineCap: 'round', lineJoin: 'round' }} />
                </ShapeSource>
              )}
            </MapView>
            <View style={s.mapaRodape}>
              <Ionicons name="location-sharp" size={15} color={T.primary} />
              <Text style={s.mapaEndereco} numberOfLines={2}>{info.detalhes.endereco}</Text>
              {rotaAteLoja && <Text style={s.mapaEta}>~{rotaAteLoja.duracaoMin} min</Text>}
            </View>
          </View>
        )}

        {/* RESUMO */}
        <View style={s.card}>
          <Text style={s.secao}>Resumo do seu atendimento</Text>
          {!jaFinalizado && !foiCancelado && (
            <>
              <Linha icone="people-outline" rotulo="Sua posição" valor={`#${info.posicao_atual}`} destaque />
              <Linha icone="time-outline" rotulo="Tempo previsto" valor={`${info.tempo_estimado_minutos} min`} destaque />
            </>
          )}
          <Linha icone="person-outline" rotulo="Profissional" valor={info.detalhes.profissional} />
          <Linha icone="cut-outline" rotulo="Serviço" valor={info.detalhes.servico} />
          <Linha icone="cash-outline" rotulo="Valor" valor={info.detalhes.valor} />
          <Linha icone="calendar-outline" rotulo="Horário previsto" valor={info.detalhes.horario_previsto} />
          <Linha icone="location-outline" rotulo="Local" valor={info.detalhes.estabelecimento} />

          {!jaFinalizado && !foiCancelado && (
            <TouchableOpacity style={s.btnSair} onPress={handleSairDaFila} activeOpacity={0.88}>
              <Ionicons name="log-out-outline" size={19} color="#fff" />
              <Text style={s.btnPrimTxt}>Sair da fila</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={s.btnSec} onPress={baixarComprovante} disabled={baixandoComprovante} activeOpacity={0.85}>
            {baixandoComprovante ? (
              <ActivityIndicator size="small" color={T.primary} />
            ) : (
              <>
                <Ionicons name="download-outline" size={18} color={T.primary} />
                <Text style={s.btnSecTxt}>{jaFinalizado ? 'Baixar comprovante de conclusão' : 'Baixar comprovante (PDF)'}</Text>
              </>
            )}
          </TouchableOpacity>

          {jaFinalizado && (
            <TouchableOpacity style={s.btnAvaliar} onPress={() => router.push({ pathname: '/src/screens/AvaliarServico' as never, params: { id: String(id) } })} activeOpacity={0.88}>
              <Ionicons name="star-outline" size={19} color="#fff" />
              <Text style={s.btnPrimTxt}>Avaliar atendimento</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* PROFISSIONAL */}
        <View style={s.card}>
          <Text style={s.secao}>Profissional</Text>
          <View style={s.prof}>
            <View style={s.profAvatar}><Text style={s.profInicial}>{String(info.detalhes.profissional || 'P').charAt(0).toUpperCase()}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.profNome}>{info.detalhes.profissional}</Text>
              <Text style={s.profSub} numberOfLines={1}>{info.detalhes.estabelecimento}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.cream, paddingTop: Platform.OS === 'android' ? 25 : 0 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: T.cream },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  voltar: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },

  titulo: { fontSize: 26, fontWeight: '800', color: T.ink, letterSpacing: -0.6, lineHeight: 32 },
  atualizado: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, marginBottom: 18 },
  atualizadoTxt: { fontSize: 12, color: T.muted },
  pontoVerde: { width: 8, height: 8, borderRadius: 4, backgroundColor: T.success },

  banner: { alignItems: 'center', backgroundColor: T.card, borderRadius: 22, padding: 22, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  bannerIcone: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  bannerTitulo: { fontSize: 20, fontWeight: '800', color: T.ink },
  bannerTxt: { fontSize: 13, color: T.muted, textAlign: 'center', marginTop: 4 },

  pinCard: { backgroundColor: T.card, borderRadius: 22, borderWidth: 1, borderColor: T.line, padding: 16, alignItems: 'center', marginBottom: 16 },
  pinRotulo: { fontSize: 12, fontWeight: '800', color: T.muted, letterSpacing: 0.6, textTransform: 'uppercase' },
  pinLinha: { flexDirection: 'row', gap: 10, marginVertical: 12 },
  pinBox: { width: 50, height: 58, borderRadius: 14, backgroundColor: T.cream, borderWidth: 1, borderColor: T.line, alignItems: 'center', justifyContent: 'center' },
  pinNum: { fontSize: 26, fontWeight: '800', color: T.ink },
  pinDesc: { fontSize: 12, color: T.muted, textAlign: 'center', lineHeight: 17 },

  hero: { backgroundColor: T.card, borderRadius: 24, padding: 20, alignItems: 'center', marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  heroTitulo: { fontSize: 22, fontWeight: '800', color: T.ink },
  heroSub: { fontSize: 13, color: T.muted, marginTop: 4, textAlign: 'center' },
  circulo: { width: 150, height: 150, borderRadius: 75, borderWidth: 2, borderStyle: 'dashed', borderColor: T.primary, alignItems: 'center', justifyContent: 'center', marginVertical: 20 },
  circuloRotulo: { fontSize: 10, fontWeight: '800', color: T.muted, textAlign: 'center', letterSpacing: 0.4 },
  circuloNum: { fontSize: 48, fontWeight: '800', color: T.primary, letterSpacing: -1 },
  tempoRotulo: { fontSize: 10, fontWeight: '800', color: T.muted, letterSpacing: 0.5 },
  tempo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  tempoValor: { fontSize: 26, fontWeight: '800', color: T.primary },
  tempoMin: { fontSize: 14, fontWeight: '500' },

  timeline: { paddingTop: 22, paddingHorizontal: 4, alignItems: 'flex-start' },
  etapa: { width: 84 },
  etapaTopo: { flexDirection: 'row', alignItems: 'center' },
  etapaLinha: { flex: 1, height: 2, backgroundColor: T.line },
  no: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  noOk: { backgroundColor: T.primary },
  noEspera: { backgroundColor: T.cream, borderWidth: 1, borderColor: T.line },
  noVoce: { backgroundColor: T.primarySoft, borderWidth: 2, borderColor: T.primary },
  noTxt: { fontSize: 11, fontWeight: '800', color: T.muted },
  etapaNome: { fontSize: 11, fontWeight: '700', color: T.ink, marginTop: 6 },
  etapaSub: { fontSize: 10, color: T.muted, marginTop: 1 },

  card: { backgroundColor: T.card, borderRadius: 22, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  cardLinha: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardIcone: { width: 42, height: 42, borderRadius: 14, backgroundColor: T.primarySoft, alignItems: 'center', justifyContent: 'center' },
  cardTitulo: { fontSize: 14, fontWeight: '800', color: T.ink },
  cardTxt: { fontSize: 12, color: T.muted, marginTop: 2, lineHeight: 17 },
  secao: { fontSize: 16, fontWeight: '800', color: T.ink, marginBottom: 8 },

  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: T.line, gap: 12 },
  linhaEsq: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  linhaRotulo: { fontSize: 13, color: T.muted },
  linhaValor: { flex: 1, textAlign: 'right', fontSize: 13, fontWeight: '800', color: T.ink },

  btnSair: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: T.primary, height: 50, borderRadius: 25, marginTop: 16 },
  btnAvaliar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: T.success, height: 50, borderRadius: 25, marginTop: 10 },
  btnPrimTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  btnSec: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 20, backgroundColor: T.card, marginTop: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  btnSecTxt: { color: T.primary, fontWeight: '800', fontSize: 13 },

  mapa: { borderRadius: 22, overflow: 'hidden', backgroundColor: T.card, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  mapaView: { height: 190 },
  mapaRodape: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  mapaEndereco: { flex: 1, fontSize: 12, color: T.ink },
  mapaEta: { fontSize: 12, fontWeight: '800', color: T.primary },
  marcadorLoja: { width: 34, height: 34, borderRadius: 17, backgroundColor: T.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  marcadorEu: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },

  prof: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  profAvatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: T.primarySoft, alignItems: 'center', justifyContent: 'center' },
  profInicial: { fontSize: 22, fontWeight: '800', color: T.primary },
  profNome: { fontSize: 16, fontWeight: '800', color: T.ink },
  profSub: { fontSize: 12, color: T.muted, marginTop: 2 },
});
