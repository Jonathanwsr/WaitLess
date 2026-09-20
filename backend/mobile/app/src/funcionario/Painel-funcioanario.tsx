import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  RefreshControl,
  Modal,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const COLORS = {
  primary: '#FF5A00',
  primaryLight: '#FFF0E6',
  secondary: '#111827',
  gray: '#6B7280',
  lightGray: '#F9FAFB',
  white: '#FFFFFF',
  border: '#E5E7EB',
  success: '#10B981',
  successLight: '#ECFDF5',
  warning: '#F59E0B',
  warningLight: '#FFFBEB',
  danger: '#DC2626',
  dangerLight: '#FEF2F2',
  indigo: '#4F46E5',
  indigoLight: '#EEF2FF',
};

const ENV_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api';
const cleanBaseUrl = ENV_URL.replace(/\/mobile\/?$/, '').replace(/\/+$/, '');
const API_URL = `${cleanBaseUrl}/mobile`;

interface Agendamento {
  id: number;
  usuario?: { id: number; name: string; foto_perfil?: string; telefone?: string };
  servico?: { id: number; nome: string; valor?: number };
  data_agendamento: string;
  hora_agendamento?: string;
  hora_finalizacao?: string;
  status: 'pendente' | 'confirmado' | 'em_atendimento' | 'finalizado' | 'cancelado' | string;
  status_pagamento?: string;
  valor_final?: number;
  finalizado_por?: { id: number; name: string } | null;
}

async function pegarToken() {
  return (await AsyncStorage.getItem('@waitless_token')) || (await AsyncStorage.getItem('@lokyva_token'));
}

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Aguardando',
  confirmado: 'Confirmado',
  em_atendimento: 'Em atendimento',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
};

function corStatus(status: string) {
  switch (status) {
    case 'em_atendimento':
      return { bg: COLORS.indigoLight, text: COLORS.indigo };
    case 'finalizado':
      return { bg: COLORS.successLight, text: COLORS.success };
    case 'cancelado':
      return { bg: COLORS.dangerLight, text: COLORS.danger };
    default:
      return { bg: COLORS.warningLight, text: COLORS.warning };
  }
}

export default function PainelFuncionario() {
  const router = useRouter();

  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processandoId, setProcessandoId] = useState<number | null>(null);

  const [modalFinalizar, setModalFinalizar] = useState<{ open: boolean; agendamento: Agendamento | null }>({
    open: false,
    agendamento: null,
  });
  const [codigoPin, setCodigoPin] = useState('');
  const [finalizando, setFinalizando] = useState(false);

  const carregarFila = useCallback(async () => {
    try {
      const token = await pegarToken();
      const hoje = new Date().toISOString().split('T')[0];

      const res = await fetch(
        `${API_URL}/agendamentos?data_inicio=${hoje}&data_fim=${hoje}&ordem=asc&per_page=50`,
        { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
      );
      const json = await res.json();
      setAgendamentos(json?.agendamentos?.data || []);
    } catch (e) {
      console.log('Erro ao carregar a fila do funcionário:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregarFila();
    }, [carregarFila])
  );

  // Atualização suave em segundo plano, igual à tela de Fila do site
  useEffect(() => {
    const interval = setInterval(carregarFila, 30000);
    return () => clearInterval(interval);
  }, [carregarFila]);

  const onRefresh = () => {
    setRefreshing(true);
    carregarFila();
  };

  const executarAcao = async (id: number, endpoint: string, method: 'PUT' | 'POST', mensagemErro: string) => {
    setProcessandoId(id);
    try {
      const token = await pegarToken();
      const res = await fetch(`${API_URL}/agendamentos/${id}/${endpoint}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        Alert.alert('Não foi possível continuar', json.error || mensagemErro);
        return;
      }
      await carregarFila();
    } catch (e) {
      Alert.alert('Erro de conexão', mensagemErro);
    } finally {
      setProcessandoId(null);
    }
  };

  const chamarCliente = (item: Agendamento) => executarAcao(item.id, 'chamar', 'PUT', 'Não foi possível chamar o cliente agora.');
  const adiarCliente = (item: Agendamento) => executarAcao(item.id, 'adiar', 'PUT', 'Não foi possível adiar este atendimento.');
  const pularCliente = (item: Agendamento) => executarAcao(item.id, 'pular', 'PUT', 'Não foi possível pular este cliente.');

  const abrirModalFinalizar = (item: Agendamento) => {
    setCodigoPin('');
    setModalFinalizar({ open: true, agendamento: item });
  };

  const fecharModalFinalizar = () => setModalFinalizar({ open: false, agendamento: null });

  const confirmarFinalizacao = async () => {
    if (!modalFinalizar.agendamento || codigoPin.length !== 4) return;
    setFinalizando(true);
    try {
      const token = await pegarToken();
      const res = await fetch(`${API_URL}/agendamentos/${modalFinalizar.agendamento.id}/finalizar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ codigo_pin: codigoPin }),
      });
      const json = await res.json();
      if (!res.ok) {
        Alert.alert('PIN inválido', json.error || 'Verifique o código com o cliente.');
        return;
      }
      fecharModalFinalizar();
      carregarFila();
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível finalizar agora. Tente novamente.');
    } finally {
      setFinalizando(false);
    }
  };

  const emAtendimento = agendamentos.filter((a) => a.status === 'em_atendimento');
  const pendentes = agendamentos.filter((a) => a.status === 'pendente');
  const finalizadosHoje = agendamentos.filter((a) => a.status === 'finalizado');

  const renderItem = ({ item }: { item: Agendamento }) => {
    const cores = corStatus(item.status);
    const isProcessando = processandoId === item.id;

    return (
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.cardHeaderRow}
          activeOpacity={item.usuario?.id ? 0.7 : 1}
          onPress={() => item.usuario?.id && router.push({ pathname: '/src/funcionario/DetalheCliente', params: { id: item.usuario.id } } as never)}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.usuario?.name?.charAt(0)?.toUpperCase() || '?'}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.clienteNome} numberOfLines={1}>{item.usuario?.name || 'Cliente'}</Text>
            <Text style={styles.servicoNome} numberOfLines={1}>{item.servico?.nome || 'Serviço'}</Text>
          </View>
          <View style={styles.horaBox}>
            <Feather name="clock" size={12} color={COLORS.gray} />
            <Text style={styles.horaText}>{item.hora_agendamento?.substring(0, 5) || '--:--'}</Text>
          </View>
          {item.usuario?.id && <Feather name="chevron-right" size={16} color={COLORS.border} style={{ marginLeft: 4 }} />}
        </TouchableOpacity>

        <View style={styles.cardFooterRow}>
          <View style={[styles.statusBadge, { backgroundColor: cores.bg }]}>
            <Text style={[styles.statusBadgeText, { color: cores.text }]}>{STATUS_LABEL[item.status] || item.status}</Text>
          </View>

          {item.status === 'finalizado' && item.finalizado_por?.name && (
            <View style={styles.finalizadoBadge}>
              <Ionicons name="checkmark-circle" size={13} color={COLORS.success} />
              <Text style={styles.finalizadoText} numberOfLines={1}>
                Finalizado por {item.finalizado_por.name} às {item.hora_finalizacao?.substring(0, 5)}
              </Text>
            </View>
          )}

          {item.status === 'pendente' && (
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.btnAdiar} onPress={() => adiarCliente(item)} disabled={isProcessando}>
                <Feather name="clock" size={13} color={COLORS.gray} />
                <Text style={styles.btnAdiarText}>Adiar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPular} onPress={() => pularCliente(item)} disabled={isProcessando}>
                <Feather name="skip-forward" size={13} color={COLORS.danger} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnChamar} onPress={() => chamarCliente(item)} disabled={isProcessando}>
                {isProcessando ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <>
                    <Ionicons name="megaphone-outline" size={14} color={COLORS.white} />
                    <Text style={styles.btnChamarText}>Chamar</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {item.status === 'em_atendimento' && (
            <TouchableOpacity style={styles.btnFinalizar} onPress={() => abrirModalFinalizar(item)}>
              <Ionicons name="shield-checkmark-outline" size={14} color={COLORS.white} />
              <Text style={styles.btnChamarText}>Concluir com PIN</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Painel do Funcionário</Text>
          <Text style={styles.headerSubtitle}>Fila de atendimento de hoje</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity style={styles.equipeBtn} onPress={() => router.push('/src/funcionario/AgendaEquipe' as never)}>
            <Ionicons name="bar-chart-outline" size={18} color={COLORS.secondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.profileBtn} onPress={() => router.push('/src/screens/TelaPerfil' as never)}>
            <Ionicons name="person" size={18} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metricBox}>
          <Text style={styles.metricValue}>{pendentes.length}</Text>
          <Text style={styles.metricLabel}>Aguardando</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={[styles.metricValue, { color: COLORS.indigo }]}>{emAtendimento.length}</Text>
          <Text style={styles.metricLabel}>Em atendimento</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={[styles.metricValue, { color: COLORS.success }]}>{finalizadosHoje.length}</Text>
          <Text style={styles.metricLabel}>Finalizados</Text>
        </View>
      </View>

      <FlatList
        data={agendamentos}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} colors={[COLORS.primary]} />}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="calendar-check-outline" size={56} color={COLORS.border} />
            <Text style={styles.emptyTitle}>Nenhum agendamento hoje</Text>
            <Text style={styles.emptySubtitle}>Assim que houver novos clientes na fila, eles aparecem aqui.</Text>
          </View>
        }
      />

      {/* MODAL FINALIZAR COM PIN */}
      <Modal visible={modalFinalizar.open} transparent animationType="fade" onRequestClose={fecharModalFinalizar}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalIconCircle}>
              <Ionicons name="shield-checkmark" size={26} color={COLORS.primary} />
            </View>
            <Text style={styles.modalTitle}>Finalizar Atendimento</Text>
            <Text style={styles.modalSubtitle}>
              Peça ao cliente o código PIN gerado no app dele para confirmar a conclusão.
            </Text>

            <TextInput
              value={codigoPin}
              onChangeText={(t) => setCodigoPin(t.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="0000"
              placeholderTextColor={COLORS.gray}
              style={styles.pinInput}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={fecharModalFinalizar} disabled={finalizando}>
                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnConfirm, codigoPin.length !== 4 && { opacity: 0.5 }]}
                onPress={confirmarFinalizacao}
                disabled={finalizando || codigoPin.length !== 4}
              >
                {finalizando ? (
                  <ActivityIndicator color={COLORS.white} size="small" />
                ) : (
                  <Text style={styles.modalBtnConfirmText}>Confirmar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white, paddingTop: Platform.OS === 'android' ? 30 : 0 },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: { fontSize: 22, fontWeight: '900', color: COLORS.secondary, letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 12, color: COLORS.gray, marginTop: 2, fontWeight: '500' },
  profileBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  equipeBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.lightGray,
    borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center',
  },

  metricsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 8 },
  metricBox: {
    flex: 1, backgroundColor: COLORS.lightGray, borderRadius: 16, paddingVertical: 14,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  metricValue: { fontSize: 20, fontWeight: '900', color: COLORS.secondary },
  metricLabel: { fontSize: 10, color: COLORS.gray, fontWeight: '700', marginTop: 2, textTransform: 'uppercase' },

  listContent: { padding: 20, paddingTop: 12, gap: 12 },

  card: {
    backgroundColor: COLORS.white, borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '900', color: COLORS.primary },
  clienteNome: { fontSize: 15, fontWeight: '800', color: COLORS.secondary },
  servicoNome: { fontSize: 12, color: COLORS.gray, marginTop: 1, fontWeight: '500' },
  horaBox: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.lightGray, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  horaText: { fontSize: 11, fontWeight: '800', color: COLORS.secondary },

  cardFooterRow: { marginTop: 14, gap: 10 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusBadgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },

  finalizadoBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.successLight,
    borderWidth: 1, borderColor: '#D1FAE5', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
  },
  finalizadoText: { fontSize: 11, fontWeight: '700', color: COLORS.success, flex: 1 },

  actionsRow: { flexDirection: 'row', gap: 8 },
  btnAdiar: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.lightGray,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border,
  },
  btnAdiarText: { fontSize: 12, fontWeight: '700', color: COLORS.gray },
  btnPular: {
    width: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.dangerLight,
    borderRadius: 10, borderWidth: 1, borderColor: '#FEE2E2',
  },
  btnChamar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: COLORS.secondary, paddingVertical: 10, borderRadius: 10,
  },
  btnChamarText: { fontSize: 12, fontWeight: '800', color: COLORS.white },
  btnFinalizar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: COLORS.success, paddingVertical: 12, borderRadius: 12,
  },

  emptyContainer: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: COLORS.secondary, marginTop: 14 },
  emptySubtitle: { fontSize: 13, color: COLORS.gray, marginTop: 6, textAlign: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(17,24,39,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContainer: { backgroundColor: COLORS.white, borderRadius: 24, padding: 24, width: '100%', maxWidth: 380, alignItems: 'center' },
  modalIconCircle: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  modalTitle: { fontSize: 18, fontWeight: '900', color: COLORS.secondary, marginBottom: 6 },
  modalSubtitle: { fontSize: 12, color: COLORS.gray, textAlign: 'center', lineHeight: 18, marginBottom: 18 },
  pinInput: {
    width: '100%', textAlign: 'center', fontSize: 32, fontWeight: '900', letterSpacing: 16,
    color: COLORS.secondary, backgroundColor: COLORS.lightGray, borderRadius: 16,
    borderWidth: 2, borderColor: COLORS.border, paddingVertical: 14, marginBottom: 20,
  },
  modalActions: { flexDirection: 'row', gap: 10, width: '100%' },
  modalBtnCancel: { flex: 1, backgroundColor: COLORS.lightGray, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  modalBtnCancelText: { color: COLORS.secondary, fontWeight: '700' },
  modalBtnConfirm: { flex: 1, backgroundColor: COLORS.success, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  modalBtnConfirmText: { color: COLORS.white, fontWeight: '700' },
});
