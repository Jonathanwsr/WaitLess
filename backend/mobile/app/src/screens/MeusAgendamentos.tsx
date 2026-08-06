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
  TextInput,
  SafeAreaView,
  Platform,
  ScrollView
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { Ionicons, Feather } from '@expo/vector-icons';

// --- TIPAGENS (Remove os erros de "any") ---
interface Estabelecimento {
  nome?: string;
  cidade?: string;
  foto_perfil?: string;
}

interface Servico {
  nome?: string;
  foto?: string;
}

interface ItemAluguel {
  nome?: string;
  fotos?: string[];
}

interface AgendamentoItem {
  id: number;
  status: string;
  data_agendamento?: string;
  data_inicio?: string;
  hora_agendamento?: string;
  valor_total?: number;
  valor_final?: number;
  created_at?: string;
  servico?: Servico;
  itemAluguel?: ItemAluguel;
  estabelecimento?: Estabelecimento;
}

// --- CONFIGURAÇÕES VISUAIS ---
const COLORS = {
  primary: '#FF5A00',
  secondary: '#111827',
  gray: '#6B7280',
  lightGray: '#F9FAFB',
  white: '#FFFFFF',
  border: '#F3F4F6',
  successBg: '#ECFDF5',
  successText: '#059669',
  pendingBg: '#FFF7ED',
  pendingText: '#D97706',
  canceledBg: '#FEF2F2',
  canceledText: '#DC2626',
};

const API_URL = process.env.EXPO_PUBLIC_API_URL;

const TABS = [
  { id: 'todos', label: 'Todos' },
  { id: 'proximos', label: 'Próximos' },
  { id: 'concluidos', label: 'Concluídos' },
  { id: 'cancelados', label: 'Cancelados' },
];

export default function MeusAgendamentos() {
  const router = useRouter();
  
  const [abaAtiva, setAbaAtiva] = useState<string>('todos');
  const [busca, setBusca] = useState<string>('');
  const [lista, setLista] = useState<AgendamentoItem[]>([]);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [nomeUsuario, setNomeUsuario] = useState<string>('Usuário');

  useEffect(() => {
    carregarAgendamentos();
    buscarNomeUsuario();
  }, []);

  const buscarNomeUsuario = async () => {
    try {
      const userString = await AsyncStorage.getItem('@waitless_user');
      if (userString) {
        const user = JSON.parse(userString);
        setNomeUsuario(user.name ? user.name.split(' ')[0] : 'Usuário');
      }
    } catch (e) {
      // ignora
    }
  };

  const carregarAgendamentos = async () => {
    try {
      const token = await AsyncStorage.getItem('@waitless_token');
      const response = await fetch(`${API_URL}/meus-agendamentos`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      
      const data = await response.json();
      if (Array.isArray(data)) {
        setLista(data);
      } else if (data.data) {
        setLista(data.data);
      }
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível carregar o seu histórico.');
    } finally {
      setCarregando(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    carregarAgendamentos();
  };

  const handleCancelar = (id: number) => {
    Alert.alert(
      'Cancelar Reserva',
      'Tem certeza que deseja cancelar este agendamento?',
      [
        { text: 'Não', style: 'cancel' },
        { 
          text: 'Sim, cancelar', 
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('@waitless_token');
              const response = await fetch(`${API_URL}/agendamentos/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
              });
              
              if (response.ok) {
                Alert.alert('Sucesso', 'Agendamento cancelado.');
                carregarAgendamentos();
              } else {
                Alert.alert('Erro', 'Não foi possível cancelar.');
              }
            } catch (e) {
              Alert.alert('Erro', 'Falha na comunicação com o servidor.');
            }
          }
        }
      ]
    );
  };

  // Filtros dinâmicos baseados na aba e na busca
  const dadosFiltrados = lista.filter((item) => {
    const termo = busca.toLowerCase();
    const nomeLocal = (item.estabelecimento?.nome || '').toLowerCase();
    const nomeServico = (item.servico?.nome || item.itemAluguel?.nome || '').toLowerCase();
    
    if (busca && !nomeLocal.includes(termo) && !nomeServico.includes(termo)) {
      return false;
    }

    if (abaAtiva === 'todos') return true;
    if (abaAtiva === 'proximos') return ['pendente', 'confirmado', 'em_atendimento', 'aguardando_pagamento'].includes(item.status);
    if (abaAtiva === 'concluidos') return ['finalizado', 'concluido'].includes(item.status);
    if (abaAtiva === 'cancelados') return ['cancelado', 'estornado', 'vencido'].includes(item.status);
    
    return true;
  });

  // Funções Auxiliares Visuais
  const getStatusInfo = (status: string) => {
    if (['confirmado', 'em_atendimento', 'finalizado', 'concluido'].includes(status)) {
      return { label: status === 'finalizado' || status === 'concluido' ? 'Concluído' : 'Confirmado', bg: COLORS.successBg, text: COLORS.successText };
    }
    if (['cancelado', 'estornado', 'vencido'].includes(status)) {
      return { label: 'Cancelado', bg: COLORS.canceledBg, text: COLORS.canceledText };
    }
    return { label: 'Pendente', bg: COLORS.pendingBg, text: COLORS.pendingText };
  };

  const formatarData = (dataStr?: string) => {
    if (!dataStr) return 'Data não definida';
    const [ano, mes, dia] = dataStr.split('T')[0].split('-');
    const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    return `${dia} de ${meses[parseInt(mes) - 1]}, ${ano}`;
  };

  const BannerExplorar = () => (
    <View style={styles.bannerContainer}>
      <View style={styles.bannerIcon}>
        <Feather name="calendar" size={24} color={COLORS.primary} />
      </View>
      <View style={styles.bannerTextContainer}>
        <Text style={styles.bannerTitle}>Precisa de algo novo?</Text>
        <Text style={styles.bannerDesc}>Encontre e agende serviços, hospedagens e muito mais.</Text>
      </View>
      <TouchableOpacity style={styles.bannerBtn} onPress={() => router.push('/src/screens/TelaExplorar')}>
        <Text style={styles.bannerBtnText}>Explorar</Text>
        <Feather name="arrow-right" size={16} color={COLORS.white} />
      </TouchableOpacity>
    </View>
  );

  // Renderização do Card fiel à imagem
  const renderCard = ({ item }: { item: AgendamentoItem }) => {
    const isAluguel = item.itemAluguel != null;
    const nomePrincipal = item.estabelecimento?.nome || 'Estabelecimento';
    const tituloItem = isAluguel ? item.itemAluguel?.nome : (item.servico?.nome || 'Serviço');
    const foto = isAluguel ? (item.itemAluguel?.fotos?.[0]) : (item.servico?.foto || item.estabelecimento?.foto_perfil);
    
    const statusInfo = getStatusInfo(item.status);
    const dataFormatada = formatarData(item.data_agendamento || item.data_inicio);
    const horaFormatada = item.hora_agendamento ? item.hora_agendamento.substring(0, 5) : '';
    
    const tagTexto = isAluguel ? 'Aluguel' : 'Serviço';
    const podeCancelar = ['pendente', 'confirmado', 'aguardando_pagamento'].includes(item.status);

    return (
      <View style={styles.card}>
        <View style={styles.cardMain}>
          
          {/* IMAGEM E TAG OVAL */}
          <View style={styles.imageContainer}>
            <Image 
              source={{ uri: foto || 'https://via.placeholder.com/150' }} 
              style={styles.image} 
              contentFit="cover" 
            />
            <View style={styles.imageTag}>
              <Text style={styles.imageTagText}>{tagTexto}</Text>
            </View>
          </View>

          {/* INFORMAÇÕES À DIREITA */}
          <View style={styles.infoContainer}>
            <View style={styles.titleRow}>
              <Text style={styles.titleText} numberOfLines={1}>{tituloItem}</Text>
              <View style={[styles.badge, { backgroundColor: statusInfo.bg }]}>
                <Text style={[styles.badgeText, { color: statusInfo.text }]}>{statusInfo.label}</Text>
              </View>
            </View>

            <View style={styles.detailsRowLayout}>
              <View style={styles.detailsList}>
                <View style={styles.detailRow}>
                  <Ionicons name="location-outline" size={14} color={COLORS.gray} />
                  <Text style={styles.detailText} numberOfLines={1}>{nomePrincipal} • {item.estabelecimento?.cidade || 'Local'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="calendar-outline" size={14} color={COLORS.gray} />
                  <Text style={styles.detailText}>{dataFormatada}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="time-outline" size={14} color={COLORS.gray} />
                  <Text style={styles.detailText}>{isAluguel ? 'Diária' : `${horaFormatada}h`}</Text>
                </View>
              </View>

              {/* BLOCO DE PREÇO (Direita e Embaixo) */}
              <View style={styles.priceContainer}>
                <Text style={styles.priceLabel}>Total pago</Text>
                <TouchableOpacity style={styles.priceValueRow} onPress={() => router.push({ pathname: '/src/screens/AgendamentoDetalhes', params: { id: item.id } })}>
                  <Text style={styles.priceValue}>R$ {Number(item.valor_total || item.valor_final || 0).toFixed(2).replace('.', ',')}</Text>
                  <Feather name="chevron-right" size={18} color={COLORS.secondary} style={{marginLeft: 2}} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* RODAPÉ DO CARD ESTILO IFOOD/AIRBNB */}
        <View style={styles.cardFooter}>
          <View style={styles.footerItem}>
            <Ionicons name="calendar-outline" size={14} color={COLORS.gray} />
            <Text style={styles.footerText}>{isAluguel ? 'Locação' : 'Criado'}: {formatarData(item.created_at)}</Text>
          </View>
          <View style={styles.footerDivider} />
          <View style={styles.footerItem}>
            <Ionicons name="ticket-outline" size={14} color={COLORS.gray} />
            <Text style={styles.footerText}>Ref #{item.id}</Text>
          </View>
          
          {/* Botão de Cancelar se aplicável */}
          {podeCancelar && (
            <>
              <View style={styles.footerDivider} />
              <TouchableOpacity style={styles.footerItemBtn} onPress={() => handleCancelar(item.id)}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        
        {/* HEADER TOP */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Olá, {nomeUsuario} <Text style={{fontSize: 20}}>👋</Text></Text>
            <Text style={styles.subGreeting}>Aqui estão os seus agendamentos.</Text>
          </View>
          <TouchableOpacity style={styles.bellBtn}>
            <Feather name="bell" size={24} color={COLORS.secondary} />
            <View style={styles.bellBadge}><Text style={styles.bellBadgeText}>2</Text></View>
          </TouchableOpacity>
        </View>

        <Text style={styles.pageTitle}>Meus Agendamentos</Text>

        {/* ABAS COM LINHA INFERIOR (Estilo Imagem) */}
        <View style={styles.tabsWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContainer}>
            {TABS.map(tab => (
              <TouchableOpacity 
                key={tab.id} 
                style={[styles.tabBtn, abaAtiva === tab.id && styles.tabBtnActive]}
                onPress={() => setAbaAtiva(tab.id)}
              >
                <Text style={[styles.tabText, abaAtiva === tab.id && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* BUSCA E FILTROS */}
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Feather name="search" size={18} color={COLORS.gray} style={styles.searchIcon} />
            <TextInput 
              placeholder="Buscar agendamentos..."
              placeholderTextColor={COLORS.gray}
              style={styles.searchInput}
              value={busca}
              onChangeText={setBusca}
            />
          </View>
          <TouchableOpacity style={styles.filterBtn}>
            <Ionicons name="options-outline" size={20} color={COLORS.secondary} />
            <Text style={styles.filterBtnText}>Filtros</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>
          {abaAtiva === 'todos' ? 'Todos os agendamentos' : 
           abaAtiva === 'proximos' ? 'Próximos agendamentos' : 
           abaAtiva === 'concluidos' ? 'Agendamentos concluídos' : 'Agendamentos cancelados'}
        </Text>

        {/* LISTA DE CARDS */}
        {carregando ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <FlatList
            data={dadosFiltrados}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderCard}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
            ListFooterComponent={dadosFiltrados.length > 0 ? <BannerExplorar /> : null}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="calendar-outline" size={60} color={COLORS.border} />
                <Text style={styles.emptyTitle}>Nenhum agendamento</Text>
                <Text style={styles.emptyDesc}>Você não possui registros nesta categoria.</Text>
                
                {/* Botão de explorar quando está vazio */}
                <TouchableOpacity style={styles.exploreEmptyBtn} onPress={() => router.push('/src/screens/TelaExplorar')}>
                  <Text style={styles.exploreEmptyBtnText}>Explorar Serviços</Text>
                </TouchableOpacity>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white, paddingTop: Platform.OS === 'android' ? 30 : 0 },
  container: { flex: 1, backgroundColor: COLORS.white },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20 },
  greeting: { fontSize: 20, fontWeight: '800', color: COLORS.secondary },
  subGreeting: { fontSize: 14, color: COLORS.gray, marginTop: 4, fontWeight: '500' },
  bellBtn: { position: 'relative', padding: 4 },
  bellBadge: { position: 'absolute', top: 0, right: 0, backgroundColor: COLORS.primary, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.white },
  bellBadgeText: { color: COLORS.white, fontSize: 8, fontWeight: 'bold' },

  pageTitle: { fontSize: 28, fontWeight: '900', color: COLORS.secondary, paddingHorizontal: 20, marginBottom: 16, letterSpacing: -0.5 },

  tabsWrapper: { borderBottomWidth: 1, borderBottomColor: COLORS.border, marginBottom: 16 },
  tabsContainer: { paddingHorizontal: 16, gap: 16 },
  tabBtn: { paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: COLORS.primary },
  tabText: { fontSize: 15, fontWeight: '600', color: COLORS.gray },
  tabTextActive: { color: COLORS.primary, fontWeight: '800' },

  searchRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 24 },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 12, height: 44 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.secondary },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, height: 44, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white },
  filterBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.secondary },

  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.secondary, paddingHorizontal: 20, marginBottom: 16 },

  listContainer: { paddingHorizontal: 20, paddingBottom: 40 },

  // Card Design Exato da Imagem
  card: { backgroundColor: COLORS.white, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 },
  cardMain: { flexDirection: 'row', padding: 16 },
  
  imageContainer: { width: 90, height: 90, position: 'relative', borderRadius: 12, overflow: 'hidden' },
  image: { width: '100%', height: '100%', backgroundColor: COLORS.lightGray },
  imageTag: { position: 'absolute', bottom: -2, alignSelf: 'center', backgroundColor: COLORS.white, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100, borderWidth: 1, borderColor: COLORS.border },
  imageTagText: { fontSize: 9, fontWeight: '900', color: COLORS.primary, textTransform: 'uppercase' },

  infoContainer: { flex: 1, marginLeft: 16, justifyContent: 'flex-start' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  titleText: { flex: 1, fontSize: 16, fontWeight: '800', color: COLORS.secondary, marginRight: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100 },
  badgeText: { fontSize: 10, fontWeight: '800' },

  detailsRowLayout: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', flex: 1 },
  detailsList: { flex: 1, gap: 4 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 12, color: COLORS.gray, fontWeight: '500' },

  priceContainer: { alignItems: 'flex-end' },
  priceLabel: { fontSize: 11, color: COLORS.gray, fontWeight: '600', marginBottom: 2 },
  priceValueRow: { flexDirection: 'row', alignItems: 'center' },
  priceValue: { fontSize: 16, fontWeight: '900', color: COLORS.secondary },

  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', backgroundColor: '#FAFAFA', paddingVertical: 12, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: COLORS.border },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerItemBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8 },
  footerText: { fontSize: 12, color: COLORS.gray, fontWeight: '600' },
  footerDivider: { width: 1, height: 16, backgroundColor: COLORS.border },
  cancelText: { fontSize: 12, color: COLORS.canceledText, fontWeight: '800' },

  bannerContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: COLORS.border, marginTop: 10, marginBottom: 20 },
  bannerIcon: { width: 48, height: 48, backgroundColor: COLORS.primaryLight, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bannerTextContainer: { flex: 1, marginHorizontal: 16 },
  bannerTitle: { fontSize: 15, fontWeight: '800', color: COLORS.secondary, marginBottom: 4 },
  bannerDesc: { fontSize: 12, color: COLORS.gray, lineHeight: 16 },
  bannerBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  bannerBtnText: { color: COLORS.white, fontSize: 13, fontWeight: '800' },

  // Empty State
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: COLORS.secondary, marginTop: 16, marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: COLORS.gray, textAlign: 'center', marginBottom: 24 },
  exploreEmptyBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 },
  exploreEmptyBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 14 },
});