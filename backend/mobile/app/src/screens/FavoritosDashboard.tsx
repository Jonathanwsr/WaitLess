import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  FlatList,
  SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Cores da Identidade (Lokyva)
const COLORS = {
  primary: '#7C3AED', // Roxo Lokyva
  primaryLight: '#F5F3FF',
  accent: '#FF5A00', // Laranja
  secondary: '#111827',
  gray: '#6B7280',
  lightGray: '#F9FAFB',
  white: '#FFFFFF',
  border: '#F3F4F6',
  error: '#DC2626',
};

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';

export default function FavoritosDashboard() {
  const router = useRouter();
  const [abaAtiva, setAbaAtiva] = useState<'estabelecimentos' | 'servicos' | 'reservas'>('estabelecimentos');
  const [busca, setBusca] = useState('');
  
  // Estado inicial seguro para evitar erros de "undefined"
  const [dados, setDados] = useState<any>({ 
    estabelecimentos: [], 
    servicos: [], 
    reservas: { proximas: [], concluidas: [] } 
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('@waitless_token');
      const res = await fetch(`${API_URL}/favoritos`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      setDados({
        estabelecimentos: json.estabelecimentos || [],
        servicos: json.servicos || [],
        reservas: json.reservas || { proximas: [], concluidas: [] }
      });
    } catch (e) {
      console.log('Erro ao carregar favoritos');
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorito = async (tipo: string, id: number) => {
    try {
      const token = await AsyncStorage.getItem('@waitless_token');
      await fetch(`${API_URL}/favoritos/toggle`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, id })
      });
      carregarDados(); // Recarrega a lista para remover o item da tela
    } catch (e) {
      console.log('Erro ao favoritar');
    }
  };

  // ==========================================
  // RENDER: ESTABELECIMENTOS
  // ==========================================
  const renderEstabelecimento = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.cardAirbnb} 
      activeOpacity={0.9}
      // Corrigido para a rota real que vi na sua imagem
      onPress={() => router.push({ pathname: '/src/screens/EstabelecimentoDetalhes', params: { id: item.id } })}
    >
      <View style={styles.cardImageContainer}>
        <Image source={{ uri: item.foto_banner || 'https://via.placeholder.com/400x200' }} style={styles.cardBanner} />
        <TouchableOpacity style={styles.heartButton} onPress={() => toggleFavorito('estabelecimento', item.id)}>
          <Ionicons name="heart" size={20} color={COLORS.accent} />
        </TouchableOpacity>
      </View>
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.nome}</Text>
          <View style={styles.ratingBox}>
            <Ionicons name="star" size={12} color={COLORS.white} />
            <Text style={styles.ratingText}>{item.avaliacao_media || '5.0'}</Text>
          </View>
        </View>
        <Text style={styles.cardSub}>{item.ramo_atuacao} • A 2.5 km daqui</Text>
      </View>
    </TouchableOpacity>
  );

  // ==========================================
  // RENDER: SERVIÇOS
  // ==========================================
  const renderServico = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.cardServico}
      // Corrigido para a tela de ExplorarDetalhes
      onPress={() => router.push({ pathname: '/src/screens/ExplorarDetalhes', params: { id: item.id, tipo: 'servico' } })}
    >
      <Image source={{ uri: item.foto || 'https://via.placeholder.com/100' }} style={styles.imgServico} />
      <View style={styles.infoServico}>
        <Text style={styles.servicoNome} numberOfLines={1}>{item.nome}</Text>
        <Text style={styles.servicoLoja}>{item.estabelecimento?.nome}</Text>
        <View style={styles.rowSpecs}>
          <Text style={styles.servicoTempo}><Ionicons name="time-outline" size={12}/> {item.duracao_minutos} min</Text>
          <Text style={styles.servicoPreco}>R$ {Number(item.valor).toFixed(2).replace('.', ',')}</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.btnReservarServico}>
        <Text style={styles.txtBtnReservar}>Agendar</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  // ==========================================
  // RENDER: RESERVAS
  // ==========================================
  const renderReserva = ({ item, statusColor, statusLabel }: any) => (
    <TouchableOpacity 
      style={styles.cardReserva}
      // Rota correta baseada na sua imagem
      onPress={() => router.push({ pathname: '/agendamentos/detalhes', params: { id: item.id, tipo: 'servico' } })}
    >
      <View style={styles.reservaTop}>
        <View style={[styles.badgeReserva, { backgroundColor: statusColor + '20' }]}>
          <Text style={[styles.txtBadgeReserva, { color: statusColor }]}>{statusLabel}</Text>
        </View>
        <Text style={styles.reservaData}>{item.data_agendamento.split('-').reverse().join('/')} • {item.hora_agendamento.substring(0,5)}</Text>
      </View>
      <Text style={styles.reservaNome}>{item.servico?.nome}</Text>
      <Text style={styles.reservaLocal}><Ionicons name="location-outline" size={12}/> {item.estabelecimento?.nome}</Text>
      
      <View style={styles.reservaFooter}>
        <TouchableOpacity style={styles.btnAcaoList} onPress={() => router.push({ pathname: '/agendamentos/detalhes', params: { id: item.id, tipo: 'servico' } })}>
          <Text style={styles.txtBtnAcaoList}>Ver detalhes</Text>
        </TouchableOpacity>
        {statusLabel === 'Próxima' ? (
          <TouchableOpacity style={[styles.btnAcaoList, { backgroundColor: '#FEF2F2' }]}>
            <Text style={[styles.txtBtnAcaoList, { color: COLORS.error }]}>Cancelar</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        
        {/* BUSCA E FILTROS */}
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Salvos</Text>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color={COLORS.gray} />
            <TextInput 
              style={styles.inputSearch} 
              placeholder="Buscar em seus favoritos..." 
              value={busca}
              onChangeText={setBusca}
            />
            <TouchableOpacity style={styles.filterBtn}>
              <Ionicons name="options-outline" size={20} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ABAS */}
        <View style={styles.tabsContainer}>
          {['estabelecimentos', 'servicos', 'reservas'].map((tab) => (
            <TouchableOpacity 
              key={tab} 
              style={[styles.tab, abaAtiva === tab && styles.tabAtiva]}
              onPress={() => setAbaAtiva(tab as any)}
            >
              <Text style={[styles.tabText, abaAtiva === tab && styles.tabTextAtiva]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* CONTEÚDO */}
        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            
            {abaAtiva === 'estabelecimentos' ? (
              <FlatList 
                data={dados.estabelecimentos}
                scrollEnabled={false}
                keyExtractor={i => i.id.toString()}
                renderItem={renderEstabelecimento}
                ListEmptyComponent={<Text style={styles.empty}>Nenhum estabelecimento salvo.</Text>}
              />
            ) : null}

            {abaAtiva === 'servicos' ? (
              <FlatList 
                data={dados.servicos}
                scrollEnabled={false}
                keyExtractor={i => i.id.toString()}
                renderItem={renderServico}
                ListEmptyComponent={<Text style={styles.empty}>Nenhum serviço salvo.</Text>}
              />
            ) : null}

            {abaAtiva === 'reservas' ? (
              <View>
                {(dados.reservas?.proximas?.length ?? 0) > 0 ? (
                  <>
                    <Text style={styles.sectionTitle}>Próximas</Text>
                    {dados.reservas.proximas.map((item: any) => renderReserva({ item, statusColor: COLORS.primary, statusLabel: 'Próxima' }))}
                  </>
                ) : null}
                
                {(dados.reservas?.concluidas?.length ?? 0) > 0 ? (
                  <>
                    <Text style={styles.sectionTitle}>Concluídas</Text>
                    {dados.reservas.concluidas.map((item: any) => renderReserva({ item, statusColor: '#10B981', statusLabel: 'Finalizado' }))}
                  </>
                ) : null}

                {(dados.reservas?.proximas?.length ?? 0) === 0 && (dados.reservas?.concluidas?.length ?? 0) === 0 ? (
                    <Text style={styles.empty}>Nenhuma reserva encontrada.</Text>
                ) : null}
              </View>
            ) : null}
          </ScrollView>
        )}

        {/* BOTTOM NAVIGATION (Caminhos Corrigidos) */}
        <View style={styles.bottomNav}>
          <TouchableOpacity style={styles.navItem} onPress={() => router.push('/src/screens/Home')}>
            <Ionicons name="compass-outline" size={24} color={COLORS.gray} />
            <Text style={styles.navText}>Explorar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => router.push('/src/screens/MeusAgendamentos')}>
            <Ionicons name="calendar-outline" size={24} color={COLORS.gray} />
            <Text style={styles.navText}>Reservas</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem}>
            <Ionicons name="heart" size={24} color={COLORS.primary} />
            <Text style={[styles.navText, { color: COLORS.primary, fontWeight: '800' }]}>Favoritos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => router.push('/src/screens/TelaPerfil')}>
            <Ionicons name="person-circle-outline" size={24} color={COLORS.gray} />
            <Text style={styles.navText}>Perfil</Text>
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white },
  container: { flex: 1, backgroundColor: COLORS.lightGray },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 20, paddingBottom: 100 },
  empty: { textAlign: 'center', color: COLORS.gray, marginTop: 40, fontSize: 15 },

  // Header & Search
  header: { paddingHorizontal: 20, paddingTop: 20, backgroundColor: COLORS.white },
  pageTitle: { fontSize: 32, fontWeight: '900', color: COLORS.secondary, letterSpacing: -1, marginBottom: 16 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 100, paddingHorizontal: 16, height: 50, borderWidth: 1, borderColor: COLORS.border, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  inputSearch: { flex: 1, marginLeft: 10, fontSize: 15, color: COLORS.secondary },
  filterBtn: { backgroundColor: COLORS.primaryLight, padding: 6, borderRadius: 20 },

  // Tabs
  tabsContainer: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tab: { marginRight: 16, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabAtiva: { borderBottomColor: COLORS.primary },
  tabText: { fontSize: 14, fontWeight: '700', color: COLORS.gray },
  tabTextAtiva: { color: COLORS.primary, fontWeight: '900' },

  // Card Airbnb Style (Estabelecimentos)
  cardAirbnb: { backgroundColor: COLORS.white, borderRadius: 24, marginBottom: 24, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 4 },
  cardImageContainer: { position: 'relative' },
  cardBanner: { width: '100%', height: 180 },
  heartButton: { position: 'absolute', top: 16, right: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  cardContent: { padding: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardTitle: { fontSize: 18, fontWeight: '900', color: COLORS.secondary, flex: 1 },
  ratingBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.secondary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  ratingText: { color: COLORS.white, fontSize: 12, fontWeight: '900', marginLeft: 4 },
  cardSub: { fontSize: 14, color: COLORS.gray, fontWeight: '500' },

  // Card Serviços
  cardServico: { flexDirection: 'row', backgroundColor: COLORS.white, padding: 12, borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  imgServico: { width: 70, height: 70, borderRadius: 16 },
  infoServico: { flex: 1, marginLeft: 12 },
  servicoNome: { fontSize: 16, fontWeight: '900', color: COLORS.secondary },
  servicoLoja: { fontSize: 12, color: COLORS.gray, marginBottom: 6 },
  rowSpecs: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  servicoTempo: { fontSize: 12, color: COLORS.gray, fontWeight: '600' },
  servicoPreco: { fontSize: 14, fontWeight: '900', color: COLORS.accent },
  btnReservarServico: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100 },
  txtBtnReservar: { color: COLORS.primary, fontWeight: '900', fontSize: 12 },

  // Card Reservas
  sectionTitle: { fontSize: 18, fontWeight: '900', color: COLORS.secondary, marginTop: 10, marginBottom: 16 },
  cardReserva: { backgroundColor: COLORS.white, padding: 20, borderRadius: 24, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  reservaTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  badgeReserva: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  txtBadgeReserva: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  reservaData: { fontSize: 12, color: COLORS.gray, fontWeight: '700' },
  reservaNome: { fontSize: 18, fontWeight: '900', color: COLORS.secondary, marginBottom: 4 },
  reservaLocal: { fontSize: 13, color: COLORS.gray, fontWeight: '500', marginBottom: 16 },
  reservaFooter: { flexDirection: 'row', gap: 12, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 16 },
  btnAcaoList: { flex: 1, backgroundColor: COLORS.lightGray, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  txtBtnAcaoList: { fontSize: 13, fontWeight: '900', color: COLORS.secondary },

  // Bottom Navigation
  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, backgroundColor: COLORS.white, flexDirection: 'row', borderTopWidth: 1, borderTopColor: COLORS.border, paddingBottom: 20 },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 10 },
  navText: { fontSize: 10, fontWeight: '600', color: COLORS.gray, marginTop: 4 }
});