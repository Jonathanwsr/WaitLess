import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator, Alert, Switch, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Feather, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import Mapbox, { MapView, Camera, MarkerView } from '@rnmapbox/maps';
import { iniciarRastreamentoBackground, pararRastreamentoBackground, rastreamentoEstaAtivo } from '../../../services/rastreamentoTask';

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '');

const ENV_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api';
// O .env local já define EXPO_PUBLIC_API_URL terminando em "/mobile" — removemos
// esse sufixo antes de recompor as URLs para não gerar ".../api/mobile/mobile".
const cleanBaseUrl = ENV_URL.replace(/\/mobile\/?$/, '').replace(/\/+$/, '');
const API_URL = `${cleanBaseUrl}/mobile`;

const COLORS = {
  primary: '#FF6B35',
  secondary: '#1F2937',
  gray: '#6B7280',
  lightGray: '#F9FAFB',
  white: '#FFFFFF',
  border: '#E5E7EB',
  success: '#10B981',
  successBg: '#ECFDF5',
  danger: '#DC2626',
};

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
  const cameraRef = useRef<Camera | null>(null);

  const [filaData, setFilaData] = useState<FilaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [compartilhandoLocalizacao, setCompartilhandoLocalizacao] = useState(false);
  const [enviandoLocalizacao, setEnviandoLocalizacao] = useState(false);
  const [baixandoComprovante, setBaixandoComprovante] = useState(false);

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

  // Atualiza a posição na fila periodicamente enquanto a tela estiver em foco
  useFocusEffect(
    useCallback(() => {
      const intervalo = setInterval(fetchFilaStatus, 15000);
      return () => clearInterval(intervalo);
    }, [fetchFilaStatus])
  );

  const alternarCompartilhamento = async (ativar: boolean) => {
    if (!id) {
      Alert.alert('Atenção', 'Não foi possível identificar este agendamento.');
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
        Alert.alert('Permissão necessária', resultado.motivo || 'Não foi possível ativar o compartilhamento de localização.');
        return;
      }
      setCompartilhandoLocalizacao(true);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível iniciar o compartilhamento de localização.');
    } finally {
      setEnviandoLocalizacao(false);
    }
  };

  const handleSairDaFila = () => {
    Alert.alert('Sair da Fila', 'Tem certeza que deseja cancelar seu atendimento?', [
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
        Alert.alert('Comprovante salvo', `O arquivo foi salvo em: ${resultado.uri}`);
      }
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível baixar o comprovante agora. Tente novamente.');
    } finally {
      setBaixandoComprovante(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={COLORS.secondary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={fetchFilaStatus}>
          <Feather name="refresh-cw" size={20} color={COLORS.secondary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {jaFinalizado ? (
          <View style={styles.concluidoBanner}>
            <Ionicons name="checkmark-circle" size={40} color={COLORS.success} />
            <Text style={styles.concluidoTitulo}>Atendimento concluído!</Text>
            <Text style={styles.concluidoDesc}>Baixe seu comprovante com todos os detalhes do atendimento.</Text>
          </View>
        ) : foiCancelado ? (
          <View style={[styles.concluidoBanner, styles.canceladoBanner]}>
            <Ionicons name="close-circle" size={40} color={COLORS.danger} />
            <Text style={[styles.concluidoTitulo, { color: COLORS.danger }]}>Agendamento cancelado</Text>
          </View>
        ) : (
          <>
            <Text style={styles.pageTitle}>Acompanhe sua fila em tempo real</Text>
            <Text style={styles.updateText}>Atualizado agora há pouco <View style={styles.dotGreen} /></Text>
          </>
        )}

        {/* CÓDIGO DE CHECK-IN */}
        {!!info.detalhes?.pin && !foiCancelado && (
          <View style={styles.codigoCard}>
            <Text style={styles.codigoLabel}>CÓDIGO DE ATENDIMENTO</Text>
            <Text style={styles.codigoValor}>{info.detalhes.pin}</Text>
            <Text style={styles.codigoDesc}>Apresente este código ao estabelecimento para confirmar sua chegada.</Text>
          </View>
        )}

        {/* MAPA DO ESTABELECIMENTO */}
        {temCoordenadas && (
          <View style={styles.mapCard}>
            <MapView style={styles.map} styleURL={Mapbox.StyleURL.Street} scrollEnabled={false} zoomEnabled={false}>
              <Camera
                ref={cameraRef}
                defaultSettings={{
                  centerCoordinate: [info.detalhes.longitude as number, info.detalhes.latitude as number],
                  zoomLevel: 15,
                }}
              />
              <MarkerView coordinate={[info.detalhes.longitude as number, info.detalhes.latitude as number]}>
                <View style={styles.marcadorLoja}>
                  <Ionicons name="storefront" size={16} color={COLORS.white} />
                </View>
              </MarkerView>
            </MapView>
            <View style={styles.mapFooter}>
              <Ionicons name="location-sharp" size={14} color={COLORS.primary} />
              <Text style={styles.mapEndereco} numberOfLines={2}>{info.detalhes.endereco}</Text>
            </View>
          </View>
        )}

        {!jaFinalizado && !foiCancelado && (
          <>
            <View style={styles.localizacaoCard}>
              <View style={styles.localizacaoIconCircle}>
                <Ionicons name="navigate" size={18} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.localizacaoTitulo}>Compartilhar minha chegada</Text>
                <Text style={styles.localizacaoDesc}>
                  {compartilhandoLocalizacao
                    ? 'Ativo mesmo com o app em segundo plano — você verá uma notificação enquanto isso.'
                    : 'Ative para o estabelecimento acompanhar você chegando, estilo Uber.'}
                </Text>
              </View>
              {enviandoLocalizacao ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Switch
                  value={compartilhandoLocalizacao}
                  onValueChange={alternarCompartilhamento}
                  trackColor={{ false: '#E5E7EB', true: '#FFD3BE' }}
                  thumbColor={compartilhandoLocalizacao ? COLORS.primary : '#F9FAFB'}
                />
              )}
            </View>

            <View style={styles.statusHero}>
              <Text style={styles.heroTitle}>
                {info.pessoas_na_frente?.length ? 'Você é o próximo!' : 'Sua vez está próxima!'}
              </Text>
              <Text style={styles.heroSubtitle}>Faltam {info.pessoas_na_frente?.length || 0} pessoas para o seu atendimento.</Text>

              <View style={styles.circleProgress}>
                <Text style={styles.circleLabel}>SUA POSIÇÃO NA FILA</Text>
                <Text style={styles.circleNumber}>{info.posicao_atual}</Text>
              </View>

              <Text style={styles.timeLabel}>TEMPO ESTIMADO PARA SEU ATENDIMENTO</Text>
              <View style={styles.timeBox}>
                <Feather name="clock" size={18} color={COLORS.primary} />
                <Text style={styles.timeValue}>{info.tempo_estimado_minutos} <Text style={{ fontSize: 14, fontWeight: '400' }}>min</Text></Text>
              </View>
            </View>

            <View style={styles.timelineContainer}>
              {info.pessoas_na_frente?.map((pessoa, index) => (
                <View key={index} style={styles.timelineItem}>
                  <View style={[styles.timelineNode, pessoa.is_em_atendimento ? styles.nodeActive : styles.nodeWaiting]}>
                    {pessoa.is_em_atendimento ? <Feather name="check" size={12} color="#FFF" /> : <Text style={styles.nodeTextSmall}>{index + 1}</Text>}
                  </View>
                  <Text style={styles.timelineName}>{pessoa.nome_ficticio}</Text>
                </View>
              ))}
              <View style={styles.timelineItem}>
                <View style={[styles.timelineNode, styles.nodeYou]}>
                  <Feather name="user" size={12} color={COLORS.primary} />
                </View>
                <Text style={[styles.timelineName, { color: COLORS.primary }]}>Você</Text>
              </View>
            </View>
          </>
        )}

        <View style={styles.summaryCard}>
          <Text style={styles.cardTitle}>Informações do serviço</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}><Feather name="user" size={14} /> Profissional</Text>
            <Text style={styles.summaryValue}>{info.detalhes.profissional}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}><Feather name="scissors" size={14} /> Serviço</Text>
            <Text style={styles.summaryValue}>{info.detalhes.servico}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}><Feather name="dollar-sign" size={14} /> Valor</Text>
            <Text style={styles.summaryValue}>{info.detalhes.valor}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}><Feather name="calendar" size={14} /> Horário previsto</Text>
            <Text style={styles.summaryValue}>{info.detalhes.horario_previsto}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}><Feather name="map-pin" size={14} /> Local</Text>
            <Text style={styles.summaryValue} numberOfLines={1}>{info.detalhes.estabelecimento}</Text>
          </View>

          <TouchableOpacity style={styles.btnComprovante} onPress={baixarComprovante} disabled={baixandoComprovante}>
            {baixandoComprovante ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <>
                <Feather name="download" size={18} color={COLORS.primary} />
                <Text style={styles.btnComprovanteText}>{jaFinalizado ? 'Baixar comprovante de conclusão' : 'Baixar comprovante (PDF)'}</Text>
              </>
            )}
          </TouchableOpacity>

          {!jaFinalizado && !foiCancelado && (
            <TouchableOpacity style={styles.btnLeaveQueue} onPress={handleSairDaFila}>
              <Feather name="log-out" size={18} color="#FFF" />
              <Text style={styles.btnLeaveText}>Sair da Fila</Text>
            </TouchableOpacity>
          )}

          {jaFinalizado && (
            <TouchableOpacity
              style={styles.btnAvaliar}
              onPress={() => router.push({ pathname: '/src/screens/ConfirmacaoScreen' as never, params: { id: String(id) } })}
            >
              <Feather name="star" size={18} color="#FFF" />
              <Text style={styles.btnLeaveText}>Avaliar atendimento</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF', paddingTop: Platform.OS === 'android' ? 25 : 0 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center' },

  container: { paddingHorizontal: 20, paddingBottom: 40 },
  pageTitle: { fontSize: 24, fontWeight: '900', color: '#1F2937', marginBottom: 4 },
  updateText: { fontSize: 12, color: '#6B7280', marginBottom: 24, flexDirection: 'row', alignItems: 'center' },
  dotGreen: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981', marginLeft: 6 },

  concluidoBanner: { alignItems: 'center', backgroundColor: COLORS.successBg, borderRadius: 16, padding: 24, marginBottom: 20 },
  canceladoBanner: { backgroundColor: '#FEF2F2' },
  concluidoTitulo: { fontSize: 18, fontWeight: '900', color: COLORS.success, marginTop: 10 },
  concluidoDesc: { fontSize: 13, color: '#6B7280', marginTop: 4, textAlign: 'center' },

  codigoCard: {
    alignItems: 'center', backgroundColor: '#FFF7ED', borderRadius: 16, borderWidth: 2,
    borderStyle: 'dashed', borderColor: COLORS.primary, padding: 18, marginBottom: 20,
  },
  codigoLabel: { fontSize: 10, fontWeight: '800', color: COLORS.primary, letterSpacing: 1 },
  codigoValor: { fontSize: 32, fontWeight: '900', color: '#1F2937', letterSpacing: 8, marginTop: 6 },
  codigoDesc: { fontSize: 11, color: '#6B7280', marginTop: 6, textAlign: 'center' },

  mapCard: { borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, marginBottom: 20 },
  map: { width: '100%', height: 160 },
  mapFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, backgroundColor: COLORS.lightGray },
  mapEndereco: { fontSize: 12, color: '#374151', flex: 1 },
  marcadorLoja: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.secondary,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.white,
  },

  localizacaoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF7ED',
    borderRadius: 16, borderWidth: 1, borderColor: '#FFEDD5', padding: 14, marginBottom: 24,
  },
  localizacaoIconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  localizacaoTitulo: { fontSize: 13, fontWeight: '800', color: '#1F2937' },
  localizacaoDesc: { fontSize: 11, color: '#6B7280', marginTop: 2, lineHeight: 15 },

  statusHero: { alignItems: 'center', marginBottom: 30 },
  heroTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937', marginBottom: 4 },
  heroSubtitle: { fontSize: 13, color: '#6B7280', marginBottom: 20 },

  circleProgress: { width: 140, height: 140, borderRadius: 70, borderWidth: 2, borderStyle: 'dashed', borderColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  circleLabel: { fontSize: 10, color: '#6B7280', textAlign: 'center', width: '60%' },
  circleNumber: { fontSize: 48, fontWeight: '900', color: COLORS.primary },

  timeLabel: { fontSize: 10, color: '#6B7280', textTransform: 'uppercase', marginBottom: 8 },
  timeBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeValue: { fontSize: 24, fontWeight: 'bold', color: COLORS.primary },

  timelineContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30, paddingHorizontal: 10, flexWrap: 'wrap', rowGap: 12 },
  timelineItem: { alignItems: 'center' },
  timelineNode: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  nodeActive: { backgroundColor: COLORS.primary },
  nodeWaiting: { backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#D1D5DB' },
  nodeYou: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: COLORS.primary },
  nodeTextSmall: { fontSize: 10, color: '#6B7280' },
  timelineName: { fontSize: 10, color: '#6B7280' },

  summaryCard: { backgroundColor: '#F9FAFB', borderRadius: 16, padding: 20, marginBottom: 24 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F2937', marginBottom: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  summaryLabel: { fontSize: 13, color: '#6B7280' },
  summaryValue: { fontSize: 13, fontWeight: '700', color: '#1F2937', maxWidth: '55%', textAlign: 'right' },

  btnComprovante: {
    flexDirection: 'row', backgroundColor: '#FFF', borderWidth: 1, borderColor: COLORS.primary,
    padding: 14, borderRadius: 12, justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 14,
  },
  btnComprovanteText: { color: COLORS.primary, fontSize: 14, fontWeight: 'bold' },

  btnLeaveQueue: { flexDirection: 'row', backgroundColor: COLORS.primary, padding: 14, borderRadius: 12, justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 10 },
  btnAvaliar: { flexDirection: 'row', backgroundColor: COLORS.success, padding: 14, borderRadius: 12, justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 10 },
  btnLeaveText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
});
