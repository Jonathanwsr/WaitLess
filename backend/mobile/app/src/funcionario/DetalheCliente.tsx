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
  Image,
  RefreshControl,
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
  dangerLight: '#FEF2F2',
  indigo: '#4F46E5',
  indigoLight: '#EEF2FF',
};

const ENV_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api';
const cleanBaseUrl = ENV_URL.replace(/\/mobile\/?$/, '').replace(/\/+$/, '');
const API_URL = `${cleanBaseUrl}/mobile`;

interface Paciente {
  id: number;
  nome: string;
  email: string;
  telefone: string;
  foto: string;
  desde: string;
}

interface ProximoServico {
  id: number;
  data_formatada: string;
  hora: string;
  servico: string;
  profissional: string;
  tipo: string;
}

interface HistoricoItem {
  id: number;
  servico: string;
  profissional: string;
  data: string;
  status: string;
  valor_final?: number;
  finalizado_por?: string | null;
  hora_finalizacao?: string | null;
}

interface DetalheClienteData {
  paciente: Paciente;
  triagem: any;
  proximoServico: ProximoServico | null;
  financeiro: { total_gasto: number; pendente: number };
  historicoServicos: HistoricoItem[];
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
    case 'confirmado':
      return { bg: COLORS.indigoLight, text: COLORS.indigo };
    case 'finalizado':
      return { bg: COLORS.successLight, text: COLORS.success };
    case 'cancelado':
      return { bg: COLORS.dangerLight, text: COLORS.danger };
    default:
      return { bg: COLORS.warningLight, text: COLORS.warning };
  }
}

async function pegarToken() {
  return (await AsyncStorage.getItem('@waitless_token')) || (await AsyncStorage.getItem('@lokyva_token'));
}

export default function DetalheCliente() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const clienteId = params.id?.toString();

  const [dados, setDados] = useState<DetalheClienteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!clienteId) return;
    try {
      const token = await pegarToken();
      const res = await fetch(`${API_URL}/clientes/${clienteId}/detalhes`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const json = await res.json();
      if (!res.ok) {
        setErro(json.error || 'Não foi possível carregar o histórico deste cliente.');
        return;
      }
      setErro(null);
      setDados(json);
    } catch (e) {
      setErro('Erro de conexão ao carregar o histórico do cliente.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [clienteId]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const onRefresh = () => {
    setRefreshing(true);
    carregar();
  };

  const formatarMoeda = (v?: number) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Histórico do Cliente</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : erro ? (
        <View style={styles.centerBox}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.border} />
          <Text style={styles.erroText}>{erro}</Text>
        </View>
      ) : dados ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} colors={[COLORS.primary]} />}
        >
          {/* CARTÃO DO CLIENTE */}
          <View style={styles.clienteCard}>
            {dados.paciente.foto ? (
              <Image source={{ uri: dados.paciente.foto }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarPlaceholderText}>{dados.paciente.nome?.charAt(0)?.toUpperCase() || '?'}</Text>
              </View>
            )}
            <Text style={styles.clienteNome}>{dados.paciente.nome}</Text>
            <Text style={styles.clienteDesde}>Cliente desde {dados.paciente.desde}</Text>

            <View style={styles.contatoRow}>
              {dados.paciente.telefone && (
                <View style={styles.contatoItem}>
                  <Feather name="phone" size={13} color={COLORS.gray} />
                  <Text style={styles.contatoText}>{dados.paciente.telefone}</Text>
                </View>
              )}
              {dados.paciente.email && (
                <View style={styles.contatoItem}>
                  <Feather name="mail" size={13} color={COLORS.gray} />
                  <Text style={styles.contatoText} numberOfLines={1}>{dados.paciente.email}</Text>
                </View>
              )}
            </View>
          </View>

          {/* RESUMO FINANCEIRO */}
          <View style={styles.metricsRow}>
            <View style={styles.metricBox}>
              <Text style={[styles.metricValue, { color: COLORS.success }]}>{formatarMoeda(dados.financeiro.total_gasto)}</Text>
              <Text style={styles.metricLabel}>Total Gasto</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={[styles.metricValue, { color: dados.financeiro.pendente > 0 ? COLORS.warning : COLORS.secondary }]}>
                {formatarMoeda(dados.financeiro.pendente)}
              </Text>
              <Text style={styles.metricLabel}>Pendente</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricValue}>{dados.historicoServicos.length}</Text>
              <Text style={styles.metricLabel}>Atendimentos</Text>
            </View>
          </View>

          {/* PRÓXIMO SERVIÇO */}
          {dados.proximoServico && (
            <View style={styles.proximoCard}>
              <View style={styles.proximoIconWrap}>
                <Ionicons name="calendar" size={18} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.proximoTitulo}>Próximo: {dados.proximoServico.servico}</Text>
                <Text style={styles.proximoSub}>
                  {dados.proximoServico.data_formatada} às {dados.proximoServico.hora} • {dados.proximoServico.profissional}
                </Text>
              </View>
            </View>
          )}

          {/* HISTÓRICO */}
          <Text style={styles.sectionTitle}>Histórico de Atendimentos</Text>

          {dados.historicoServicos.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="calendar-blank-outline" size={48} color={COLORS.border} />
              <Text style={styles.emptyText}>Nenhum atendimento registrado ainda.</Text>
            </View>
          ) : (
            dados.historicoServicos.map((item) => {
              const cores = corStatus(item.status);
              return (
                <View key={item.id} style={styles.historicoCard}>
                  <View style={styles.historicoHeaderRow}>
                    <Text style={styles.historicoServico} numberOfLines={1}>{item.servico}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: cores.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: cores.text }]}>{STATUS_LABEL[item.status] || item.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.historicoMeta}>{item.data} • {item.profissional}</Text>
                  {typeof item.valor_final === 'number' && item.valor_final > 0 && (
                    <Text style={styles.historicoValor}>{formatarMoeda(item.valor_final)}</Text>
                  )}
                  {item.status === 'finalizado' && item.finalizado_por && (
                    <View style={styles.finalizadoBadge}>
                      <Ionicons name="checkmark-circle" size={12} color={COLORS.success} />
                      <Text style={styles.finalizadoText} numberOfLines={1}>
                        Finalizado por {item.finalizado_por}{item.hora_finalizacao ? ` às ${item.hora_finalizacao.substring(0, 5)}` : ''}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white, paddingTop: Platform.OS === 'android' ? 30 : 0 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '900', color: COLORS.secondary },

  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  erroText: { fontSize: 14, color: COLORS.gray, textAlign: 'center', marginTop: 12, fontWeight: '600' },

  scrollContent: { padding: 20, paddingBottom: 60 },

  clienteCard: { alignItems: 'center', marginBottom: 20 },
  avatar: { width: 84, height: 84, borderRadius: 42, marginBottom: 12, backgroundColor: COLORS.lightGray },
  avatarPlaceholder: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarPlaceholderText: { fontSize: 32, fontWeight: '900', color: COLORS.primary },
  clienteNome: { fontSize: 20, fontWeight: '900', color: COLORS.secondary },
  clienteDesde: { fontSize: 12, color: COLORS.gray, marginTop: 2, fontWeight: '500' },

  contatoRow: { flexDirection: 'row', gap: 16, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' },
  contatoItem: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: 180 },
  contatoText: { fontSize: 12, color: COLORS.gray, fontWeight: '500' },

  metricsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  metricBox: {
    flex: 1, backgroundColor: COLORS.lightGray, borderRadius: 16, paddingVertical: 14,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  metricValue: { fontSize: 15, fontWeight: '900', color: COLORS.secondary },
  metricLabel: { fontSize: 9, color: COLORS.gray, fontWeight: '700', marginTop: 4, textTransform: 'uppercase' },

  proximoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.primaryLight,
    borderRadius: 16, padding: 14, marginBottom: 24, borderWidth: 1, borderColor: '#FFE0CC',
  },
  proximoIconWrap: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
  },
  proximoTitulo: { fontSize: 13, fontWeight: '800', color: COLORS.secondary },
  proximoSub: { fontSize: 11, color: COLORS.gray, marginTop: 2, fontWeight: '500' },

  sectionTitle: { fontSize: 15, fontWeight: '900', color: COLORS.secondary, marginBottom: 12 },

  emptyContainer: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 13, color: COLORS.gray, marginTop: 10 },

  historicoCard: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  historicoHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  historicoServico: { flex: 1, fontSize: 14, fontWeight: '800', color: COLORS.secondary },
  statusBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  statusBadgeText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  historicoMeta: { fontSize: 11, color: COLORS.gray, marginTop: 6, fontWeight: '500' },
  historicoValor: { fontSize: 13, fontWeight: '800', color: COLORS.secondary, marginTop: 6 },

  finalizadoBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.successLight,
    borderWidth: 1, borderColor: '#D1FAE5', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, marginTop: 8,
  },
  finalizadoText: { fontSize: 10, fontWeight: '700', color: COLORS.success, flex: 1 },
});
