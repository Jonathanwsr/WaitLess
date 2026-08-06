import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Ionicons,
  MaterialCommunityIcons,
  Feather,
} from '@expo/vector-icons';

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

export interface AusenciaPendente {
  id: number;
  funcionario_id: number;
  funcionario_nome: string;
  loja_nome: string;
  motivo?: string;
  data_inicio: string;
  data_fim: string;
  status: 'pendente' | 'aprovado' | 'recusado';
}

export interface FechamentoRecente {
  id: number;
  funcionario_id: number;
  funcionario_nome: string;
  data_fechamento: string;
  valor_total: number;
}

interface Props {
  onBack?: () => void;
  // Métodos de integração com API
  fetchData?: () => Promise<void>;
  onStoreFuncionario?: (data: any) => Promise<boolean>;
  onUpdateFuncionario?: (id: number, data: any) => Promise<boolean>;
  onDeleteFuncionario?: (id: number) => Promise<boolean>;
  onDecidirAusencia?: (id: number, status: 'aprovado' | 'recusado') => Promise<boolean>;
}

export default function FuncionariosScreen({
  onBack,
  fetchData,
  onStoreFuncionario,
  onUpdateFuncionario,
  onDeleteFuncionario,
  onDecidirAusencia,
}: Props) {
  // ==========================================
  // ESTADOS PRINCIPAIS
  // ==========================================
  const [activeTab, setActiveTab] = useState<'equipe' | 'folgas' | 'fechamentos'>('equipe');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Dados recebidos da API ou Mocks para preview
  const [estabelecimentos, setEstabelecimentos] = useState<Estabelecimento[]>([
    { id: 1, nome: 'Barbearia VIP - Centro' },
    { id: 2, nome: 'Barbearia VIP - Shopping' },
  ]);

  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([
    {
      id: 101,
      estabelecimento_id: 1,
      nome: 'Carlos Eduardo',
      cargo: 'Barbeiro Senior',
      telefone: '(11) 98888-7777',
      ativo: true,
      total_atendimentos: 48,
      faturamento_total: 2890.0,
      avaliacao_media: 4.9,
      estabelecimento: { id: 1, nome: 'Barbearia VIP - Centro' },
      usuario: { id: 1, name: 'Carlos Eduardo', email: 'carlos@loja.com' },
    },
    {
      id: 102,
      estabelecimento_id: 1,
      nome: 'Mariana Lima',
      cargo: 'Manicure & Estética',
      telefone: '(11) 97777-6666',
      ativo: true,
      total_atendimentos: 32,
      faturamento_total: 1650.0,
      avaliacao_media: 4.8,
      estabelecimento: { id: 1, nome: 'Barbearia VIP - Centro' },
      usuario: { id: 2, name: 'Mariana Lima', email: 'mariana@loja.com' },
    },
  ]);

  const [ausenciasPendentes, setAusenciasPendentes] = useState<AusenciaPendente[]>([
    {
      id: 1,
      funcionario_id: 101,
      funcionario_nome: 'Carlos Eduardo',
      loja_nome: 'Barbearia VIP - Centro',
      motivo: 'Consulta médica agendada',
      data_inicio: '15/08/2026',
      data_fim: '15/08/2026',
      status: 'pendente',
    },
  ]);

  const [fechamentosRecentes, setFechamentosRecentes] = useState<FechamentoRecente[]>([
    {
      id: 1,
      funcionario_id: 101,
      funcionario_nome: 'Carlos Eduardo',
      data_fechamento: '02/08/2026',
      valor_total: 350.0,
    },
    {
      id: 2,
      funcionario_id: 102,
      funcionario_nome: 'Mariana Lima',
      data_fechamento: '02/08/2026',
      valor_total: 220.0,
    },
  ]);

  // ==========================================
  // ESTADOS DE MODAL (CRIAR / EDITAR)
  // ==========================================
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [savingLoading, setSavingLoading] = useState(false);

  const [form, setForm] = useState({
    estabelecimento_id: 1,
    nome: '',
    telefone: '',
    cargo: '',
    email: '',
    password: '',
  });

  // Atualizar lista
  const handleRefresh = async () => {
    setRefreshing(true);
    if (fetchData) await fetchData();
    setRefreshing(false);
  };

  // Abrir modal para Novo
  const handleOpenCreateModal = () => {
    setEditingId(null);
    setForm({
      estabelecimento_id: estabelecimentos[0]?.id || 1,
      nome: '',
      telefone: '',
      cargo: 'Atendente',
      email: '',
      password: '',
    });
    setModalVisible(true);
  };

  // Abrir modal para Edição
  const handleOpenEditModal = (func: Funcionario) => {
    setEditingId(func.id);
    setForm({
      estabelecimento_id: func.estabelecimento_id,
      nome: func.nome,
      telefone: func.telefone || '',
      cargo: func.cargo,
      email: func.usuario?.email || '',
      password: '', // em branco se não for alterar
    });
    setModalVisible(true);
  };

  // Submeter formulário
  const handleSubmitForm = async () => {
    if (!form.nome || !form.cargo) {
      Alert.alert('Atenção', 'Preencha o nome e o cargo do colaborador.');
      return;
    }

    setSavingLoading(true);

    if (editingId) {
      // Atualização
      if (onUpdateFuncionario) {
        const success = await onUpdateFuncionario(editingId, form);
        if (success) setModalVisible(false);
      } else {
        // Fallback Local (mock)
        setFuncionarios((prev) =>
          prev.map((f) => (f.id === editingId ? { ...f, ...form } : f))
        );
        setModalVisible(false);
        Alert.alert('Sucesso', 'Funcionário atualizado com sucesso!');
      }
    } else {
      // Criação
      if (!form.email || !form.password) {
        Alert.alert('Atenção', 'E-mail e senha são obrigatórios para novo acesso.');
        setSavingLoading(false);
        return;
      }

      if (onStoreFuncionario) {
        const success = await onStoreFuncionario(form);
        if (success) setModalVisible(false);
      } else {
        // Fallback Local (mock)
        const newFunc: Funcionario = {
          id: Date.now(),
          estabelecimento_id: form.estabelecimento_id,
          nome: form.nome,
          cargo: form.cargo,
          telefone: form.telefone,
          ativo: true,
          total_atendimentos: 0,
          faturamento_total: 0,
          avaliacao_media: 5.0,
          usuario: { id: Date.now(), name: form.nome, email: form.email },
        };
        setFuncionarios((prev) => [newFunc, ...prev]);
        setModalVisible(false);
        Alert.alert('Sucesso', 'Funcionário cadastrado com sucesso!');
      }
    }

    setSavingLoading(false);
  };

  // Inativar Colaborador
  const handleDelete = (func: Funcionario) => {
    Alert.alert(
      'Inativar Colaborador',
      `Deseja realmente remover ${func.nome} da equipe?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Inativar',
          style: 'destructive',
          onPress: async () => {
            if (onDeleteFuncionario) {
              await onDeleteFuncionario(func.id);
            } else {
              setFuncionarios((prev) => prev.filter((f) => f.id !== func.id));
              Alert.alert('Concluído', 'Funcionário inativado.');
            }
          },
        },
      ]
    );
  };

  // Decidir Ausência (Aprovar / Recusar)
  const handleDecidirAusencia = async (id: number, status: 'aprovado' | 'recusado') => {
    const acao = status === 'aprovado' ? 'aprovar' : 'recusar';

    Alert.alert('Confirmar', `Deseja ${acao} esta solicitação de folga?`, [
      { text: 'Voltar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          if (onDecidirAusencia) {
            await onDecidirAusencia(id, status);
          } else {
            setAusenciasPendentes((prev) => prev.filter((item) => item.id !== id));
            Alert.alert('Sucesso', `Solicitação de folga ${status}!`);
          }
        },
      },
    ]);
  };

  // Filtro de funcionários na busca
  const funcionariosFiltrados = funcionarios.filter(
    (f) =>
      f.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.cargo.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Cálculos de Resumo
  const totalFaturamentoEquipe = funcionarios.reduce(
    (acc, item) => acc + (item.faturamento_total || 0),
    0
  );
  const totalAtendimentosEquipe = funcionarios.reduce(
    (acc, item) => acc + (item.total_atendimentos || 0),
    0
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* HEADER SUPERIOR */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Ionicons name="chevron-back" size={20} color="#1E293B" />
            <Text style={styles.backButtonText}>Painel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>GESTAO DE EQUIPE</Text>
          <TouchableOpacity style={styles.addButtonCircle} onPress={handleOpenCreateModal}>
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* METRICAS DE CABEÇALHO */}
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
            <Text style={[styles.statValue, { color: '#10B981' }]}>
              R$ {totalFaturamentoEquipe.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </Text>
          </View>
        </View>

        {/* ABAS SEGMENTADAS */}
        <View style={styles.segmentedContainer}>
          <TouchableOpacity
            style={[styles.segmentTab, activeTab === 'equipe' && styles.segmentTabActive]}
            onPress={() => setActiveTab('equipe')}
          >
            <Ionicons
              name="people-outline"
              size={16}
              color={activeTab === 'equipe' ? '#FFFFFF' : '#64748B'}
            />
            <Text style={[styles.segmentText, activeTab === 'equipe' && styles.segmentTextActive]}>
              Equipe
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentTab, activeTab === 'folgas' && styles.segmentTabActive]}
            onPress={() => setActiveTab('folgas')}
          >
            <Ionicons
              name="calendar-outline"
              size={16}
              color={activeTab === 'folgas' ? '#FFFFFF' : '#64748B'}
            />
            <Text style={[styles.segmentText, activeTab === 'folgas' && styles.segmentTextActive]}>
              Folgas
            </Text>
            {ausenciasPendentes.length > 0 && (
              <View style={styles.badgeCount}>
                <Text style={styles.badgeText}>{ausenciasPendentes.length}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentTab, activeTab === 'fechamentos' && styles.segmentTabActive]}
            onPress={() => setActiveTab('fechamentos')}
          >
            <Ionicons
              name="cash-outline"
              size={16}
              color={activeTab === 'fechamentos' ? '#FFFFFF' : '#64748B'}
            />
            <Text style={[styles.segmentText, activeTab === 'fechamentos' && styles.segmentTextActive]}>
              Produção
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* CONTEÚDO DA ABA 1: EQUIPE */}
      {activeTab === 'equipe' && (
        <View style={styles.contentFlex}>
          {/* BARRA DE PESQUISA */}
          <View style={styles.searchBarContainer}>
            <Ionicons name="search-outline" size={18} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar colaborador ou cargo..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery !== '' && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
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
                <MaterialCommunityIcons name="account-group-outline" size={48} color="#CBD5E1" />
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
                    <Text style={styles.employeeRole}>{item.cargo}</Text>
                    {item.estabelecimento && (
                      <View style={styles.storeBadge}>
                        <Ionicons name="business" size={10} color="#64748B" />
                        <Text style={styles.storeBadgeText}>{item.estabelecimento.nome}</Text>
                      </View>
                    )}
                  </View>

                  {/* RATING */}
                  <View style={styles.ratingBox}>
                    <Ionicons name="star" size={14} color="#F59E0B" />
                    <Text style={styles.ratingText}>
                      {item.avaliacao_media ? item.avaliacao_media.toFixed(1) : '5.0'}
                    </Text>
                  </View>
                </View>

                {/* METRICAS DO FUNCIONÁRIO */}
                <View style={styles.employeeMetricsRow}>
                  <View style={styles.metricSubBox}>
                    <Text style={styles.metricSubLabel}>Atendimentos</Text>
                    <Text style={styles.metricSubVal}>{item.total_atendimentos || 0}</Text>
                  </View>

                  <View style={styles.metricSubBox}>
                    <Text style={styles.metricSubLabel}>Faturamento</Text>
                    <Text style={[styles.metricSubVal, { color: '#059669' }]}>
                      R$ {(item.faturamento_total || 0).toFixed(2)}
                    </Text>
                  </View>

                  <View style={styles.metricSubBox}>
                    <Text style={styles.metricSubLabel}>E-mail</Text>
                    <Text style={styles.metricSubValSmall} numberOfLines={1}>
                      {item.usuario?.email || 'N/A'}
                    </Text>
                  </View>
                </View>

                {/* AÇÕES */}
                <View style={styles.employeeCardFooter}>
                  <TouchableOpacity
                    style={styles.actionBtnOutline}
                    onPress={() => handleOpenEditModal(item)}
                  >
                    <Feather name="edit-2" size={14} color="#334155" />
                    <Text style={styles.actionBtnText}>Editar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionBtnDanger}
                    onPress={() => handleDelete(item)}
                  >
                    <Feather name="trash-2" size={14} color="#EF4444" />
                    <Text style={styles.actionBtnDangerText}>Inativar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        </View>
      )}

      {/* CONTEÚDO DA ABA 2: FOLGAS / AUSÊNCIAS */}
      {activeTab === 'folgas' && (
        <ScrollView
          style={styles.contentFlex}
          contentContainerStyle={styles.listPadding}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          <Text style={styles.sectionTitle}>Solicitações de Ausência Pendentes</Text>

          {ausenciasPendentes.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="checkmark-circle-outline" size={48} color="#10B981" />
              <Text style={styles.emptyTitle}>Tudo em dia!</Text>
              <Text style={styles.emptySubtitle}>Nenhuma solicitação de folga para aprovar.</Text>
            </View>
          ) : (
            ausenciasPendentes.map((ausencia) => (
              <View key={ausencia.id} style={styles.leaveCard}>
                <View style={styles.leaveCardHeader}>
                  <Ionicons name="calendar-outline" size={20} color="#F97316" />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.leaveEmployeeName}>{ausencia.funcionario_nome}</Text>
                    <Text style={styles.leaveStore}>{ausencia.loja_nome}</Text>
                  </View>
                  <View style={styles.pendingStatusTag}>
                    <Text style={styles.pendingStatusText}>PENDENTE</Text>
                  </View>
                </View>

                {ausencia.motivo && (
                  <Text style={styles.leaveReason}>
                    Motivo: <Text style={{ fontWeight: '400', color: '#475569' }}>{ausencia.motivo}</Text>
                  </Text>
                )}

                <View style={styles.leaveDateRow}>
                  <Ionicons name="time-outline" size={14} color="#64748B" />
                  <Text style={styles.leaveDateText}>
                    Período: {ausencia.data_inicio} até {ausencia.data_fim}
                  </Text>
                </View>

                {/* BOTOES DE APROVACAO */}
                <View style={styles.leaveActionRow}>
                  <TouchableOpacity
                    style={styles.rejectBtn}
                    onPress={() => handleDecidirAusencia(ausencia.id, 'recusado')}
                  >
                    <Ionicons name="close" size={16} color="#DC2626" />
                    <Text style={styles.rejectBtnText}>Recusar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.approveBtn}
                    onPress={() => handleDecidirAusencia(ausencia.id, 'aprovado')}
                  >
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                    <Text style={styles.approveBtnText}>Aprovar Folga</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* CONTEÚDO DA ABA 3: FECHAMENTOS / PRODUÇÃO */}
      {activeTab === 'fechamentos' && (
        <ScrollView
          style={styles.contentFlex}
          contentContainerStyle={styles.listPadding}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          <Text style={styles.sectionTitle}>Fechamentos Diários Recentes</Text>

          {fechamentosRecentes.map((f) => (
            <View key={f.id} style={styles.closingCard}>
              <View style={styles.closingIconBox}>
                <Ionicons name="receipt-outline" size={20} color="#0EA5E9" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.closingName}>{f.funcionario_nome}</Text>
                <Text style={styles.closingDate}>{f.data_fechamento}</Text>
              </View>
              <Text style={styles.closingValue}>R$ {f.valor_total.toFixed(2)}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* MODAL: CADASTRAR OU EDITAR FUNCIONÁRIO */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingId ? 'Editar Colaborador' : 'Novo Colaborador'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* SELEÇÃO DE ESTABELECIMENTO */}
              <Text style={styles.inputLabel}>Unidade / Estabelecimento *</Text>
              <View style={styles.pickerContainer}>
                {estabelecimentos.map((est) => (
                  <TouchableOpacity
                    key={est.id}
                    style={[
                      styles.pickerOption,
                      form.estabelecimento_id === est.id && styles.pickerOptionActive,
                    ]}
                    onPress={() => setForm({ ...form, estabelecimento_id: est.id })}
                  >
                    <Text
                      style={[
                        styles.pickerOptionText,
                        form.estabelecimento_id === est.id && styles.pickerOptionTextActive,
                      ]}
                    >
                      {est.nome}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* NOME */}
              <Text style={styles.inputLabel}>Nome Completo *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ex: João da Silva"
                placeholderTextColor="#94A3B8"
                value={form.nome}
                onChangeText={(text) => setForm({ ...form, nome: text })}
              />

              {/* CARGO */}
              <Text style={styles.inputLabel}>Cargo / Função *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ex: Barbeiro Senior, Esteticista..."
                placeholderTextColor="#94A3B8"
                value={form.cargo}
                onChangeText={(text) => setForm({ ...form, cargo: text })}
              />

              {/* TELEFONE */}
              <Text style={styles.inputLabel}>Telefone / WhatsApp</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="(00) 00000-0000"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                value={form.telefone}
                onChangeText={(text) => setForm({ ...form, telefone: text })}
              />

              {/* EMAIL */}
              <Text style={styles.inputLabel}>E-mail de Acesso *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="usuario@email.com"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
                value={form.email}
                onChangeText={(text) => setForm({ ...form, email: text })}
              />

              {/* SENHA */}
              <Text style={styles.inputLabel}>
                {editingId ? 'Nova Senha (deixe em branco p/ manter)' : 'Senha de Acesso *'}
              </Text>
              <TextInput
                style={styles.modalInput}
                placeholder="••••••••"
                placeholderTextColor="#94A3B8"
                secureTextEntry
                value={form.password}
                onChangeText={(text) => setForm({ ...form, password: text })}
              />

              {/* BOTÃO SALVAR */}
              <TouchableOpacity
                style={styles.saveModalButton}
                onPress={handleSubmitForm}
                disabled={savingLoading}
              >
                {savingLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveModalButtonText}>
                    {editingId ? 'SALVAR ALTERAÇÕES' : 'CADASTRAR COLABORADOR'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ==========================================
// ESTILOS MODERNOS (STYLESHEET)
// ==========================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  contentFlex: {
    flex: 1,
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.8,
  },
  addButtonCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F97316',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // CARD DE MÉTRICAS DO CABEÇALHO
  statsCardContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#CBD5E1',
  },

  // SEGMENTED CONTROL (ABAS)
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
  },
  segmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  segmentTabActive: {
    backgroundColor: '#0F172A',
  },
  segmentText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  badgeCount: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },

  // BUSCA
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    height: 42,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 12,
    color: '#0F172A',
  },

  listPadding: {
    padding: 16,
    gap: 12,
  },

  // CARD DE FUNCIONÁRIO
  employeeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  employeeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F97316',
  },
  employeeInfo: {
    flex: 1,
    marginLeft: 12,
  },
  employeeName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  employeeRole: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  storeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 3,
  },
  storeBadgeText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '500',
  },
  ratingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },

  employeeMetricsRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
    justifyContent: 'space-between',
  },
  metricSubBox: {
    flex: 1,
  },
  metricSubLabel: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  metricSubVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 2,
  },
  metricSubValSmall: {
    fontSize: 10,
    color: '#475569',
    marginTop: 2,
  },

  employeeCardFooter: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  actionBtnOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 8,
    gap: 6,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  actionBtnDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  actionBtnDangerText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#EF4444',
  },

  // CARD DE FOLGAS
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  leaveCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  leaveCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leaveEmployeeName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  leaveStore: {
    fontSize: 10,
    color: '#64748B',
  },
  pendingStatusTag: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pendingStatusText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#D97706',
  },
  leaveReason: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
    marginTop: 8,
  },
  leaveDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  leaveDateText: {
    fontSize: 11,
    color: '#64748B',
  },
  leaveActionRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    paddingVertical: 8,
    gap: 4,
  },
  rejectBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  approveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingVertical: 8,
    gap: 4,
  },
  approveBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // CARD DE FECHAMENTO
  closingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  closingIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closingName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  closingDate: {
    fontSize: 10,
    color: '#64748B',
  },
  closingValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#059669',
  },

  // EMPTY STATE
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },

  // MODAL
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
    marginTop: 10,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    color: '#0F172A',
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerOption: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  pickerOptionActive: {
    backgroundColor: '#F97316',
    borderColor: '#F97316',
  },
  pickerOptionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  pickerOptionTextActive: {
    color: '#FFFFFF',
  },
  saveModalButton: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  saveModalButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});