import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  ActivityIndicator, 
  TouchableOpacity, 
  ScrollView,
  Platform,
  StatusBar,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; 
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
  
  // Tratamento de erro simplificado para o usuário
  const [erroAPI, setErroAPI] = useState<string | null>(null);
  
  const [userName, setUserName] = useState('Usuário');
  const [userPhoto, setUserPhoto] = useState<string | null>(null); // Estado para a foto
  const router = useRouter();

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
      
      let token = await AsyncStorage.getItem('@waitless_token');
      if (!token) token = await AsyncStorage.getItem('@lokyva_token'); 

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
      
      let json;
      try {
        json = JSON.parse(textResponse);
      } catch (parseError) {
        setErroAPI('Desculpe, nossos servidores estão passando por uma instabilidade momentânea.');
        return;
      }

      if (!response.ok) {
        setErroAPI('Não foi possível carregar suas informações neste momento.');
        return;
      }

      setData(json);
    } catch (error: any) {
      setErroAPI('Parece que você está sem conexão ou o sinal está fraco.');
    } finally {
      setLoading(false);
    }
  };

  const renderEstabelecimento = ({ item }: { item: Estabelecimento }) => (
    <View style={styles.estCard}>
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
            <Text style={styles.estTitle}>{item.nome}</Text>
            <View style={[styles.statusDot, { backgroundColor: item.ativo ? '#22C55E' : '#EF4444' }]} />
          </View>
          <Text style={styles.estSubtitle}>
            Nota: {item.avaliacao_media || '0.0'}  •  Equipe: {item.funcionarios_count}
          </Text>
        </View>
        <TouchableOpacity style={styles.estMoreBtn}>
          <Feather name="more-vertical" size={20} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      <View style={styles.estFilaBox}>
        <Text style={styles.estFilaLabel}>Na fila agora</Text>
        <Text style={styles.estFilaValue}>{item.fila_agora || 0}</Text>
      </View>

      <View style={styles.estActionsRow}>
        {/* ROTA: Ver Fila - PASSANDO O ID */}
        <TouchableOpacity 
          style={styles.estActionBtn} 
          onPress={() => router.push(`/src/screens/AcompanhamentoFilaScreen?id=${item.id}`)}
        >
          <Feather name="users" size={18} color="#4B5563" />
          <Text style={styles.estActionText}>Ver Fila</Text>
        </TouchableOpacity>
        
        {/* ROTA: Equipe - PASSANDO O ID DA LOJA PARA CARREGAR A EQUIPE CERTA */}
        <TouchableOpacity 
          style={styles.estActionBtn} 
          onPress={() => router.push(`/Proprietario/FuncionariosScreen?id=${item.id}`)}
        >
          <Feather name="user-check" size={18} color="#4B5563" />
          <Text style={styles.estActionText}>Equipe</Text>
        </TouchableOpacity>
        
        {/* ROTA: Configurações - PASSANDO O ID E O NOME DA LOJA */}
        <TouchableOpacity 
          style={styles.estActionBtn} 
          onPress={() => router.push(`/Proprietario/ConfiguracoesMobile?id=${item.id}&nome=${encodeURIComponent(item.nome)}`)}
        >
          <Feather name="settings" size={18} color="#4B5563" />
          <Text style={styles.estActionText}>Configurações</Text>
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

  // TELA DE ERRO AMIGÁVEL PARA O USUÁRIO FINAL
  if (erroAPI) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.erroContainer}>
          <View style={styles.erroIconContainer}>
            <Feather name="alert-circle" size={48} color="#EF4444" />
          </View>
          <Text style={styles.erroTitulo}>Oops!</Text>
          <Text style={styles.erroTexto}>{erroAPI}</Text>
          <Text style={styles.erroSubTexto}>Por favor, verifique sua internet e tente novamente.</Text>

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <View style={styles.topHeader}>
        <View style={styles.topHeaderLeft}>
          <View style={styles.avatarMini}>
            {userPhoto ? (
              <Image source={{ uri: userPhoto }} style={styles.avatarMiniImage} />
            ) : (
              <Text style={styles.avatarMiniText}>{userName.charAt(0).toUpperCase()}</Text>
            )}
          </View>
          <Text style={styles.greetingText}>Olá, {userName}</Text>
        </View>
        <TouchableOpacity style={styles.notificationBtn}>
          <Feather name="bell" size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>
      <View style={styles.blueDashedLine} />

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>Visão Geral</Text>
          <Text style={styles.pageSubtitle}>Acompanhe o desempenho de seus estabelecimentos e resultados.</Text>
        </View>

        <View style={styles.metricsWrapper}>
          <View style={styles.metricCard}>
            <View style={styles.metricIconBox}>
              <Feather name="users" size={20} color="#4B5563" />
            </View>
            <View style={styles.metricInfo}>
              <Text style={styles.metricLabel}>PESSOAS NA FILA</Text>
              <Text style={styles.metricValue}>{data?.metricas?.total_fila || 0}</Text>
              <Text style={styles.metricDesc}>Em andamento</Text>
            </View>
          </View>

          <View style={styles.metricCard}>
            <View style={styles.metricIconBox}>
              <Feather name="dollar-sign" size={20} color="#4B5563" />
            </View>
            <View style={styles.metricInfo}>
              <Text style={styles.metricLabel}>FATURAMENTO</Text>
              <Text style={styles.metricValue}>R$ {data?.metricas?.total_arrecadado || '0,00'}</Text>
              <Text style={styles.metricDesc}>Este mês</Text>
            </View>
          </View>

          <View style={styles.metricCard}>
            <View style={styles.metricIconBox}>
              <Feather name="briefcase" size={20} color="#4B5563" />
            </View>
            <View style={styles.metricInfo}>
              <Text style={styles.metricLabel}>LOCAIS</Text>
              <Text style={styles.metricValue}>{data?.metricas?.ativos || 0}</Text>
              <Text style={styles.metricDesc}>Estabelecimentos</Text>
            </View>
          </View>

          <View style={styles.metricCard}>
            <View style={styles.metricIconBox}>
              <Feather name="trending-up" size={20} color="#4B5563" />
            </View>
            <View style={styles.metricInfo}>
              <Text style={styles.metricLabel}>LUCRO FINANCEIRO</Text>
              <Text style={styles.metricValue}>R$ 0,00</Text>
              <Text style={styles.metricDesc}>Neste mês</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Meus Estabelecimentos</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickActionsScroll} contentContainerStyle={styles.quickActionsContainer}>
          <TouchableOpacity style={styles.quickActionPill} onPress={() => router.push('/Proprietario/FuncionariosScreen')}>
            <Feather name="users" size={14} color="#4B5563" />
            <Text style={styles.quickActionText}>Equipe</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionPill}>
            <Feather name="credit-card" size={14} color="#4B5563" />
            <Text style={styles.quickActionText}>Contas</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionPill}>
            <Feather name="briefcase" size={14} color="#4B5563" />
            <Text style={styles.quickActionText}>Carteira</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionPill}>
            <Feather name="life-buoy" size={14} color="#4B5563" />
            <Text style={styles.quickActionText}>Suporte</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.quickActionPill, styles.quickActionPillGreen]} onPress={() => router.push('/Proprietario/CriarEstabelecimento')}>
            <Feather name="plus" size={14} color="#FFFFFF" />
            <Text style={styles.quickActionTextGreen}>Novo Local</Text>
          </TouchableOpacity>
        </ScrollView>

        <FlatList
          data={data?.estabelecimentos || []}
          keyExtractor={(item, index) => item?.id ? String(item.id) : String(index)}
          renderItem={renderEstabelecimento}
          scrollEnabled={false} 
          contentContainerStyle={styles.lista}
          ListEmptyComponent={
            <Text style={{ textAlign: 'center', marginTop: 20, color: '#9CA3AF' }}>
              Você ainda não tem estabelecimentos cadastrados.
            </Text>
          }
        />
      </ScrollView>

      <View style={styles.bottomMenu}>
        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuIconActiveBg}>
            <Feather name="grid" size={20} color="#10B981" />
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <Feather name="list" size={22} color="#9CA3AF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <Feather name="scissors" size={22} color="#9CA3AF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <Feather name="calendar" size={22} color="#9CA3AF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/src/screens/PerfilAnfitriao')}>
          <Feather name="user" size={22} color="#9CA3AF" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF', paddingTop: Platform.OS === 'android' ? 10 : 0 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' },
  
  // HEADER
  topHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#FFF' },
  topHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  avatarMini: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#D1FAE5', justifyContent: 'center', alignItems: 'center', marginRight: 10, overflow: 'hidden' },
  avatarMiniImage: { width: '100%', height: '100%' },
  avatarMiniText: { color: '#10B981', fontWeight: 'bold', fontSize: 14 },
  greetingText: { fontSize: 16, fontWeight: 'bold', color: '#374151' },
  notificationBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  blueDashedLine: { height: 4, backgroundColor: '#3B82F6', width: '100%' }, 

  container: { flex: 1, backgroundColor: '#FFFFFF' },
  
  titleSection: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 15 },
  pageTitle: { fontSize: 22, fontWeight: '900', color: '#1F2937', marginBottom: 6 },
  pageSubtitle: { fontSize: 13, color: '#6B7280', lineHeight: 18 },

  // MÉTRICAS
  metricsWrapper: { paddingHorizontal: 20, gap: 12 },
  metricCard: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F3F4F6', borderRadius: 16, padding: 16, alignItems: 'center', elevation: 1, shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.05, shadowRadius: 3 },
  metricIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  metricInfo: { flex: 1 },
  metricLabel: { fontSize: 10, fontWeight: 'bold', color: '#9CA3AF', letterSpacing: 0.5, marginBottom: 2 },
  metricValue: { fontSize: 20, fontWeight: '900', color: '#1F2937' },
  metricDesc: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },

  // AÇÕES RÁPIDAS
  sectionHeader: { paddingHorizontal: 20, marginTop: 24, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F2937' },
  quickActionsScroll: { paddingLeft: 20, marginBottom: 20 },
  quickActionsContainer: { paddingRight: 40, gap: 10 },
  quickActionPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  quickActionText: { fontSize: 12, fontWeight: '600', color: '#4B5563', marginLeft: 6 },
  quickActionPillGreen: { backgroundColor: '#10B981', borderColor: '#10B981' },
  quickActionTextGreen: { fontSize: 12, fontWeight: '600', color: '#FFFFFF', marginLeft: 6 },

  // CARD DE ESTABELECIMENTO
  lista: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  estCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F3F4F6', borderRadius: 20, padding: 16, elevation: 2, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.05, shadowRadius: 5 },
  estHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  estAvatarPlaceholder: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginRight: 12, overflow: 'hidden' },
  estAvatarImage: { width: '100%', height: '100%' },
  estAvatarText: { fontSize: 16, fontWeight: 'bold', color: '#374151' },
  estInfo: { flex: 1 },
  estTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  estTitle: { fontSize: 15, fontWeight: 'bold', color: '#1F2937', marginRight: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  estSubtitle: { fontSize: 11, color: '#6B7280' },
  estMoreBtn: { padding: 4 },
  
  estFilaBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16, marginBottom: 16 },
  estFilaLabel: { fontSize: 13, color: '#4B5563', fontWeight: '500' },
  estFilaValue: { fontSize: 18, fontWeight: '900', color: '#1F2937' },

  estActionsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  estActionBtn: { flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB', paddingVertical: 12, borderRadius: 12 },
  estActionText: { fontSize: 10, fontWeight: '600', color: '#4B5563', marginTop: 6 },

  // MENU INFERIOR
  bottomMenu: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', backgroundColor: '#FFFFFF', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  menuItem: { alignItems: 'center', justifyContent: 'center', flex: 1, height: 50 },
  menuIconActiveBg: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#ECFDF5', justifyContent: 'center', alignItems: 'center' },

  // ERROS AMIGÁVEIS
  erroContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, backgroundColor: '#FFF' },
  erroIconContainer: { marginBottom: 20, padding: 20, backgroundColor: '#FEF2F2', borderRadius: 50 },
  erroTitulo: { fontSize: 28, fontWeight: '900', color: '#1F2937', marginBottom: 12 },
  erroTexto: { fontSize: 16, color: '#4B5563', textAlign: 'center', marginBottom: 8, fontWeight: '600' },
  erroSubTexto: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginBottom: 40 },
  btnTentar: { backgroundColor: '#10B981', paddingHorizontal: 30, paddingVertical: 16, borderRadius: 30, marginBottom: 16, width: '100%', alignItems: 'center', shadowColor: '#10B981', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  btnTentarTexto: { color: '#FFF', fontWeight: 'bold', fontSize: 16, letterSpacing: 0.5 },
  btnSairErro: { paddingHorizontal: 30, paddingVertical: 16, borderRadius: 30, backgroundColor: '#F3F4F6', width: '100%', alignItems: 'center' },
  btnSairErroTexto: { color: '#4B5563', fontWeight: 'bold', fontSize: 16 },
});