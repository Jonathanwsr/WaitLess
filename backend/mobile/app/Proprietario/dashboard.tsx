import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ActivityIndicator, 
  TouchableOpacity, 
  ScrollView,
  Platform,
  StatusBar,
  Image,
  useWindowDimensions
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'; 
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

interface Estabelecimento {
  id: number;
  nome: string;
  foto_perfil: string | null;
  avaliacao_media: number;
  arrecadacao_total: number;
  ativo: boolean;
  fila_agora: number;
  funcionarios_count: number;
}

interface DashboardData {
  estabelecimentos: Estabelecimento[];
  metricas: {
    total_fila: number;
    total_arrecadado: number;
    ativos: number;
  };
}

const ENV_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api';
const cleanBaseUrl = ENV_URL.endsWith('/') ? ENV_URL.slice(0, -1) : ENV_URL;
const API_URL = `${cleanBaseUrl}/mobile/proprietario/dashboard`;

export default function ProprietarioDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [erroAPI, setErroAPI] = useState<string | null>(null);
  const [userName, setUserName] = useState('Usuário');
  const [userPhoto, setUserPhoto] = useState<string | null>(null); 
  
  // Controle de paginação (Mostra 10 por padrão)
  const [itensVisiveis, setItensVisiveis] = useState(10);

  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets(); // Para lidar com o notch e a barra inferior do iOS

  // Calcula a largura dinâmica para os cards de métricas (Grid de 2 colunas)
  const metricCardWidth = (width - 56) / 2;

  useEffect(() => {
    carregarUsuario();
    fetchDashboard();
  }, []);

  const carregarUsuario = async () => {
    try {
      const userDataString = await SecureStore.getItemAsync('userData');
      if (userDataString) {
        const usuario = JSON.parse(userDataString);
        if (usuario.nome) {
          setUserName(usuario.nome.split(' ')[0]);
        }
        if (usuario.foto_perfil || usuario.foto) {
          setUserPhoto(usuario.foto_perfil || usuario.foto);
        }
      }
    } catch (error) {
      console.log('Erro ao ler dados do usuário');
    }
  };

  const handleSair = async () => {
    await AsyncStorage.removeItem('@waitless_token');
    await AsyncStorage.removeItem('@lokyva_token');
    await SecureStore.deleteItemAsync('userData');
    router.replace('/autenticacao/login');
  };

  const fetchDashboard = async () => {
    try {
      setErroAPI(null);
      let token = await AsyncStorage.getItem('@waitless_token') || await AsyncStorage.getItem('@lokyva_token'); 

      if (!token) {
        router.replace('/autenticacao/login');
        return;
      }

      const response = await fetch(API_URL, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (response.status === 401) {
        await handleSair();
        return;
      }
      
      const textResponse = await response.text();
      let json = JSON.parse(textResponse);

      if (!response.ok) throw new Error('Erro na resposta');

      setData(json);
    } catch (error: any) {
      setErroAPI('Desculpe, não conseguimos conectar aos servidores no momento.');
    } finally {
      setLoading(false);
    }
  };

  const carregarMais = () => {
    setItensVisiveis(prev => prev + 10);
  };

  const renderEstabelecimento = (item: Estabelecimento, index: number) => (
    <View key={item.id || index} style={styles.estCard}>
      <View style={styles.estHeader}>
        <View style={styles.estAvatarPlaceholder}>
          {item.foto_perfil ? (
            <Image source={{ uri: item.foto_perfil }} style={styles.estAvatarImage} />
          ) : (
            <Text style={styles.estAvatarText}>{item.nome.charAt(0).toUpperCase()}</Text>
          )}
        </View>
        <View style={styles.estInfo}>
          <View style={styles.estTitleRow}>
            <Text style={styles.estTitle} numberOfLines={1}>{item.nome}</Text>
            <View style={[styles.statusDot, { backgroundColor: item.ativo ? '#10B981' : '#EF4444' }]} />
          </View>
          <Text style={styles.estSubtitle}>
            Nota {item.avaliacao_media || '0.0'} • {item.funcionarios_count} Membros
          </Text>
        </View>
        <TouchableOpacity style={styles.estMoreBtn}>
          <Feather name="more-horizontal" size={24} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      <View style={styles.estFilaBox}>
        <View>
          <Text style={styles.estFilaLabel}>Na fila agora</Text>
          <Text style={styles.estFilaValue}>{item.fila_agora || 0}</Text>
        </View>
        <View style={styles.estFilaIconBox}>
          <Feather name="users" size={20} color="#10B981" />
        </View>
      </View>

      <View style={styles.estActionsRow}>
        <TouchableOpacity 
          style={styles.estActionBtn} 
          onPress={() => router.push(`/src/screens/AcompanhamentoFilaScreen?id=${item.id}`)}
        >
          <Feather name="list" size={16} color="#475569" />
          <Text style={styles.estActionText}>Fila</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.estActionBtn}
          onPress={() => router.push(`/Proprietario/FuncionariosScreen?id=${item.id}`)}
        >
          <Feather name="user" size={16} color="#475569" />
          <Text style={styles.estActionText}>Equipe</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.estActionBtn}
          onPress={() => router.push(`/src/funcionario/AgendaEquipe?estabelecimento_id=${item.id}` as never)}
        >
          <Feather name="bar-chart-2" size={16} color="#475569" />
          <Text style={styles.estActionText}>Produção</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.estActionBtn} 
          onPress={() => router.push(`/Proprietario/ConfiguracoesMobile?id=${item.id}&nome=${encodeURIComponent(item.nome)}`)}
        >
          <Feather name="settings" size={16} color="#475569" />
          <Text style={styles.estActionText}>Ajustes</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  if (erroAPI) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.erroContainer}>
          <View style={styles.erroIconContainer}>
            <Feather name="wifi-off" size={48} color="#EF4444" />
          </View>
          <Text style={styles.erroTitulo}>Oops!</Text>
          <Text style={styles.erroTexto}>{erroAPI}</Text>
          <Text style={styles.erroSubTexto}>Verifique sua conexão de internet.</Text>

          <TouchableOpacity style={styles.btnTentar} onPress={() => { setLoading(true); fetchDashboard(); }}>
            <Text style={styles.btnTentarTexto}>Tentar Novamente</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnSairErro} onPress={handleSair}>
            <Text style={styles.btnSairErroTexto}>Voltar para Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const estabelecimentosData = data?.estabelecimentos || [];
  const estabelecimentosPaginados = estabelecimentosData.slice(0, itensVisiveis);
  const temMaisItens = estabelecimentosData.length > itensVisiveis;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      
      {/* HEADER */}
      <View style={styles.topHeader}>
        <View style={styles.topHeaderLeft}>
          <View style={styles.avatarMini}>
            {userPhoto ? (
              <Image source={{ uri: userPhoto }} style={styles.avatarMiniImage} />
            ) : (
              <Text style={styles.avatarMiniText}>{userName.charAt(0).toUpperCase()}</Text>
            )}
          </View>
          <View>
            <Text style={styles.greetingLight}>Bem-vindo de volta,</Text>
            <Text style={styles.greetingText}>{userName}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.notificationBtn}>
          <Feather name="bell" size={20} color="#64748B" />
          <View style={styles.notificationBadge} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        
        {/* TÍTULO */}
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>Visão Geral</Text>
        </View>

        {/* GRID DE MÉTRICAS RESPONSIVO */}
        <View style={styles.metricsWrapper}>
          <View style={[styles.metricCard, { width: metricCardWidth }]}>
            <View style={styles.metricHeader}>
              <View style={[styles.metricIconBox, { backgroundColor: '#EFF6FF' }]}>
                <Feather name="users" size={18} color="#3B82F6" />
              </View>
            </View>
            <Text style={styles.metricValue}>{data?.metricas?.total_fila || 0}</Text>
            <Text style={styles.metricDesc}>Pessoas na fila</Text>
          </View>

          <View style={[styles.metricCard, { width: metricCardWidth }]}>
            <View style={styles.metricHeader}>
              <View style={[styles.metricIconBox, { backgroundColor: '#ECFDF5' }]}>
                <Feather name="dollar-sign" size={18} color="#10B981" />
              </View>
            </View>
            <Text style={styles.metricValue}>R$ {data?.metricas?.total_arrecadado || '0,00'}</Text>
            <Text style={styles.metricDesc}>Faturamento mês</Text>
          </View>

          <View style={[styles.metricCard, { width: metricCardWidth }]}>
            <View style={styles.metricHeader}>
              <View style={[styles.metricIconBox, { backgroundColor: '#F5F3FF' }]}>
                <Feather name="briefcase" size={18} color="#8B5CF6" />
              </View>
            </View>
            <Text style={styles.metricValue}>{data?.metricas?.ativos || 0}</Text>
            <Text style={styles.metricDesc}>Estabelecimentos</Text>
          </View>

          <View style={[styles.metricCard, { width: metricCardWidth }]}>
            <View style={styles.metricHeader}>
              <View style={[styles.metricIconBox, { backgroundColor: '#FFF7ED' }]}>
                <Feather name="trending-up" size={18} color="#F97316" />
              </View>
            </View>
            <Text style={styles.metricValue}>R$ 0,00</Text>
            <Text style={styles.metricDesc}>Lucro financeiro</Text>
          </View>
        </View>

        {/* AÇÕES E BOTÃO CRIAR */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Seus Locais</Text>
        </View>

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.quickActionsScroll} 
          contentContainerStyle={styles.quickActionsContainer}
        >
          {/* BOTÃO CRIAR MODERNO E DESTACADO */}
          <TouchableOpacity 
            style={styles.btnCriarModerno} 
            onPress={() => router.push('/Proprietario/CriarEstabelecimento')}
          >
            <View style={styles.btnCriarIconBox}>
              <Feather name="plus" size={16} color="#10B981" />
            </View>
            <Text style={styles.btnCriarTexto}>Novo Local</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickActionPill} onPress={() => router.push('/Proprietario/FuncionariosScreen')}>
            <Text style={styles.quickActionText}>Equipe</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionPill}>
            <Text style={styles.quickActionText}>Contas</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionPill}>
            <Text style={styles.quickActionText}>Suporte</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* LISTA DE ESTABELECIMENTOS COM PAGINAÇÃO MANUAL */}
        <View style={styles.listaContainer}>
          {estabelecimentosPaginados.length > 0 ? (
            estabelecimentosPaginados.map((item, index) => renderEstabelecimento(item, index))
          ) : (
            <View style={styles.emptyState}>
              <Feather name="map-pin" size={40} color="#CBD5E1" />
              <Text style={styles.emptyStateText}>Nenhum local cadastrado ainda.</Text>
            </View>
          )}

          {/* BOTÃO DE CARREGAR MAIS (SÓ APARECE SE TIVER > 10 ITENS NÃO VISÍVEIS) */}
          {temMaisItens && (
            <TouchableOpacity style={styles.btnCarregarMais} onPress={carregarMais}>
              <Text style={styles.btnCarregarMaisText}>Carregar Mais Locais</Text>
              <Feather name="chevron-down" size={16} color="#3B82F6" />
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* MENU INFERIOR */}
      <View style={[styles.bottomMenu, { paddingBottom: insets.bottom || 10 }]}>
        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuIconActiveBg}>
            <Feather name="grid" size={20} color="#10B981" />
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <Feather name="list" size={22} color="#94A3B8" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <Feather name="scissors" size={22} color="#94A3B8" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <Feather name="calendar" size={22} color="#94A3B8" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/src/screens/PerfilAnfitriao')}>
          <Feather name="user" size={22} color="#94A3B8" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  
  // HEADER
  topHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 10, backgroundColor: '#F8FAFC' },
  topHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  avatarMini: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center', marginRight: 12, overflow: 'hidden' },
  avatarMiniImage: { width: '100%', height: '100%' },
  avatarMiniText: { color: '#0F172A', fontWeight: 'bold', fontSize: 18 },
  greetingLight: { fontSize: 12, color: '#64748B', marginBottom: 2 },
  greetingText: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  notificationBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 },
  notificationBadge: { position: 'absolute', top: 12, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444', borderWidth: 2, borderColor: '#FFF' },

  container: { flex: 1 },
  
  titleSection: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16 },
  pageTitle: { fontSize: 24, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },

  // GRID DE MÉTRICAS (RESPONSIVO)
  metricsWrapper: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 24, justifyContent: 'space-between', gap: 8 },
  metricCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 16, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  metricHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  metricIconBox: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  metricValue: { fontSize: 22, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
  metricDesc: { fontSize: 12, color: '#64748B', marginTop: 4, fontWeight: '500' },

  // AÇÕES RÁPIDAS & BOTÃO CRIAR MODERNO
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginTop: 24, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  
  quickActionsScroll: { paddingLeft: 24, marginBottom: 24 },
  quickActionsContainer: { paddingRight: 48, gap: 12, alignItems: 'center' },
  
  // Design Moderno do Botão Novo Local
  btnCriarModerno: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B981', paddingLeft: 6, paddingRight: 16, paddingVertical: 6, borderRadius: 30, shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  btnCriarIconBox: { width: 28, height: 28, backgroundColor: '#FFFFFF', borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  btnCriarTexto: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  
  // Pílulas normais
  quickActionPill: { backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 5, elevation: 1 },
  quickActionText: { fontSize: 13, fontWeight: '600', color: '#475569' },

  // LISTA E CARDS
  listaContainer: { paddingHorizontal: 24, paddingBottom: 40, gap: 16 },
  estCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.04, shadowRadius: 15, elevation: 3 },
  estHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  estAvatarPlaceholder: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginRight: 14, overflow: 'hidden' },
  estAvatarImage: { width: '100%', height: '100%' },
  estAvatarText: { fontSize: 18, fontWeight: 'bold', color: '#0F172A' },
  estInfo: { flex: 1, justifyContent: 'center' },
  estTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  estTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginRight: 8, flexShrink: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  estSubtitle: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  estMoreBtn: { padding: 4 },
  
  estFilaBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  estFilaLabel: { fontSize: 12, color: '#64748B', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  estFilaValue: { fontSize: 24, fontWeight: '900', color: '#0F172A' },
  estFilaIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#ECFDF5', justifyContent: 'center', alignItems: 'center' },

  estActionsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  estActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC', paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: '#F1F5F9' },
  estActionText: { fontSize: 12, fontWeight: '700', color: '#475569', marginLeft: 6 },

  // ESTADO VAZIO & PAGINAÇÃO
  emptyState: { paddingVertical: 40, alignItems: 'center', justifyContent: 'center' },
  emptyStateText: { marginTop: 12, fontSize: 14, color: '#94A3B8', fontWeight: '500' },
  btnCarregarMais: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF6FF', paddingVertical: 16, borderRadius: 20, marginTop: 10 },
  btnCarregarMaisText: { color: '#3B82F6', fontWeight: '700', fontSize: 14, marginRight: 8 },

  // MENU INFERIOR
  bottomMenu: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', backgroundColor: '#FFFFFF', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  menuItem: { alignItems: 'center', justifyContent: 'center', flex: 1, height: 50 },
  menuIconActiveBg: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#ECFDF5', justifyContent: 'center', alignItems: 'center' },

  // ERROS AMIGÁVEIS
  erroContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  erroIconContainer: { marginBottom: 24, padding: 24, backgroundColor: '#FEF2F2', borderRadius: 100 },
  erroTitulo: { fontSize: 32, fontWeight: '900', color: '#0F172A', marginBottom: 12, letterSpacing: -1 },
  erroTexto: { fontSize: 16, color: '#475569', textAlign: 'center', marginBottom: 8, fontWeight: '600' },
  erroSubTexto: { fontSize: 14, color: '#94A3B8', textAlign: 'center', marginBottom: 40 },
  btnTentar: { backgroundColor: '#10B981', paddingHorizontal: 32, paddingVertical: 18, borderRadius: 30, marginBottom: 16, width: '100%', alignItems: 'center', shadowColor: '#10B981', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  btnTentarTexto: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  btnSairErro: { paddingHorizontal: 32, paddingVertical: 18, borderRadius: 30, backgroundColor: '#F1F5F9', width: '100%', alignItems: 'center' },
  btnSairErroTexto: { color: '#475569', fontWeight: '700', fontSize: 16 },
});