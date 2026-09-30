import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { alertar } from '../../services/alertar';
import { obterEcho } from '../../services/echo';

const ENV_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';
const baseSemMobile = ENV_URL.replace(/\/mobile\/?$/, '').replace(/\/+$/, '');
const cleanBaseUrl = `${baseSemMobile}/mobile`;
const v1MobileUrl = `${baseSemMobile}/v1/mobile`;

// ==========================================
// INTERFACES TYPESCRIPT
// ==========================================
export interface Usuario {
  id: number;
  name: string;
  email: string;
  papel?: string;
}

export interface Estabelecimento {
  id: number;
  nome: string;
}

export interface Funcionario {
  id: number;
  estabelecimento_id: number;
  usuario_id?: number;
  nome: string;
  cargo: string;
  telefone?: string;
  ativo: boolean;
  total_atendimentos?: number;
  faturamento_total?: number;
  avaliacao_media?: number;
  usuario?: Usuario;
  estabelecimento?: Estabelecimento;
}

export interface AtividadeEquipe {
  id: number | string;
  acao: string;
  descricao: string;
  nome_usuario?: string;
  created_at: string;
}

const CARGOS: { valor: string; label: string; premium: boolean }[] = [
  { valor: 'Atendente', label: 'Atendente', premium: false },
  { valor: 'Gerente', label: 'Gerente', premium: true },
  { valor: 'Sócio', label: 'Sócio', premium: true },
];

const ACAO_COR: Record<string, string> = {
  chamou: '#2563EB',
  finalizou: '#16A34A',
  status_atualizado: '#D97706',
  adiou: '#EA580C',
  pulou: '#DC2626',
};

async function pegarToken() {
  return (await AsyncStorage.getItem('@lokyva_token')) || (await AsyncStorage.getItem('@waitless_token'));
}

export default function FuncionariosScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const estabelecimentoIdParam = Array.isArray(params.id) ? params.id[0] : params.id;

  const [activeTab, setActiveTab] = useState<'equipe' | 'folgas' | 'fechamentos'>('equipe');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [estabelecimentoId, setEstabelecimentoId] = useState<number | null>(
    estabelecimentoIdParam ? Number(estabelecimentoIdParam) : null
  );

  const [estabelecimentos, setEstabelecimentos] = useState<Estabelecimento[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [ausenciasPendentes, setAusenciasPendentes] = useState<any[]>([]);
  const [fechamentosRecentes, setFechamentosRecentes] = useState<any[]>([]);
  const [podeGerenciarEquipeAvancada, setPodeGerenciarEquipeAvancada] = useState(false);
  const [atividades, setAtividades] = useState<AtividadeEquipe[]>([]);
  const [mostrarExplicacaoPapeis, setMostrarExplicacaoPapeis] = useState(false);

  const getHeaders = (t: string | null) => ({
    Authorization: `Bearer ${t}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  });

  const carregarDados = useCallback(async () => {
    const t = await pegarToken();
    if (!t) {
      router.replace('/autenticacao/login' as never);
      return;
    }
    setToken(t);

    try {
      let idParaBuscar = estabelecimentoId;

      // Sem id na URL: usa o estabelecimento "atual" do dono (endpoint geral).
      if (!idParaBuscar) {
        const resGeral = await fetch(`${cleanBaseUrl}/configuracoes`, { headers: getHeaders(t) });
        const dataGeral = await resGeral.json();
        idParaBuscar = dataGeral?.estabelecimento?.id || dataGeral?.meusEstabelecimentos?.[0]?.id || null;
        if (idParaBuscar) setEstabelecimentoId(idParaBuscar);
      }

      if (!idParaBuscar) {
        alertar('Nenhum local encontrado', 'Cadastre um estabelecimento antes de gerenciar a equipe.');
        setLoading(false);
        return;
      }

      const res = await fetch(`${cleanBaseUrl}/configuracoes/${idParaBuscar}`, { headers: getHeaders(t) });
      const data = await res.json();

      if (!res.ok) {
        alertar('Erro', data?.message || 'Não foi possível carregar a equipe.');
        setLoading(false);
        return;
      }

      setEstabelecimentos(data.meusEstabelecimentos || []);
      setFuncionarios((data.funcionarios || []).filter((f: Funcionario) => f.ativo !== false));
      setPodeGerenciarEquipeAvancada(!!data.podeGerenciarEquipeAvancada);
      setAtividades(data.atividadesRecentes || []);
    } catch (error) {
      console.log('Erro ao carregar equipe:', error);
      alertar('Erro de conexão', 'Não foi possível carregar os dados agora.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [estabelecimentoId, router]);

  useEffect(() => {
    carregarDados();
  }, []);

  // Atividade da equipe em tempo real (mesmo canal usado no painel web).
  useEffect(() => {
    if (!estabelecimentoId) return;
    const canalNome = `atividade-equipe.${estabelecimentoId}`;
    let cancelado = false;

    obterEcho().then((echo) => {
      if (cancelado) return;
      echo.private(canalNome).listen('.atividade.registrada', (payload: any) => {
        setAtividades((atual) => [{ id: `live-${Date.now()}`, ...payload }, ...atual].slice(0, 30));
      });
    });

    return () => {
      cancelado = true;
      obterEcho().then((echo) => echo.leave(canalNome));
    };
  }, [estabelecimentoId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await carregarDados();
  };

  const formatarHora = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // ==========================================
  // MODAL CRIAR/EDITAR
  // ==========================================
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [savingLoading, setSavingLoading] = useState(false);

  const [form, setForm] = useState({
    estabelecimento_id: estabelecimentoId || 0,
    nome: '',
    telefone: '',
    cargo: 'Atendente',
    email: '',
    password: '',
  });

  const handleOpenCreateModal = () => {
    setEditingId(null);
    setForm({
      estabelecimento_id: estabelecimentoId || estabelecimentos[0]?.id || 0,
      nome: '',
      telefone: '',
      cargo: 'Atendente',
      email: '',
      password: '',
    });
    setModalVisible(true);
  };

  const handleOpenEditModal = (func: Funcionario) => {
    setEditingId(func.id);
    setForm({
      estabelecimento_id: func.estabelecimento_id,
      nome: func.nome,
      telefone: func.telefone || '',
      cargo: ['Atendente', 'Gerente'].includes(func.cargo) ? func.cargo : 'Atendente',
      email: func.usuario?.email || '',
      password: '',
    });
    setModalVisible(true);
  };

  const handleSubmitForm = async () => {
    if (!form.nome || !form.cargo) {
      alertar('Atenção', 'Preencha o nome e o cargo do colaborador.');
      return;
    }
    if (!editingId && (!form.email || !form.password)) {
      alertar('Atenção', 'E-mail e senha são obrigatórios para novo acesso.');
      return;
    }

    setSavingLoading(true);
    try {
      let res: Response;
      if (editingId) {
        res = await fetch(`${v1MobileUrl}/funcionarios/${editingId}`, {
          method: 'PUT',
          headers: getHeaders(token),
          body: JSON.stringify(form),
        });
      } else if (form.cargo === 'Sócio') {
        res = await fetch(`${v1MobileUrl}/estabelecimentos/${form.estabelecimento_id}/socios`, {
          method: 'POST',
          headers: getHeaders(token),
          body: JSON.stringify(form),
        });
      } else {
        res = await fetch(`${v1MobileUrl}/estabelecimentos/${form.estabelecimento_id}/funcionarios`, {
          method: 'POST',
          headers: getHeaders(token),
          body: JSON.stringify(form),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        alertar('Não foi possível salvar', data?.message || 'Verifique os dados e tente novamente.');
      } else {
        setModalVisible(false);
        alertar('Sucesso', data?.message || 'Salvo com sucesso!');
        carregarDados();
      }
    } catch (error) {
      alertar('Erro de conexão', 'Tente novamente em instantes.');
    } finally {
      setSavingLoading(false);
    }
  };

  const handleDelete = (func: Funcionario) => {
    alertar(
      'Inativar Colaborador',
      `Deseja realmente remover ${func.nome} da equipe?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Inativar',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${v1MobileUrl}/funcionarios/${func.id}`, {
                method: 'DELETE',
                headers: getHeaders(token),
              });
              const data = await res.json();
              if (!res.ok) {
                alertar('Erro', data?.message || 'Não foi possível inativar.');
                return;
              }
              setFuncionarios((prev) => prev.filter((f) => f.id !== func.id));
              alertar('Concluído', 'Funcionário inativado.');
            } catch {
              alertar('Erro de conexão', 'Tente novamente em instantes.');
            }
          },
        },
      ]
    );
  };

  const funcionariosFiltrados = funcionarios.filter(
    (f) =>
      f.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.cargo.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalFaturamentoEquipe = funcionarios.reduce((acc, item) => acc + (item.faturamento_total || 0), 0);
  const totalAtendimentosEquipe = funcionarios.reduce((acc, item) => acc + (item.total_atendimentos || 0), 0);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#FF7A00" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backButton} onPress={() => (router.canGoBack() ? router.back() : router.replace('/Proprietario/dashboard' as never))}>
            <Ionicons name="chevron-back" size={20} color="#3A3A3A" />
            <Text style={styles.backButtonText}>Painel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>GESTAO DE EQUIPE</Text>
          <TouchableOpacity style={styles.addButtonCircle} onPress={handleOpenCreateModal}>
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.explicacaoBtn} onPress={() => setMostrarExplicacaoPapeis(true)}>
          <Ionicons name="sparkles" size={13} color="#6366F1" />
          <Text style={styles.explicacaoBtnText}>Como funcionam os papéis (Atendente, Gerente, Sócio)</Text>
        </TouchableOpacity>

        <View style={styles.statsCardContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Membros</Text>
            <Text style={styles.statValue}>{funcionarios.length}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Atendimentos</Text>
            <Text style={styles.statValue}>{totalAtendimentosEquipe}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Faturamento Total</Text>
            <Text style={[styles.statValue, { color: '#00A868' }]}>
              R$ {totalFaturamentoEquipe.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </Text>
          </View>
        </View>

        <View style={styles.segmentedContainer}>
          <TouchableOpacity style={[styles.segmentTab, activeTab === 'equipe' && styles.segmentTabActive]} onPress={() => setActiveTab('equipe')}>
            <Ionicons name="people-outline" size={16} color={activeTab === 'equipe' ? '#FFFFFF' : '#6A6C72'} />
            <Text style={[styles.segmentText, activeTab === 'equipe' && styles.segmentTextActive]}>Equipe</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.segmentTab, activeTab === 'folgas' && styles.segmentTabActive]} onPress={() => setActiveTab('folgas')}>
            <Ionicons name="calendar-outline" size={16} color={activeTab === 'folgas' ? '#FFFFFF' : '#6A6C72'} />
            <Text style={[styles.segmentText, activeTab === 'folgas' && styles.segmentTextActive]}>Folgas</Text>
            {ausenciasPendentes.length > 0 && (
              <View style={styles.badgeCount}>
                <Text style={styles.badgeText}>{ausenciasPendentes.length}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={[styles.segmentTab, activeTab === 'fechamentos' && styles.segmentTabActive]} onPress={() => setActiveTab('fechamentos')}>
            <Ionicons name="cash-outline" size={16} color={activeTab === 'fechamentos' ? '#FFFFFF' : '#6A6C72'} />
            <Text style={[styles.segmentText, activeTab === 'fechamentos' && styles.segmentTextActive]}>Produção</Text>
          </TouchableOpacity>
        </View>
      </View>

      {activeTab === 'equipe' && (
        <View style={styles.contentFlex}>
          {/* ATIVIDADE DA EQUIPE EM TEMPO REAL */}
          <View style={styles.atividadeCard}>
            <View style={styles.atividadeHeader}>
              <Ionicons name="flash" size={14} color="#F59E0B" />
              <Text style={styles.atividadeTitulo}>Atividade em tempo real</Text>
              <View style={styles.aoVivoDot} />
              <Text style={styles.aoVivoText}>ao vivo</Text>
            </View>
            {atividades.length === 0 ? (
              <Text style={styles.atividadeVazia}>Nenhuma atividade ainda. Ações da equipe na fila vão aparecer aqui.</Text>
            ) : (
              atividades.slice(0, 5).map((a) => (
                <View key={a.id} style={styles.atividadeItem}>
                  <View style={[styles.atividadeBadge, { backgroundColor: `${ACAO_COR[a.acao] || '#6A6C72'}1A` }]}>
                    <Text style={[styles.atividadeBadgeText, { color: ACAO_COR[a.acao] || '#6A6C72' }]}>{a.acao?.replace('_', ' ')}</Text>
                  </View>
                  <Text style={styles.atividadeDescricao} numberOfLines={1}>{a.descricao}</Text>
                  <Text style={styles.atividadeHora}>{formatarHora(a.created_at)}</Text>
                </View>
              ))
            )}
          </View>

          <View style={styles.searchBarContainer}>
            <Ionicons name="search-outline" size={18} color="#A0A2A8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar colaborador ou cargo..."
              placeholderTextColor="#A0A2A8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery !== '' && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#A0A2A8" />
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={funcionariosFiltrados}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listPadding}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="account-group-outline" size={48} color="#E1E2E5" />
                <Text style={styles.emptyTitle}>Nenhum profissional encontrado</Text>
                <Text style={styles.emptySubtitle}>Cadastre novos colaboradores no botão "+".</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.employeeCard}>
                <View style={styles.employeeHeader}>
                  <View style={styles.avatarBox}>
                    <Text style={styles.avatarText}>{item.nome.charAt(0).toUpperCase()}</Text>
                  </View>

                  <View style={styles.employeeInfo}>
                    <Text style={styles.employeeName}>{item.nome}</Text>
                    <View style={styles.cargoRow}>
                      <Text style={styles.employeeRole}>{item.cargo}</Text>
                      {item.cargo === 'Gerente' && (
                        <View style={styles.cargoBadge}><Text style={styles.cargoBadgeText}>Gerente</Text></View>
                      )}
                    </View>
                    {item.estabelecimento && (
                      <View style={styles.storeBadge}>
                        <Ionicons name="business" size={10} color="#6A6C72" />
                        <Text style={styles.storeBadgeText}>{item.estabelecimento.nome}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.ratingBox}>
                    <Ionicons name="star" size={14} color="#F59E0B" />
                    <Text style={styles.ratingText}>{item.avaliacao_media ? item.avaliacao_media.toFixed(1) : '5.0'}</Text>
                  </View>
                </View>

                <View style={styles.employeeMetricsRow}>
                  <View style={styles.metricSubBox}>
                    <Text style={styles.metricSubLabel}>Atendimentos</Text>
                    <Text style={styles.metricSubVal}>{item.total_atendimentos || 0}</Text>
                  </View>
                  <View style={styles.metricSubBox}>
                    <Text style={styles.metricSubLabel}>Faturamento</Text>
                    <Text style={[styles.metricSubVal, { color: '#00A868' }]}>R$ {(item.faturamento_total || 0).toFixed(2)}</Text>
                  </View>
                  <View style={styles.metricSubBox}>
                    <Text style={styles.metricSubLabel}>E-mail</Text>
                    <Text style={styles.metricSubValSmall} numberOfLines={1}>{item.usuario?.email || 'N/A'}</Text>
                  </View>
                </View>

                <View style={styles.employeeCardFooter}>
                  <TouchableOpacity style={styles.actionBtnOutline} onPress={() => handleOpenEditModal(item)}>
                    <Feather name="edit-2" size={14} color="#282828" />
                    <Text style={styles.actionBtnText}>Editar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtnDanger} onPress={() => handleDelete(item)}>
                    <Feather name="trash-2" size={14} color="#EF4444" />
                    <Text style={styles.actionBtnDangerText}>Inativar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        </View>
      )}

      {activeTab === 'folgas' && (
        <ScrollView style={styles.contentFlex} contentContainerStyle={styles.listPadding} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
          <Text style={styles.sectionTitle}>Solicitações de Ausência Pendentes</Text>
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-circle-outline" size={48} color="#00A868" />
            <Text style={styles.emptyTitle}>Tudo em dia!</Text>
            <Text style={styles.emptySubtitle}>Nenhuma solicitação de folga para aprovar.</Text>
          </View>
        </ScrollView>
      )}

      {activeTab === 'fechamentos' && (
        <ScrollView style={styles.contentFlex} contentContainerStyle={styles.listPadding} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
          <Text style={styles.sectionTitle}>Fechamentos Diários Recentes</Text>
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={48} color="#E1E2E5" />
            <Text style={styles.emptyTitle}>Nenhum fechamento ainda</Text>
          </View>
        </ScrollView>
      )}

      {/* MODAL: CADASTRAR OU EDITAR */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingId ? 'Editar Colaborador' : form.cargo === 'Sócio' ? 'Convidar Sócio' : 'Novo Colaborador'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6A6C72" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Unidade / Estabelecimento *</Text>
              <View style={styles.pickerContainer}>
                {estabelecimentos.map((est) => (
                  <TouchableOpacity
                    key={est.id}
                    style={[styles.pickerOption, form.estabelecimento_id === est.id && styles.pickerOptionActive]}
                    onPress={() => setForm({ ...form, estabelecimento_id: est.id })}
                  >
                    <Text style={[styles.pickerOptionText, form.estabelecimento_id === est.id && styles.pickerOptionTextActive]}>{est.nome}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Nome Completo *</Text>
              <TextInput style={styles.modalInput} placeholder="Ex: João da Silva" placeholderTextColor="#A0A2A8" value={form.nome} onChangeText={(text) => setForm({ ...form, nome: text })} />

              {!editingId && (
                <>
                  <Text style={styles.inputLabel}>Papel *</Text>
                  <View style={styles.pickerContainer}>
                    {CARGOS.map(({ valor, label, premium }) => {
                      const bloqueado = premium && !podeGerenciarEquipeAvancada;
                      return (
                        <TouchableOpacity
                          key={valor}
                          disabled={bloqueado}
                          style={[styles.pickerOption, form.cargo === valor && styles.pickerOptionActive, bloqueado && styles.pickerOptionLocked]}
                          onPress={() => setForm({ ...form, cargo: valor })}
                        >
                          {bloqueado && <Ionicons name="lock-closed" size={10} color="#A0A2A8" style={{ marginRight: 4 }} />}
                          <Text style={[styles.pickerOptionText, form.cargo === valor && styles.pickerOptionTextActive, bloqueado && { color: '#C1C2C6' }]}>{label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {!podeGerenciarEquipeAvancada && (
                    <Text style={styles.avisoPremium}>Gerente e Sócio são exclusivos do plano Sócio Premium.</Text>
                  )}
                </>
              )}
              {editingId && (
                <>
                  <Text style={styles.inputLabel}>Cargo *</Text>
                  <View style={styles.pickerContainer}>
                    {CARGOS.filter((c) => c.valor !== 'Sócio').map(({ valor, label, premium }) => {
                      const bloqueado = premium && !podeGerenciarEquipeAvancada;
                      return (
                        <TouchableOpacity
                          key={valor}
                          disabled={bloqueado}
                          style={[styles.pickerOption, form.cargo === valor && styles.pickerOptionActive, bloqueado && styles.pickerOptionLocked]}
                          onPress={() => setForm({ ...form, cargo: valor })}
                        >
                          {bloqueado && <Ionicons name="lock-closed" size={10} color="#A0A2A8" style={{ marginRight: 4 }} />}
                          <Text style={[styles.pickerOptionText, form.cargo === valor && styles.pickerOptionTextActive, bloqueado && { color: '#C1C2C6' }]}>{label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              <Text style={styles.inputLabel}>Telefone / WhatsApp</Text>
              <TextInput style={styles.modalInput} placeholder="(00) 00000-0000" placeholderTextColor="#A0A2A8" keyboardType="phone-pad" value={form.telefone} onChangeText={(text) => setForm({ ...form, telefone: text })} />

              <Text style={styles.inputLabel}>E-mail de Acesso *</Text>
              <TextInput style={styles.modalInput} placeholder="usuario@email.com" placeholderTextColor="#A0A2A8" keyboardType="email-address" autoCapitalize="none" value={form.email} onChangeText={(text) => setForm({ ...form, email: text })} />

              <Text style={styles.inputLabel}>{editingId ? 'Nova Senha (deixe em branco p/ manter)' : 'Senha de Acesso *'}</Text>
              <TextInput style={styles.modalInput} placeholder="••••••••" placeholderTextColor="#A0A2A8" secureTextEntry value={form.password} onChangeText={(text) => setForm({ ...form, password: text })} />

              <TouchableOpacity style={[styles.saveModalButton, form.cargo === 'Sócio' && { backgroundColor: '#4F46E5' }]} onPress={handleSubmitForm} disabled={savingLoading}>
                {savingLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveModalButtonText}>
                    {editingId ? 'SALVAR ALTERAÇÕES' : form.cargo === 'Sócio' ? 'CONVIDAR SÓCIO' : 'CADASTRAR COLABORADOR'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL: COMO FUNCIONAM OS PAPÉIS */}
      <Modal visible={mostrarExplicacaoPapeis} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.modalHeader, { marginBottom: 4 }]}>
              <Text style={styles.modalTitle}>Papéis na sua equipe</Text>
              <TouchableOpacity onPress={() => setMostrarExplicacaoPapeis(false)}>
                <Ionicons name="close" size={24} color="#6A6C72" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.papelCard}>
                <View style={[styles.papelIconWrap, { backgroundColor: '#DBEAFE' }]}>
                  <Ionicons name="person-outline" size={20} color="#2563EB" />
                </View>
                <Text style={styles.papelTitulo}>Atendente</Text>
                <Text style={styles.papelPlano}>Todo plano, sem custo extra</Text>
                <Text style={styles.papelDesc}>• Atende a fila do dia a dia{'\n'}• Chama, finaliza e adia clientes{'\n'}• Não vê financeiro nem configurações</Text>
              </View>

              <View style={[styles.papelCard, { borderColor: '#C7D2FE', borderWidth: 2 }]}>
                <View style={styles.papelBadgePremium}><Text style={styles.papelBadgePremiumText}>Plano Sócio Premium</Text></View>
                <View style={[styles.papelIconWrap, { backgroundColor: '#E0E7FF' }]}>
                  <Ionicons name="briefcase-outline" size={20} color="#4F46E5" />
                </View>
                <Text style={styles.papelTitulo}>Gerente</Text>
                <Text style={styles.papelPlano}>Quase tudo que o sócio vê</Text>
                <Text style={styles.papelDesc}>• Administra agenda, equipe e catálogo{'\n'}• Vê relatórios, cupons e contratos{'\n'}• Não acessa a Carteira nem a assinatura</Text>
              </View>

              <View style={[styles.papelCard, { borderColor: '#A7F3D0', borderWidth: 2 }]}>
                <View style={[styles.papelBadgePremium, { backgroundColor: '#059669' }]}><Text style={styles.papelBadgePremiumText}>Plano Sócio Premium</Text></View>
                <View style={[styles.papelIconWrap, { backgroundColor: '#D1FAE5' }]}>
                  <Ionicons name="person-add-outline" size={20} color="#059669" />
                </View>
                <Text style={styles.papelTitulo}>Sócio</Text>
                <Text style={styles.papelPlano}>Acesso total, como você</Text>
                <Text style={styles.papelDesc}>• Administra tudo, sem restrições{'\n'}• Acessa a Carteira e o dinheiro recebido{'\n'}• Pode gerenciar a assinatura da plataforma</Text>
              </View>

              {!podeGerenciarEquipeAvancada && (
                <View style={styles.avisoPremiumBox}>
                  <Ionicons name="lock-closed" size={14} color="#B45309" />
                  <Text style={styles.avisoPremiumBoxText}>Assine o plano Sócio Premium em "Minha assinatura" para liberar Gerente e Sócio.</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  contentFlex: { flex: 1 },
  header: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E6E7E9', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  backButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F0F2', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  backButtonText: { fontSize: 12, fontWeight: '600', color: '#282828' },
  headerTitle: { fontSize: 12, fontWeight: '800', color: '#282828', letterSpacing: 0.8 },
  addButtonCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FF7A00', justifyContent: 'center', alignItems: 'center' },

  explicacaoBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: '#EEF2FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 12 },
  explicacaoBtnText: { fontSize: 10, fontWeight: '700', color: '#4F46E5' },

  statsCardContainer: { flexDirection: 'row', backgroundColor: '#F0F0F2', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  statBox: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 10, fontWeight: '600', color: '#6A6C72' },
  statValue: { fontSize: 13, fontWeight: '800', color: '#282828', marginTop: 2 },
  statDivider: { width: 1, height: 24, backgroundColor: '#E1E2E5' },

  segmentedContainer: { flexDirection: 'row', backgroundColor: '#F0F0F2', borderRadius: 10, padding: 3 },
  segmentTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 8, gap: 6 },
  segmentTabActive: { backgroundColor: '#282828' },
  segmentText: { fontSize: 11, fontWeight: '700', color: '#6A6C72' },
  segmentTextActive: { color: '#FFFFFF' },
  badgeCount: { backgroundColor: '#EF4444', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  badgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },

  atividadeCard: { backgroundColor: '#FFFFFF', borderRadius: 16, marginHorizontal: 16, marginTop: 12, padding: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  atividadeHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  atividadeTitulo: { fontSize: 12, fontWeight: '800', color: '#282828' },
  aoVivoDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E', marginLeft: 'auto' },
  aoVivoText: { fontSize: 10, fontWeight: '700', color: '#16A34A' },
  atividadeVazia: { fontSize: 11, color: '#A0A2A8' },
  atividadeItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  atividadeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  atividadeBadgeText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  atividadeDescricao: { fontSize: 11, color: '#282828', flex: 1 },
  atividadeHora: { fontSize: 10, color: '#A0A2A8' },

  searchBarContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', marginHorizontal: 16, marginTop: 12, marginBottom: 4, paddingHorizontal: 12, borderRadius: 20, height: 42, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 12, color: '#282828' },

  listPadding: { padding: 16, gap: 12 },

  employeeCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  employeeHeader: { flexDirection: 'row', alignItems: 'center' },
  avatarBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#F0F0F2', borderWidth: 1, borderColor: '#FFEDD5', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontWeight: '800', color: '#282828' },
  employeeInfo: { flex: 1, marginLeft: 12 },
  employeeName: { fontSize: 14, fontWeight: '700', color: '#282828' },
  cargoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  employeeRole: { fontSize: 11, color: '#6A6C72', marginTop: 1 },
  cargoBadge: { backgroundColor: '#E0E7FF', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  cargoBadgeText: { fontSize: 9, fontWeight: '800', color: '#4F46E5' },
  storeBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 3 },
  storeBadgeText: { fontSize: 10, color: '#6A6C72', fontWeight: '500' },
  ratingBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4 },
  ratingText: { fontSize: 11, fontWeight: '700', color: '#B45309' },

  employeeMetricsRow: { flexDirection: 'row', backgroundColor: '#F5F5F5', borderRadius: 10, padding: 10, marginTop: 12, justifyContent: 'space-between' },
  metricSubBox: { flex: 1 },
  metricSubLabel: { fontSize: 9, color: '#A0A2A8', fontWeight: '600', textTransform: 'uppercase' },
  metricSubVal: { fontSize: 12, fontWeight: '700', color: '#282828', marginTop: 2 },
  metricSubValSmall: { fontSize: 10, color: '#6A6C72', marginTop: 2 },

  employeeCardFooter: { flexDirection: 'row', marginTop: 12, gap: 8 },
  actionBtnOutline: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E1E2E5', borderRadius: 8, paddingVertical: 8, gap: 6 },
  actionBtnText: { fontSize: 11, fontWeight: '600', color: '#282828' },
  actionBtnDanger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF2F2', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, gap: 4 },
  actionBtnDangerText: { fontSize: 11, fontWeight: '600', color: '#EF4444' },

  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#282828', marginBottom: 8 },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: '#6A6C72', marginTop: 8 },
  emptySubtitle: { fontSize: 11, color: '#A0A2A8', marginTop: 2 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#282828' },
  inputLabel: { fontSize: 11, fontWeight: '700', color: '#282828', marginBottom: 4, marginTop: 10 },
  modalInput: { backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#E1E2E5', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 12, color: '#282828' },
  pickerContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickerOption: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E1E2E5', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#FFFFFF' },
  pickerOptionActive: { backgroundColor: '#282828', borderColor: '#282828' },
  pickerOptionLocked: { backgroundColor: '#F5F5F5', borderStyle: 'dashed' },
  pickerOptionText: { fontSize: 11, fontWeight: '600', color: '#6A6C72' },
  pickerOptionTextActive: { color: '#FFFFFF' },
  avisoPremium: { fontSize: 10, color: '#B45309', marginTop: 6 },
  saveModalButton: { backgroundColor: '#12A150', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 20, marginBottom: 10 },
  saveModalButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },

  papelCard: { backgroundColor: '#F9FAFB', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F0F0F2' },
  papelIconWrap: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  papelTitulo: { fontSize: 14, fontWeight: '800', color: '#282828' },
  papelPlano: { fontSize: 10, fontWeight: '700', color: '#4F46E5', textTransform: 'uppercase', marginTop: 2, marginBottom: 8 },
  papelDesc: { fontSize: 11, color: '#6A6C72', lineHeight: 18 },
  papelBadgePremium: { position: 'absolute', top: -8, right: 12, backgroundColor: '#4F46E5', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  papelBadgePremiumText: { fontSize: 9, fontWeight: '800', color: '#FFFFFF' },
  avisoPremiumBox: { flexDirection: 'row', gap: 6, backgroundColor: '#FEF3C7', borderRadius: 12, padding: 12, marginBottom: 10 },
  avisoPremiumBoxText: { flex: 1, fontSize: 11, color: '#92400E' },
});
