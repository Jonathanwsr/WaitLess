import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  RefreshControl,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
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
  indigo: '#4F46E5',
  indigoLight: '#EEF2FF',
};

const ENV_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api';
const cleanBaseUrl = ENV_URL.replace(/\/mobile\/?$/, '').replace(/\/+$/, '');
const API_URL = `${cleanBaseUrl}/mobile`;

interface AgendamentoResumo {
  id: number;
  usuario?: { id: number; name: string };
  servico?: { id: number; nome: string; valor?: number };
  data_agendamento: string;
  hora_agendamento?: string;
  status: string;
  valor_final?: number;
  finalizado_por?: { id: number; name: string } | null;
}

interface FuncionarioColuna {
  id: number;
  nome: string;
  cargo?: string;
  total_finalizados: number;
  faturamento: number;
  agendamentos: AgendamentoResumo[];
}

async function pegarToken() {
  return (await AsyncStorage.getItem('@waitless_token')) || (await AsyncStorage.getItem('@lokyva_token'));
}

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Aguardando',
  confirmado: 'Confirmado',
  em_atendimento: 'Em atendimento',
  finalizado: 'Finalizado',
};

function corStatus(status: string) {
  switch (status) {
    case 'em_atendimento':
    case 'confirmado':
      return { bg: COLORS.indigoLight, text: COLORS.indigo };
    case 'finalizado':
      return { bg: COLORS.successLight, text: COLORS.success };
    default:
      return { bg: COLORS.warningLight, text: COLORS.warning };
  }
}

export default function AgendaEquipe() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const estabelecimentoId = params.estabelecimento_id?.toString();

  const [periodo, setPeriodo] = useState<'hoje' | 'mes' | 'ano'>('hoje');
  const [funcionarios, setFuncionarios] = useState<FuncionarioColuna[]>([]);
  const [semFuncionario, setSemFuncionario] = useState<AgendamentoResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [modalAtribuir, setModalAtribuir] = useState<{ open: boolean; agendamento: AgendamentoResumo | null }>({
    open: false,
    agendamento: null,
  });

  const carregar = useCallback(async (periodoAtual: string) => {
    try {
      const token = await pegarToken();
      const query = new URLSearchParams({ periodo: periodoAtual });
      if (estabelecimentoId) query.append('estabelecimento_id', estabelecimentoId);

      const res = await fetch(`${API_URL}/equipe/agenda-produtividade?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const json = await res.json();
      if (!res.ok) {
        setErro(json.error || 'Não foi possível carregar o quadro da equipe.');
        return;
      }
      setErro(null);
      setFuncionarios(json.funcionarios || []);
      setSemFuncionario(json.semFuncionario || []);
    } catch (e) {
      setErro('Erro de conexão ao carregar o quadro da equipe.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [estabelecimentoId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      carregar(periodo);
    }, [carregar, periodo])
  );

  const onRefresh = () => {
    setRefreshing(true);
    carregar(periodo);
  };

  const abrirAtribuir = (item: AgendamentoResumo) => setModalAtribuir({ open: true, agendamento: item });
  const fecharAtribuir = () => setModalAtribuir({ open: false, agendamento: null });

  const atribuirFuncionario = async (funcionarioId: number) => {
    if (!modalAtribuir.agendamento) return;
    try {
      const token = await pegarToken();
      const res = await fetch(`${API_URL}/agendamentos/${modalAtribuir.agendamento.id}/funcionario`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ funcionario_id: funcionarioId }),
      });
      if (!res.ok) {
        Alert.alert('Erro', 'Não foi possível atribuir este cliente agora.');
        return;
      }
      fecharAtribuir();
      carregar(periodo);
    } catch (e) {
      Alert.alert('Erro de conexão', 'Tente novamente.');
    }
  };

  const formatarMoeda = (v?: number) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  const totalEquipeFaturamento = funcionarios.reduce((acc, f) => acc + Number(f.faturamento || 0), 0);
  const totalEquipeFinalizados = funcionarios.reduce((acc, f) => acc + Number(f.total_finalizados || 0), 0);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quadro da Equipe</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.periodoRow}>
        {(['hoje', 'mes', 'ano'] as const).map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[styles.periodoBtn, periodo === opt && styles.periodoBtnAtivo]}
            onPress={() => setPeriodo(opt)}
          >
            <Text style={[styles.periodoText, periodo === opt && styles.periodoTextAtivo]}>
              {opt === 'hoje' ? 'Hoje' : opt === 'mes' ? 'Mês' : 'Ano'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {erro ? (
        <View style={styles.centerBox}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.border} />
          <Text style={styles.erroText}>{erro}</Text>
        </View>
      ) : (
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} colors={[COLORS.primary]} />}>
          <View style={styles.metricsRow}>
            <View style={styles.metricBox}>
              <Text style={styles.metricValue}>{funcionarios.length}</Text>
              <Text style={styles.metricLabel}>Profissionais</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={[styles.metricValue, { color: COLORS.success }]}>{totalEquipeFinalizados}</Text>
              <Text style={styles.metricLabel}>Finalizados</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={[styles.metricValue, { color: COLORS.success }]}>{formatarMoeda(totalEquipeFaturamento)}</Text>
              <Text style={styles.metricLabel}>Faturamento</Text>
            </View>
          </View>

          {semFuncionario.length > 0 && (
            <View style={styles.semFuncionarioSection}>
              <View style={styles.colunaHeader}>
                <Ionicons name="alert-circle" size={16} color={COLORS.warning} />
                <Text style={styles.colunaTitulo}>Sem profissional definido ({semFuncionario.length})</Text>
              </View>
              {semFuncionario.map((item) => (
                <View key={item.id} style={styles.miniCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.miniCardNome} numberOfLines={1}>{item.usuario?.name || 'Cliente'}</Text>
                    <Text style={styles.miniCardServico} numberOfLines={1}>
                      {item.servico?.nome || 'Serviço'} • {item.hora_agendamento?.substring(0, 5)}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.btnAtribuir} onPress={() => abrirAtribuir(item)}>
                    <Text style={styles.btnAtribuirText}>Atribuir</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.colunasContainer}>
            {funcionarios.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="account-group-outline" size={48} color={COLORS.border} />
                <Text style={styles.emptyText}>Nenhum profissional ativo cadastrado.</Text>
              </View>
            ) : (
              funcionarios.map((func) => (
                <View key={func.id} style={styles.coluna}>
                  <View style={styles.colunaHeaderFunc}>
                    <View style={styles.colunaAvatar}>
                      <Text style={styles.colunaAvatarText}>{func.nome?.charAt(0)?.toUpperCase() || '?'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.colunaNome} numberOfLines={1}>{func.nome}</Text>
                      <Text style={styles.colunaCargo} numberOfLines={1}>{func.cargo || 'Profissional'}</Text>
                    </View>
                  </View>

                  <View style={styles.colunaStatsRow}>
                    <Text style={styles.colunaStatText}>{func.total_finalizados} finalizados</Text>
                    <Text style={[styles.colunaStatText, { color: COLORS.success }]}>{formatarMoeda(func.faturamento)}</Text>
                  </View>

                  {func.agendamentos.length === 0 ? (
                    <Text style={styles.colunaVazio}>Sem atendimentos no período.</Text>
                  ) : (
                    func.agendamentos.map((ag) => {
                      const cores = corStatus(ag.status);
                      return (
                        <View key={ag.id} style={styles.agendamentoCard}>
                          <View style={styles.agendamentoTopRow}>
                            <Text style={styles.agendamentoCliente} numberOfLines={1}>{ag.usuario?.name || 'Cliente'}</Text>
                            <View style={[styles.statusBadge, { backgroundColor: cores.bg }]}>
                              <Text style={[styles.statusBadgeText, { color: cores.text }]}>{STATUS_LABEL[ag.status] || ag.status}</Text>
                            </View>
                          </View>
                          <Text style={styles.agendamentoServico} numberOfLines={1}>{ag.servico?.nome}</Text>
                          <Text style={styles.agendamentoHora}>{ag.hora_agendamento?.substring(0, 5)}</Text>
                          {ag.status === 'finalizado' && ag.finalizado_por?.name && (
                            <Text style={styles.finalizadoPorText} numberOfLines={1}>Por {ag.finalizado_por.name}</Text>
                          )}
                        </View>
                      );
                    })
                  )}
                </View>
              ))
            )}
          </ScrollView>
        </ScrollView>
      )}

      {/* MODAL DE ATRIBUIÇÃO */}
      <Modal visible={modalAtribuir.open} transparent animationType="fade" onRequestClose={fecharAtribuir}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Atribuir Profissional</Text>
            <Text style={styles.modalSubtitle}>
              Cliente: {modalAtribuir.agendamento?.usuario?.name}
            </Text>

            <ScrollView style={{ maxHeight: 280 }}>
              {funcionarios.map((f) => (
                <TouchableOpacity key={f.id} style={styles.opcaoFuncionario} onPress={() => atribuirFuncionario(f.id)}>
                  <View style={styles.colunaAvatar}>
                    <Text style={styles.colunaAvatarText}>{f.nome?.charAt(0)?.toUpperCase() || '?'}</Text>
                  </View>
                  <Text style={styles.opcaoFuncionarioText}>{f.nome}</Text>
                  <Feather name="chevron-right" size={16} color={COLORS.gray} />
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.modalBtnCancel} onPress={fecharAtribuir}>
              <Text style={styles.modalBtnCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white, paddingTop: Platform.OS === 'android' ? 30 : 0 },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  erroText: { fontSize: 14, color: COLORS.gray, textAlign: 'center', marginTop: 12, fontWeight: '600' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '900', color: COLORS.secondary },

  periodoRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingVertical: 14 },
  periodoBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 10, backgroundColor: COLORS.lightGray, borderWidth: 1, borderColor: COLORS.border },
  periodoBtnAtivo: { backgroundColor: COLORS.secondary, borderColor: COLORS.secondary },
  periodoText: { fontSize: 12, fontWeight: '700', color: COLORS.gray },
  periodoTextAtivo: { color: COLORS.white },

  metricsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 16 },
  metricBox: {
    flex: 1, backgroundColor: COLORS.lightGray, borderRadius: 16, paddingVertical: 14,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  metricValue: { fontSize: 16, fontWeight: '900', color: COLORS.secondary },
  metricLabel: { fontSize: 9, color: COLORS.gray, fontWeight: '700', marginTop: 4, textTransform: 'uppercase' },

  semFuncionarioSection: { paddingHorizontal: 20, marginBottom: 20 },
  colunaHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  colunaTitulo: { fontSize: 13, fontWeight: '800', color: COLORS.secondary },

  miniCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.warningLight,
    borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#FDE68A',
  },
  miniCardNome: { fontSize: 13, fontWeight: '800', color: COLORS.secondary },
  miniCardServico: { fontSize: 11, color: COLORS.gray, marginTop: 2 },
  btnAtribuir: { backgroundColor: COLORS.secondary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  btnAtribuirText: { fontSize: 11, fontWeight: '800', color: COLORS.white },

  colunasContainer: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
  coluna: {
    width: 260, backgroundColor: COLORS.lightGray, borderRadius: 18, padding: 14,
    borderWidth: 1, borderColor: COLORS.border,
  },
  colunaHeaderFunc: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  colunaAvatar: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  colunaAvatarText: { fontSize: 14, fontWeight: '900', color: COLORS.primary },
  colunaNome: { fontSize: 13, fontWeight: '800', color: COLORS.secondary },
  colunaCargo: { fontSize: 10, color: COLORS.gray, marginTop: 1 },

  colunaStatsRow: {
    flexDirection: 'row', justifyContent: 'space-between', backgroundColor: COLORS.white,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border,
  },
  colunaStatText: { fontSize: 11, fontWeight: '700', color: COLORS.secondary },
  colunaVazio: { fontSize: 11, color: COLORS.gray, textAlign: 'center', paddingVertical: 20 },

  agendamentoCard: {
    backgroundColor: COLORS.white, borderRadius: 12, padding: 10, marginBottom: 8,
    borderWidth: 1, borderColor: COLORS.border,
  },
  agendamentoTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  agendamentoCliente: { flex: 1, fontSize: 12, fontWeight: '800', color: COLORS.secondary },
  statusBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  statusBadgeText: { fontSize: 8, fontWeight: '800', textTransform: 'uppercase' },
  agendamentoServico: { fontSize: 11, color: COLORS.gray, marginTop: 4 },
  agendamentoHora: { fontSize: 10, color: COLORS.gray, marginTop: 2, fontWeight: '600' },
  finalizadoPorText: { fontSize: 10, color: COLORS.success, marginTop: 4, fontWeight: '700' },

  emptyContainer: { alignItems: 'center', paddingVertical: 60, width: 300 },
  emptyText: { fontSize: 13, color: COLORS.gray, marginTop: 12, textAlign: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(17,24,39,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContainer: { backgroundColor: COLORS.white, borderRadius: 24, padding: 22, width: '100%', maxWidth: 380 },
  modalTitle: { fontSize: 17, fontWeight: '900', color: COLORS.secondary, marginBottom: 4 },
  modalSubtitle: { fontSize: 12, color: COLORS.gray, marginBottom: 16, fontWeight: '600' },
  opcaoFuncionario: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  opcaoFuncionarioText: { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.secondary },
  modalBtnCancel: { marginTop: 16, backgroundColor: COLORS.lightGray, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  modalBtnCancelText: { color: COLORS.secondary, fontWeight: '700' },
});
