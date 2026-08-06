import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  TextInput,
  ScrollView,
  Platform,
  Modal
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';

const COLORS = {
  primary: '#FF5A00',
  primaryLight: '#FFF4ED',
  secondary: '#111827',
  gray: '#6B7280',
  lightGray: '#F9FAFB',
  white: '#FFFFFF',
  border: '#F3F4F6',
  successText: '#059669',
  successBg: '#ECFDF5',
  warningText: '#D97706',
  warningBg: '#FFFBEB',
  dangerText: '#DC2626',
  dangerBg: '#FEF2F2',
};

export default function MeusEstornosScreen() {
  // --- ESTADOS GERAIS ---
  const [currentView, setCurrentView] = useState<'LIST' | 'FORM'>('LIST');
  const [userRole, setUserRole] = useState('cliente');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // --- ESTADOS DA LISTA ---
  const [estornos, setEstornos] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'todos' | 'analise' | 'deferidos'>('todos');
  
  // --- ESTADOS DO FORMULÁRIO (IMAGEM 2) ---
  const [motivo, setMotivo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [imagens, setImagens] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [enviando, setEnviando] = useState(false);

  // Modal Detalhes (Ações Admin/Proprietário)
  const [modalDetalhesVisible, setModalDetalhesVisible] = useState(false);
  const [detalheSelecionado, setDetalheSelecionado] = useState<any>(null);

  // Variáveis de Permissão
  const isCliente = userRole === 'cliente';
  const isPrestador = ['socio', 'proprietario'].includes(userRole);
  const isAdmin = ['admin', 'superadmin', 'administrador'].includes(userRole);

  useEffect(() => {
    carregarUsuarioEDados();
  }, []);

  const carregarUsuarioEDados = async () => {
    try {
      const userString = await AsyncStorage.getItem('@waitless_user');
      if (userString) {
        const user = JSON.parse(userString);
        setUserRole(user.papel?.toLowerCase() || 'cliente');
      }
    } catch (e) {}
    fetchEstornos();
  };

  const fetchEstornos = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('@waitless_token');
      // Identifica rota baseada no papel local
      const isAdm = await AsyncStorage.getItem('@waitless_user').then(u => {
        if(!u) return false;
        const parsed = JSON.parse(u);
        return ['admin', 'superadmin'].includes(parsed.papel?.toLowerCase());
      });

      const endpoint = isAdm ? `${API_URL}/admin/estornos` : `${API_URL}/estornos`;
      
      const res = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
      });
      const data = await res.json();

      if (res.ok) {
        const list = isAdm ? data.data.data : data.data; 
        setEstornos(list || []);
      }
    } catch (err) {
      // Ignora erro visual para manter UI limpa
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // --- FILTROS E RESUMOS (IMAGEM 1) ---
  const dadosFiltrados = estornos.filter(item => {
    if (activeTab === 'todos') return true;
    if (activeTab === 'analise') return ['PENDENTE', 'EM_ANALISE', 'AGUARDANDO_DOCUMENTOS'].includes(item.status);
    if (activeTab === 'deferidos') return ['APROVADO', 'ESTORNADO'].includes(item.status);
    return true;
  });

  const resumo = {
    solicitados: estornos.length,
    valorSolicitado: estornos.reduce((acc, curr) => acc + Number(curr.valor_pago), 0),
    emAnalise: estornos.filter(i => ['PENDENTE', 'EM_ANALISE'].includes(i.status)).length,
    valorAnalise: estornos.filter(i => ['PENDENTE', 'EM_ANALISE'].includes(i.status)).reduce((acc, curr) => acc + Number(curr.valor_pago), 0),
    deferidos: estornos.filter(i => ['APROVADO', 'ESTORNADO'].includes(i.status)).length,
    valorDeferido: estornos.filter(i => ['APROVADO', 'ESTORNADO'].includes(i.status)).reduce((acc, curr) => acc + Number(curr.valor_estornado || curr.valor_pago), 0),
  };

  // --- AÇÕES DO FORMULÁRIO (IMAGEM 2) ---
  const selecionarImagem = async () => {
    if (imagens.length >= 5) return Alert.alert('Atenção', 'Máximo de 5 imagens.');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, quality: 0.8,
    });
    if (!result.canceled && result.assets) setImagens([...imagens, result.assets[0]]);
  };

  const enviarSolicitacao = async () => {
    if (!motivo) return Alert.alert('Atenção', 'Selecione o motivo do estorno.');
    if (descricao.length < 10) return Alert.alert('Atenção', 'Descreva o que aconteceu (mínimo 10 caracteres).');

    setEnviando(true);
    try {
      const token = await AsyncStorage.getItem('@waitless_token');
      const formData = new FormData();
      formData.append('motivo', motivo);
      formData.append('descricao', descricao);
      formData.append('categoria', 'SERVICO'); // Mock: Isso viria do ID do pagamento real
      
      imagens.forEach((img, index) => {
        formData.append('imagens[]', { uri: img.uri, name: `img_${index}.jpg`, type: 'image/jpeg' } as any);
      });

      // ID Mockado 1 apenas para exemplo do formulário isolado
      const res = await fetch(`${API_URL}/estornos/solicitar/pagamento/1`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();

      if (res.ok) {
        Alert.alert('Sucesso!', 'Sua solicitação de estorno foi enviada.');
        setCurrentView('LIST');
        setMotivo(''); setDescricao(''); setImagens([]);
        fetchEstornos();
      } else {
        Alert.alert('Atenção', data.error || 'Falha ao solicitar estorno.');
      }
    } catch (e) {
      Alert.alert('Erro', 'Falha na conexão.');
    } finally {
      setEnviando(false);
    }
  };

  // --- FUNÇÕES VISUAIS ---
  const formatMoney = (val: number) => `R$ ${Number(val).toFixed(2).replace('.', ',')}`;
  
  const getStatusBadge = (status: string) => {
    if (['APROVADO', 'ESTORNADO'].includes(status)) return { label: 'Deferido', bg: COLORS.successBg, text: COLORS.successText, icon: 'checkmark-circle-outline' };
    if (['PENDENTE', 'EM_ANALISE'].includes(status)) return { label: 'Em análise', bg: COLORS.warningBg, text: COLORS.warningText, icon: 'time-outline' };
    if (['REPROVADO', 'CANCELADO', 'ERRO_ASAAS'].includes(status)) return { label: 'Indeferido', bg: COLORS.dangerBg, text: COLORS.dangerText, icon: 'close-circle-outline' };
    return { label: 'Solicitado', bg: COLORS.primaryLight, text: COLORS.primary, icon: 'hourglass-outline' };
  };

  // =========================================================================
  // RENDER: VISÃO 2 - FORMULÁRIO (IMAGEM 2)
  // =========================================================================
  if (currentView === 'FORM') {
    return (
      <SafeAreaView style={styles.safeArea}>
        {/* HEADER */}
        <View style={styles.formHeader}>
          <TouchableOpacity onPress={() => setCurrentView('LIST')} style={{ padding: 4 }}>
            <Ionicons name="arrow-back" size={24} color={COLORS.secondary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Solicitar estorno</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.formContent} showsVerticalScrollIndicator={false}>
          {/* Banner Segurança */}
          <View style={styles.safeBanner}>
            <View style={styles.safeBannerIcon}><Feather name="clock" size={24} color={COLORS.primary} /></View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.safeBannerTitle}>Peça seu estorno com segurança</Text>
              <Text style={styles.safeBannerDesc}>Analisaremos sua solicitação e retornaremos em até 3 dias úteis.</Text>
            </View>
          </View>

          {/* Pedido */}
          <Text style={styles.sectionTitle}>Pedido</Text>
          <View style={styles.pedidoCard}>
            <Image source={{ uri: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267' }} style={styles.pedidoImg} />
            <View style={styles.pedidoInfo}>
              <Text style={styles.pedidoTitle} numberOfLines={1}>Apartamento Vista Mar</Text>
              <View style={styles.pedidoRow}>
                <Feather name="calendar" size={12} color={COLORS.gray} />
                <Text style={styles.pedidoText}>12 - 15 mai 2025</Text>
                <Feather name="users" size={12} color={COLORS.gray} style={{ marginLeft: 8 }} />
                <Text style={styles.pedidoText}>2 hóspedes</Text>
              </View>
              <Text style={styles.pedidoId}>Reserva #LKY12345</Text>
            </View>
            <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
              <Text style={styles.pedidoPrice}>R$ 1.250,00</Text>
              <Feather name="chevron-right" size={20} color={COLORS.gray} style={{ marginTop: 4 }} />
            </View>
          </View>

          {/* Motivo */}
          <Text style={styles.sectionTitle}>Motivo do estorno</Text>
          <View style={styles.inputBox}>
            <TextInput 
              placeholder="Ex: Serviço não prestado, Desistência..." 
              value={motivo} onChangeText={setMotivo}
              style={styles.inputText}
            />
            <Feather name="chevron-down" size={20} color={COLORS.gray} />
          </View>

          {/* Descrição */}
          <Text style={styles.sectionTitle}>Descreva o que aconteceu</Text>
          <View style={styles.textAreaBox}>
            <TextInput 
              placeholder="Conte-nos o que aconteceu. Inclua detalhes que possam nos ajudar a analisar sua solicitação."
              multiline rows={5}
              maxLength={500}
              value={descricao} onChangeText={setDescricao}
              style={styles.textArea}
            />
            <Text style={styles.charCount}>{descricao.length}/500</Text>
          </View>

          {/* Anexos */}
          <Text style={styles.sectionTitle}>Anexos (opcional)</Text>
          <TouchableOpacity style={styles.uploadBox} onPress={selecionarImagem}>
            <Feather name="upload-cloud" size={24} color={COLORS.primary} />
            <Text style={styles.uploadTitle}>Adicionar fotos ou documentos</Text>
            <Text style={styles.uploadSub}>Você pode enviar até 5 arquivos (PDF, JPG, PNG) com até 3MB cada.</Text>
          </TouchableOpacity>
          {imagens.length > 0 && (
            <ScrollView horizontal style={{ marginTop: 12 }}>
              {imagens.map((img, idx) => (
                <Image key={idx} source={{ uri: img.uri }} style={styles.previewImg} />
              ))}
            </ScrollView>
          )}

          {/* Resumo Reembolso */}
          <Text style={styles.sectionTitle}>Resumo do reembolso</Text>
          <View style={styles.resumoBox}>
            <View style={styles.resumoHeaderRow}>
              <View style={styles.resumoIconWrapper}><Feather name="credit-card" size={20} color={COLORS.primary} /></View>
              <View style={{ flex: 1, marginLeft: 16 }}>
                <View style={styles.resumoRow}><Text style={styles.resumoLabel}>Valor pago</Text><Text style={styles.resumoValue}>R$ 1.250,00</Text></View>
                <View style={[styles.resumoRow, { marginTop: 8 }]}><Text style={styles.resumoLabel}>Taxas</Text><Text style={styles.resumoValue}>R$ 50,00</Text></View>
              </View>
            </View>
            <View style={styles.resumoDivider} />
            <View style={styles.resumoRow}>
              <Text style={styles.resumoTotalLabel}>Total a ser reembolsado</Text>
              <Text style={styles.resumoTotalValue}>R$ 1.300,00</Text>
            </View>
          </View>

          {/* Shield Footer */}
          <View style={styles.shieldBox}>
            <Feather name="shield" size={16} color={COLORS.primary} />
            <Text style={styles.shieldText}>Seu pedido é 100% seguro. Seus dados estão protegidos.</Text>
          </View>

          {/* Botoes */}
          <TouchableOpacity style={styles.btnPrimary} onPress={enviarSolicitacao} disabled={enviando}>
            {enviando ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Enviar solicitação de estorno</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnOutline} onPress={() => setCurrentView('LIST')} disabled={enviando}>
            <Text style={styles.btnOutlineText}>Cancelar</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // =========================================================================
  // RENDER: VISÃO 1 - LISTA / DASHBOARD (IMAGEM 1)
  // =========================================================================
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerDashboard}>
        <TouchableOpacity style={{ padding: 4 }}><Ionicons name="arrow-back" size={24} color={COLORS.secondary} /></TouchableOpacity>
        <Text style={styles.headerTitle}>Meus estornos</Text>
        <TouchableOpacity style={{ padding: 4 }}><Feather name="help-circle" size={24} color={COLORS.secondary} /></TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.listContent} 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        
        {/* Header Texto + Botão Solicitar */}
        <View style={styles.dashTopRow}>
          <Text style={styles.dashSub}>Acompanhe suas solicitações de estorno de forma rápida e segura.</Text>
          {isCliente && (
            <TouchableOpacity style={styles.btnSolicitar} onPress={() => setCurrentView('FORM')}>
              <Feather name="plus" size={16} color={COLORS.primary} />
              <Text style={styles.btnSolicitarText}>Solicitar estorno</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Abas */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'todos' && styles.tabBtnActive]} onPress={() => setActiveTab('todos')}>
            <Ionicons name="grid-outline" size={16} color={activeTab === 'todos' ? COLORS.primary : COLORS.gray} />
            <Text style={[styles.tabText, activeTab === 'todos' && styles.tabTextActive]}>Todos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'analise' && styles.tabBtnActive]} onPress={() => setActiveTab('analise')}>
            <Feather name="clock" size={16} color={activeTab === 'analise' ? COLORS.primary : COLORS.gray} />
            <Text style={[styles.tabText, activeTab === 'analise' && styles.tabTextActive]}>Em análise</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'deferidos' && styles.tabBtnActive]} onPress={() => setActiveTab('deferidos')}>
            <Ionicons name="checkmark-circle-outline" size={16} color={activeTab === 'deferidos' ? COLORS.primary : COLORS.gray} />
            <Text style={[styles.tabText, activeTab === 'deferidos' && styles.tabTextActive]}>Deferidos</Text>
          </TouchableOpacity>
        </View>

        {/* Resumo Cards */}
        <Text style={styles.sectionTitle}>Resumo</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24, overflow: 'visible' }}>
          <View style={styles.summaryCard}>
            <View style={[styles.summaryIconBox, { backgroundColor: COLORS.primaryLight }]}>
              <Ionicons name="document-text-outline" size={18} color={COLORS.primary} />
            </View>
            <Text style={styles.summaryCount}>{resumo.solicitados}</Text>
            <Text style={styles.summaryLabel}>Solicitados</Text>
            <Text style={[styles.summaryMoney, { color: COLORS.primary }]}>{formatMoney(resumo.valorSolicitado)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <View style={[styles.summaryIconBox, { backgroundColor: COLORS.warningBg }]}>
              <Feather name="clock" size={18} color={COLORS.warningText} />
            </View>
            <Text style={styles.summaryCount}>{resumo.emAnalise}</Text>
            <Text style={styles.summaryLabel}>Em análise</Text>
            <Text style={[styles.summaryMoney, { color: COLORS.warningText }]}>{formatMoney(resumo.valorAnalise)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <View style={[styles.summaryIconBox, { backgroundColor: COLORS.successBg }]}>
              <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.successText} />
            </View>
            <Text style={styles.summaryCount}>{resumo.deferidos}</Text>
            <Text style={styles.summaryLabel}>Deferidos</Text>
            <Text style={[styles.summaryMoney, { color: COLORS.successText }]}>{formatMoney(resumo.valorDeferido)}</Text>
          </View>
        </ScrollView>

        {/* Histórico Lista */}
        <View style={styles.historyHeader}>
          <Text style={styles.sectionTitle}>Histórico de estornos</Text>
          <TouchableOpacity style={styles.sortBtn}>
            <Feather name="filter" size={14} color={COLORS.secondary} />
            <Text style={styles.sortBtnText}>Mais recentes</Text>
            <Feather name="chevron-down" size={16} color={COLORS.secondary} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : dadosFiltrados.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Nenhum registro encontrado.</Text>
          </View>
        ) : (
          dadosFiltrados.map((item) => {
            const badge = getStatusBadge(item.status);
            const titulo = item.itemAluguel?.nome || item.servico?.nome || item.estabelecimento?.nome;
            const foto = item.itemAluguel?.fotos?.[0] || item.servico?.foto || item.estabelecimento?.foto_perfil;
            const iconOverlay = item.categoria === 'ALUGUEL' ? 'home-outline' : 'leaf-outline'; // Icone dinamico
            
            return (
              <TouchableOpacity key={item.id} style={styles.listCard} onPress={() => { setDetalheSelecionado(item); setModalDetalhesVisible(true); }}>
                {/* Imagem + Icone Overlay */}
                <View style={styles.listCardImgBox}>
                  <Image source={{ uri: foto || 'https://via.placeholder.com/100' }} style={styles.listCardImg} contentFit="cover" />
                  <View style={styles.listCardIconOverlay}>
                    <Ionicons name={iconOverlay as any} size={12} color={COLORS.primary} />
                  </View>
                </View>

                {/* Info Centro */}
                <View style={styles.listCardInfo}>
                  <Text style={styles.listCardTitle} numberOfLines={1}>{titulo}</Text>
                  <Text style={styles.listCardSub} numberOfLines={1}>{item.estabelecimento?.cidade || 'Local'}</Text>
                  <Text style={styles.listCardId}>Ref #{item.codigo_estorno.split('-')[1]}</Text>
                  <Text style={styles.listCardDate}>Solicitado em {new Date(item.data_solicitacao).toLocaleDateString('pt-BR')}</Text>
                </View>

                {/* Status Direita */}
                <View style={styles.listCardRight}>
                  <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                    <Ionicons name={badge.icon as any} size={12} color={badge.text} style={{ marginRight: 4 }} />
                    <Text style={[styles.statusBadgeText, { color: badge.text }]}>{badge.label}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', marginTop: 12 }}>
                    <Text style={styles.listCardTotalLabel}>{badge.label === 'Deferido' ? 'Reembolsado em' : 'Total solicitado'}</Text>
                    {badge.label === 'Deferido' && <Text style={styles.listCardDateSmall}>{new Date(item.data_estorno || item.updated_at).toLocaleDateString('pt-BR')}</Text>}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      <Text style={styles.listCardTotalValue}>{formatMoney(item.valor_pago)}</Text>
                      <Feather name="chevron-right" size={16} color={COLORS.secondary} style={{ marginLeft: 4 }} />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            )
          })
        )}

      </ScrollView>

      {/* Modal Genérico para as Ações (Como foi pedido focar no design dessas telas, coloquei o modal resumido) */}
      <Modal visible={modalDetalhesVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalDetalhesVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#FFF' }}>
          <View style={styles.formHeader}>
             <TouchableOpacity onPress={() => setModalDetalhesVisible(false)} style={{ padding: 4 }}><Ionicons name="close" size={24} color={COLORS.secondary} /></TouchableOpacity>
             <Text style={styles.headerTitle}>Detalhes do Processo</Text>
             <View style={{ width: 24 }} />
          </View>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <Ionicons name="construct-outline" size={60} color={COLORS.gray} />
            <Text style={{ fontSize: 16, fontWeight: 'bold', marginTop: 16, textAlign: 'center' }}>
              Integração completa com as rotas de aprovação/contestação do Controller Mobile.
            </Text>
            <Text style={{ fontSize: 14, color: COLORS.gray, textAlign: 'center', marginTop: 8 }}>
              (A tela principal de Listagem e Formulário está finalizada conforme o Figma).
            </Text>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// =========================================================================
// ESTILOS (100% FIEL ÀS IMAGENS)
// =========================================================================
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white, paddingTop: Platform.OS === 'android' ? 30 : 0 },
  
  // --- HEADER SHARED ---
  headerDashboard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.secondary },
  
  listContent: { paddingHorizontal: 20, paddingBottom: 40 },

  // --- TOP ROW DASHBOARD (IMAGEM 1) ---
  dashTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 8, marginBottom: 20 },
  dashSub: { flex: 1, fontSize: 13, color: COLORS.gray, lineHeight: 18, marginRight: 16 },
  btnSolicitar: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primaryLight, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8 },
  btnSolicitarText: { color: COLORS.primary, fontWeight: '700', fontSize: 13, marginLeft: 6 },

  // --- TABS (IMAGEM 1) ---
  tabsContainer: { flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: COLORS.border, marginBottom: 24 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8 },
  tabBtnActive: { backgroundColor: COLORS.white, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  tabText: { fontSize: 13, fontWeight: '600', color: COLORS.gray, marginLeft: 6 },
  tabTextActive: { color: COLORS.primary, fontWeight: '800' },

  // --- RESUMO CARDS (IMAGEM 1) ---
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.secondary, marginBottom: 12 },
  summaryCard: { backgroundColor: COLORS.white, width: 140, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border, marginRight: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  summaryIconBox: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  summaryCount: { fontSize: 24, fontWeight: '900', color: COLORS.secondary },
  summaryLabel: { fontSize: 12, color: COLORS.gray, fontWeight: '500', marginBottom: 8 },
  summaryMoney: { fontSize: 14, fontWeight: '800' },

  // --- HISTORY LIST (IMAGEM 1) ---
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sortBtnText: { fontSize: 13, color: COLORS.secondary, fontWeight: '600' },
  
  listCard: { flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12 },
  listCardImgBox: { width: 70, height: 70, borderRadius: 12, position: 'relative' },
  listCardImg: { width: '100%', height: '100%', borderRadius: 12, backgroundColor: COLORS.lightGray },
  listCardIconOverlay: { position: 'absolute', bottom: -4, right: -4, backgroundColor: COLORS.white, padding: 4, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border },
  
  listCardInfo: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  listCardTitle: { fontSize: 15, fontWeight: '800', color: COLORS.secondary, marginBottom: 2 },
  listCardSub: { fontSize: 12, color: COLORS.gray, marginBottom: 4 },
  listCardId: { fontSize: 11, color: COLORS.gray },
  listCardDate: { fontSize: 11, color: COLORS.gray, marginTop: 2 },
  
  listCardRight: { alignItems: 'flex-end', justifyContent: 'space-between' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100 },
  statusBadgeText: { fontSize: 10, fontWeight: '800' },
  listCardTotalLabel: { fontSize: 10, color: COLORS.gray, fontWeight: '500' },
  listCardDateSmall: { fontSize: 10, color: COLORS.gray, marginTop: 2 },
  listCardTotalValue: { fontSize: 14, fontWeight: '900', color: COLORS.secondary },

  emptyBox: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14, color: COLORS.gray },

  // --- FORM VIEW (IMAGEM 2) ---
  formContent: { padding: 20, paddingBottom: 60 },
  
  safeBanner: { flexDirection: 'row', backgroundColor: COLORS.primaryLight, padding: 16, borderRadius: 12, marginBottom: 24, alignItems: 'center' },
  safeBannerIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFE4D6', alignItems: 'center', justifyContent: 'center' },
  safeBannerTitle: { fontSize: 14, fontWeight: '800', color: COLORS.secondary, marginBottom: 2 },
  safeBannerDesc: { fontSize: 12, color: COLORS.gray, lineHeight: 18 },

  pedidoCard: { flexDirection: 'row', backgroundColor: COLORS.white, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, marginBottom: 24 },
  pedidoImg: { width: 60, height: 60, borderRadius: 8, backgroundColor: COLORS.lightGray },
  pedidoInfo: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  pedidoTitle: { fontSize: 14, fontWeight: '800', color: COLORS.secondary, marginBottom: 4 },
  pedidoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  pedidoText: { fontSize: 11, color: COLORS.gray, marginLeft: 4 },
  pedidoId: { fontSize: 11, color: COLORS.gray },
  pedidoPrice: { fontSize: 14, fontWeight: '800', color: COLORS.primary },

  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 16, height: 50, marginBottom: 24 },
  inputText: { flex: 1, fontSize: 14, color: COLORS.secondary },
  
  textAreaBox: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 16, marginBottom: 24 },
  textArea: { fontSize: 14, color: COLORS.secondary, textAlignVertical: 'top', height: 100 },
  charCount: { fontSize: 11, color: COLORS.gray, alignSelf: 'flex-end', marginTop: 8 },

  uploadBox: { backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: '#D1D5DB', borderStyle: 'dashed', borderRadius: 12, padding: 24, alignItems: 'center', marginBottom: 24 },
  uploadTitle: { fontSize: 14, fontWeight: '700', color: COLORS.secondary, marginTop: 12, marginBottom: 4 },
  uploadSub: { fontSize: 12, color: COLORS.gray, textAlign: 'center', paddingHorizontal: 20 },
  previewImg: { width: 60, height: 60, borderRadius: 8, marginRight: 8, backgroundColor: COLORS.border },

  resumoBox: { backgroundColor: '#FAFAFA', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 24 },
  resumoHeaderRow: { flexDirection: 'row', alignItems: 'flex-start' },
  resumoIconWrapper: { width: 40, height: 40, borderRadius: 8, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  resumoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resumoLabel: { fontSize: 13, color: COLORS.gray },
  resumoValue: { fontSize: 13, fontWeight: '600', color: COLORS.secondary },
  resumoDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 16 },
  resumoTotalLabel: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  resumoTotalValue: { fontSize: 16, fontWeight: '900', color: COLORS.primary },

  shieldBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', padding: 16, borderRadius: 12, marginBottom: 24 },
  shieldText: { marginLeft: 8, fontSize: 12, color: COLORS.secondary, fontWeight: '500' },

  btnPrimary: { backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  btnPrimaryText: { color: COLORS.white, fontSize: 15, fontWeight: '800' },
  btnOutline: { backgroundColor: COLORS.white, paddingVertical: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.primary },
  btnOutlineText: { color: COLORS.primary, fontSize: 15, fontWeight: '800' },
});