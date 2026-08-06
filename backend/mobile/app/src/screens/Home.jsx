import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  ImageBackground,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Platform,
  Dimensions,
  Modal,
  StatusBar // <-- IMPORTADO PARA MOSTRAR A BATERIA
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

// Pega a URL do .env com fallback e limpa barras duplas no final
const ENV_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api';
const cleanBaseUrl = ENV_URL.endsWith('/') ? ENV_URL.slice(0, -1) : ENV_URL;

// --- PALETA DE CORES ---
const COLORS = {
  primary: '#FF5A00',      // Laranja Lokyva
  primaryLight: '#FFF0E6', // Laranja bem claro
  secondary: '#111827',   // Texto escuro
  black: '#000000',       // Preto puro para ícones
  gray: '#6B7280',
  lightGray: '#F8F9FA',
  white: '#FFFFFF',
  border: '#E5E7EB',
  warning: '#FFB800'
};

const STORAGE_KEYS = {
  ADDRESS: '@lokyva_address',
  COORDS: '@lokyva_coords',
  FORMATTED: '@lokyva_formatted'
};

const PLACEHOLDERS = [
  'Procure por serviços...',
  'Reservas em restaurantes...',
  'Aluguel de carros...',
  'Viagens, hotéis e pousadas...',
  'Casas de temporada...'
];

const MAIN_CATEGORIES = [
  { id: '1', name: 'Hospedagens', slug: 'hospedagem', icone: 'bed-outline' },
  { id: '2', name: 'Restaurantes', slug: 'restaurante', icone: 'restaurant-outline' },
  { id: '3', name: 'Serviços', slug: 'servico', icone: 'briefcase-outline' },
  { id: '4', name: 'Experiências', slug: 'experiencia', icone: 'camera-outline' },
  { id: '5', name: 'Aluguel de Carros', slug: 'aluguel', icone: 'car-sport-outline' },
];

const SECONDARY_CATEGORIES = [
  { id: 'sec1', name: 'Eventos', icone: 'ticket-outline' },
  { id: 'sec2', name: 'Passeios', icone: 'compass-outline' },
  { id: 'sec3', name: 'Cupons', icone: 'pricetag-outline' },
  { id: 'sec4', name: 'Pontos', icone: 'star-outline' },
  { id: 'sec5', name: 'Favoritos', icone: 'heart-outline' },
];

const DESTINOS_PADRAO = [
  {
    id: 'f1',
    nome: 'Rio de Janeiro, RJ',
    ramo_atuacao: 'Praia',
    foto_perfil: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=400',
    avaliacao_media: '4.8'
  },
  {
    id: 'f2',
    nome: 'Gramado, RS',
    ramo_atuacao: 'Montanha',
    foto_perfil: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=400',
    avaliacao_media: '4.9'
  },
  {
    id: 'f3',
    nome: 'Salvador, BA',
    ramo_atuacao: 'Cultura & Praia',
    foto_perfil: 'https://images.unsplash.com/photo-1548625361-18da90e633f8?q=80&w=400',
    avaliacao_media: '4.7'
  },
  {
    id: 'f4',
    nome: 'Florianópolis, SC',
    ramo_atuacao: 'Ilha & Surf',
    foto_perfil: 'https://images.unsplash.com/photo-1583037189850-1921ae7c6c22?q=80&w=400',
    avaliacao_media: '4.8'
  }
];

export default function Home() {
  const router = useRouter();

  const [stores, setStores] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Buscando localização...');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoriaAtiva, setCategoriaAtiva] = useState(null);

  // --- ESTADO PARA CONTROLAR O SEU MODAL ---
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);

  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const [addressData, setAddressData] = useState({ logradouro: '', numero: '', cidadeUf: '' });

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prevIndex) => (prevIndex + 1) % PLACEHOLDERS.length);
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadSavedLocationOrFetchGPS();
  }, []);

  const loadSavedLocationOrFetchGPS = async () => {
    try {
      const storedCoords = await AsyncStorage.getItem(STORAGE_KEYS.COORDS);
      const storedAddress = await AsyncStorage.getItem(STORAGE_KEYS.ADDRESS);
      const storedFormatted = await AsyncStorage.getItem(STORAGE_KEYS.FORMATTED);

      if (storedCoords) {
        setStatusMessage(storedFormatted || 'Sua Localização Atual');
        fetchNearbyStores(JSON.parse(storedCoords));
      } else if (storedAddress) {
        setStatusMessage(storedFormatted || 'Endereço salvo');
        const parsed = JSON.parse(storedAddress);
        setAddressData(parsed);
        fetchNearbyStores(parsed);
      } else {
        getLocationViaGPS();
      }
    } catch (e) {
      getLocationViaGPS();
    }
  };

  const getLocationViaGPS = async () => {
    setIsLoading(true);
    setIsEditingLocation(false);
    setStores([]);

    let { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      setStatusMessage('Permissão negada. Digite seu endereço.');
      setIsLoading(false);
      return;
    }

    try {
      setStatusMessage('Calculando localização...');
      let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { lat: location.coords.latitude, lng: location.coords.longitude };

      setStatusMessage('Sua Localização Atual');
      await AsyncStorage.setItem(STORAGE_KEYS.COORDS, JSON.stringify(coords));
      await AsyncStorage.setItem(STORAGE_KEYS.FORMATTED, 'Sua Localização Atual');
      await AsyncStorage.removeItem(STORAGE_KEYS.ADDRESS);

      fetchNearbyStores(coords);
    } catch (error) {
      setStatusMessage('Erro no GPS. Toque para digitar.');
      setIsLoading(false);
    }
  };

  const fetchNearbyStores = async (params) => {
    setIsLoading(true);
    try {
      const token = await AsyncStorage.getItem('@lokyva_token');
      const queryParams = new URLSearchParams(params).toString();
      
      // AJUSTE: Corrigido o nome da variável de API_BASE_URL para cleanBaseUrl
      const response = await fetch(`${cleanBaseUrl}/estabelecimentos/proximos?${queryParams}&radius=15`, {
        headers: { 
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}` 
        }
      });

      const data = await response.json();
      setStores(Array.isArray(data) ? data : []);
    } catch (error) {
      setStores([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCategorySearch = (categorySlug) => {
    if (categoriaAtiva === categorySlug) {
      setCategoriaAtiva(null);
      loadSavedLocationOrFetchGPS();
    } else {
      setCategoriaAtiva(categorySlug);
      fetchNearbyStores({ categoria: categorySlug });
    }
  };

  const handleMainSearch = () => {
    if (!searchQuery.trim()) return;
    router.push({
      pathname: '/src/screens/TelaExplorar',
      params: { query: searchQuery }
    });
  };

  const handleSaveLocation = async () => {
    if (!addressData.logradouro || !addressData.cidadeUf) {
      Alert.alert('Ops', 'Preencha Rua e Cidade.');
      return;
    }

    setIsSavingLocation(true);
    try {
      const formatted = `${addressData.logradouro}${addressData.numero ? ', ' + addressData.numero : ''}`;
      await AsyncStorage.setItem(STORAGE_KEYS.ADDRESS, JSON.stringify(addressData));
      await AsyncStorage.setItem(STORAGE_KEYS.FORMATTED, formatted);
      await AsyncStorage.removeItem(STORAGE_KEYS.COORDS);

      setStatusMessage(formatted);
      setIsEditingLocation(false);
      fetchNearbyStores(addressData);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível salvar o endereço.');
    } finally {
      setIsSavingLocation(false);
    }
  };

  // --- NOVA FUNÇÃO PARA CHECAR LOGIN ANTES DE IR PRO PERFIL ---
  const handleProfilePress = async () => {
    try {
      // Ajuste: A sua tela de login salvava como '@waitless_token' nos códigos anteriores, 
      // alterei para tentar buscar ambos e garantir o login
      let token = await AsyncStorage.getItem('@lokyva_token');
      if (!token) token = await AsyncStorage.getItem('@waitless_token'); 

      router.push({
        pathname: '/src/screens/TelaPerfil',
        params: { isLoggedIn: token ? 'true' : 'false' }
      });
    } catch (error) {
      router.push({
        pathname: '/src/screens/TelaPerfil',
        params: { isLoggedIn: 'false' }
      });
    }
  };

  const destinosExibicao = stores.length > 0 ? stores : DESTINOS_PADRAO;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* BARRA DE STATUS CONFIGURADA PARA APARECER BATERIA E HORA */}
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} translucent={false} />
      
      <View style={styles.mainContainer}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          <ImageBackground
            source={{ uri: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?q=80&w=1000' }}
            style={styles.heroBackground}
            imageStyle={{ borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}
          >
            <View style={styles.heroOverlay}>
              <View style={styles.heroHeader}>
                <View style={styles.logoContainer}>
                  <Text style={styles.logoTitle}>
                    <Text style={styles.logoIcon}>w </Text>lokyva
                  </Text>
                  <Text style={styles.logoSubtitle}>Viaje. Reserve. Viva.</Text>
                </View>
                <TouchableOpacity style={styles.pularBtn}>
                  <Text style={styles.pularBtnText}>Pular</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.heroTitleContainer}>
                <Text style={styles.heroTitle}>
                  Sua próxima{'\n'}
                  <Text style={styles.heroTitleHighlight}>experiência</Text>{'\n'}
                  começa aqui.
                </Text>
                <Text style={styles.heroDescription}>
                  Encontre os melhores destinos, hospedagens, serviços e experiências em um só lugar.
                </Text>
              </View>

              <View style={styles.searchBox}>
                <Ionicons name="search-outline" size={20} color={COLORS.black} style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder={PLACEHOLDERS[placeholderIndex]}
                  placeholderTextColor={COLORS.gray}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={handleMainSearch}
                  returnKeyType="search"
                />
                
                {/* BOTÃO ALTERADO AQUI PARA ABRIR O SEU MODAL */}
                <TouchableOpacity style={styles.filterBtn} onPress={() => setIsFilterModalVisible(true)}>
                  <Ionicons name="options-outline" size={20} color={COLORS.black} />
                </TouchableOpacity>
              </View>

            </View>
          </ImageBackground>

          <View style={styles.locationWrapper}>
            {!isEditingLocation ? (
              <TouchableOpacity style={styles.locationDisplay} onPress={() => setIsEditingLocation(true)}>
                <Ionicons name="location-outline" size={18} color={COLORS.black} />
                <Text style={styles.locationText} numberOfLines={1}>{statusMessage}</Text>
                <Text style={styles.locationChangeBtn}>Alterar</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.locationForm}>
                <View style={styles.locationFormHeader}>
                  <Text style={styles.locationFormTitle}>Definir localização</Text>
                  <TouchableOpacity onPress={getLocationViaGPS} style={styles.gpsBtn}>
                    <Ionicons name="locate-outline" size={16} color={COLORS.black} />
                    <Text style={styles.gpsBtnText}>Usar GPS</Text>
                  </TouchableOpacity>
                </View>
                <TextInput 
                  style={styles.input} 
                  placeholder="Rua / Avenida" 
                  value={addressData.logradouro} 
                  onChangeText={t => setAddressData({...addressData, logradouro: t})} 
                />
                <View style={styles.row}>
                  <TextInput 
                    style={[styles.input, { flex: 1, marginRight: 8 }]} 
                    placeholder="Número" 
                    value={addressData.numero} 
                    onChangeText={t => setAddressData({...addressData, numero: t})} 
                  />
                  <TextInput 
                    style={[styles.input, { flex: 2 }]} 
                    placeholder="Cidade / UF" 
                    value={addressData.cidadeUf} 
                    onChangeText={t => setAddressData({...addressData, cidadeUf: t})} 
                  />
                </View>
                <View style={styles.formActions}>
                  <TouchableOpacity onPress={() => setIsEditingLocation(false)} style={styles.btnCancel}>
                    <Text style={styles.btnCancelText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSaveLocation} style={styles.btnSave}>
                    {isSavingLocation ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.btnSaveText}>Confirmar</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={styles.categoriesScroll}
            contentContainerStyle={styles.categoriesContainer}
          >
            {MAIN_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryCard,
                  categoriaAtiva === cat.slug && styles.categoryCardActive
                ]}
                onPress={() => cat.slug && handleCategorySearch(cat.slug)}
              >
                <Ionicons name={cat.icone} size={26} color={COLORS.black} />
                <Text style={styles.categoryText} numberOfLines={2}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Destinos em alta</Text>
            <TouchableOpacity onPress={() => router.push('/src/screens/TelaExplorar')} style={styles.verTodosBtn}>
              <Text style={styles.verTodosText}>Ver todos</Text>
              <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              decelerationRate="fast"
              snapToAlignment="start"
              contentContainerStyle={styles.destaquesScroll}
            >
              {destinosExibicao.map((item) => (
                <TouchableOpacity 
                  key={item.id} 
                  style={styles.cardDestino}
                  activeOpacity={0.9}
                  onPress={() => router.push({ pathname: '/src/screens/EstabelecimentoDetalhes', params: { id: item.id } })}
                >
                  <Image 
                    source={{ uri: item.foto_perfil || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=400' }} 
                    style={styles.cardImage} 
                  />
                  
                  <View style={styles.cardHeaderOverlay}>
                    <View style={styles.tagPill}>
                      <Text style={styles.tagText}>{item.ramo_atuacao || 'Destino'}</Text>
                    </View>
                    <TouchableOpacity style={styles.heartBtn}>
                      <Ionicons name="heart-outline" size={18} color={COLORS.white} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.cardBottomOverlay}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{item.nome}</Text>
                    <View style={styles.ratingRow}>
                      <Ionicons name="star" size={14} color={COLORS.warning} />
                      <Text style={styles.ratingText}>
                        {item.avaliacao_media || '4.8'} <Text style={styles.ratingCount}>(128)</Text>
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <View style={styles.promoBanner}>
            <View style={styles.promoIconContainer}>
              <Ionicons name="gift-outline" size={28} color={COLORS.black} />
            </View>
            <View style={styles.promoTextContainer}>
              <Text style={styles.promoTitle}>Ganhe mais com Lokyva</Text>
              <Text style={styles.promoDesc}>
                Acumule pontos em suas reservas e troque por benefícios exclusivos.
              </Text>
            </View>
            <TouchableOpacity style={styles.saibaMaisBtn}>
              <Text style={styles.saibaMaisText}>Saiba mais</Text>
              <Ionicons name="chevron-forward" size={12} color={COLORS.white} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.sectionTitle, { marginLeft: 16, marginBottom: 16 }]}>
            Tudo o que você precisa
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.secondaryCategoriesContainer}>
            {SECONDARY_CATEGORIES.map((cat) => (
              <TouchableOpacity key={cat.id} style={styles.secondaryCategoryCard}>
                <Ionicons name={cat.icone} size={24} color={COLORS.black} />
                <Text style={styles.secondaryCategoryText}>{cat.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity 
            style={styles.explorarAgoraBtn}
            onPress={() => router.push('/src/screens/TelaExplorar')}
          >
            <Text style={styles.explorarAgoraText}>Explorar agora</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.white} />
          </TouchableOpacity>

        </ScrollView>

        {/* --- MENU DE NAVEGAÇÃO INFERIOR FLUTUANTE --- */}
        <View style={styles.bottomNavContainer}>
          <TouchableOpacity style={styles.navItem} onPress={() => router.push('/src/screens/TelaExplorar')}>
            <Ionicons name="compass-outline" size={24} color={COLORS.black} />
            <Text style={styles.navText}>Explorar</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.navItem} onPress={() => router.push('/src/screens/FavoritosDashboard')}>
            <Ionicons name="heart-outline" size={24} color={COLORS.black} />
            <Text style={styles.navText}>Favoritos</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.navItem} onPress={() => router.push('/src/screens/TelaCarrinho')}>
            <Ionicons name="cart-outline" size={24} color={COLORS.black} />
            <Text style={styles.navText}>Carrinho</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.navItem} onPress={() => router.push('/(tabs)/carteira')}>
            <Ionicons name="wallet-outline" size={24} color={COLORS.black} />
            <Text style={styles.navText}>Carteira</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.navItem} onPress={() => router.push('/(tabs)/caixa-entrada')}>
            <Ionicons name="chatbubbles-outline" size={24} color={COLORS.black} />
            <Text style={styles.navText}>Inbox</Text>
          </TouchableOpacity>

          {/* ATUALIZADO PARA USAR A NOVA FUNÇÃO handleProfilePress */}
          <TouchableOpacity style={styles.navItem} onPress={handleProfilePress}>
            <Ionicons name="person-outline" size={24} color={COLORS.black} />
            <Text style={styles.navText}>Perfil</Text>
          </TouchableOpacity>
        </View>
        {/* ------------------------------------------- */}
      </View>

      {/* --- AQUI ENTRA O SEU MODAL --- */}
      <Modal
        visible={isFilterModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtros</Text>
              <TouchableOpacity onPress={() => setIsFilterModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.black} />
              </TouchableOpacity>
            </View>
            
            <Text style={{ marginTop: 20, textAlign: 'center', color: COLORS.gray }}>
              Coloque o conteúdo do seu modal aqui
            </Text>

          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white,
    // Ajuste responsivo e de compatibilidade para a Status Bar no Android
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0
  },
  mainContainer: {
    flex: 1,
    position: 'relative'
  },
  scrollContent: {
    // Aumentado para 120 para compensar que o menu subiu
    paddingBottom: 120
  },

  // HERO BACKGROUND
  heroBackground: {
    width: '100%',
    height: 380,
    justifyContent: 'space-between'
  },
  heroOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    justifyContent: 'space-between',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  logoContainer: {
    flexDirection: 'column'
  },
  logoTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: -0.5
  },
  logoIcon: {
    color: COLORS.primary,
    fontWeight: '900'
  },
  logoSubtitle: {
    fontSize: 10,
    color: COLORS.white,
    opacity: 0.9,
    marginTop: -2
  },
  pularBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20
  },
  pularBtnText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '600'
  },
  heroTitleContainer: {
    marginVertical: 10
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.white,
    lineHeight: 34
  },
  heroTitleHighlight: {
    color: COLORS.primary
  },
  heroDescription: {
    fontSize: 13,
    color: COLORS.white,
    opacity: 0.9,
    marginTop: 8,
    maxWidth: '85%',
    lineHeight: 18
  },

  // SEARCH BOX
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 30,
    paddingHorizontal: 16,
    height: 52,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4
  },
  searchIcon: {
    marginRight: 10
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.secondary,
    fontWeight: '500'
  },
  filterBtn: {
    padding: 6
  },

  // LOCATION
  locationWrapper: {
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8
  },
  locationDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12
  },
  locationText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.secondary,
    fontWeight: '600',
    marginLeft: 6
  },
  locationChangeBtn: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary
  },
  locationForm: {
    backgroundColor: COLORS.white,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  locationFormHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  locationFormTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.secondary
  },
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  gpsBtnText: {
    color: COLORS.black,
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4
  },
  input: {
    backgroundColor: COLORS.lightGray,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    fontSize: 13
  },
  row: {
    flexDirection: 'row'
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4
  },
  btnCancel: {
    padding: 8,
    marginRight: 8
  },
  btnCancelText: {
    color: COLORS.gray,
    fontWeight: '600',
    fontSize: 13
  },
  btnSave: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8
  },
  btnSaveText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 13
  },

  // CATEGORIAS PRINCIPAIS
  categoriesScroll: {
    marginVertical: 12
  },
  categoriesContainer: {
    paddingHorizontal: 16
  },
  categoryCard: {
    width: 82,
    height: 82,
    backgroundColor: COLORS.lightGray,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    padding: 6
  },
  categoryCardActive: {
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.black,
    marginTop: 6,
    textAlign: 'center'
  },

  // HEADERS DE SEÇÃO
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 12
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.secondary
  },
  verTodosBtn: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  verTodosText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '700',
    marginRight: 2
  },

  // CARDS DE DESTINO EM ALTA (HORIZONTAL)
  destaquesScroll: {
    paddingHorizontal: 16,
    paddingBottom: 8
  },
  cardDestino: {
    width: width * 0.44,
    height: 200,
    borderRadius: 18,
    marginRight: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.secondary,
    position: 'relative'
  },
  cardImage: {
    width: '100%',
    height: '100%',
    position: 'absolute'
  },
  cardHeaderOverlay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    zIndex: 2
  },
  tagPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12
  },
  tagText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.secondary
  },
  heartBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  cardBottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.45)'
  },
  cardTitle: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  ratingText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 4
  },
  ratingCount: {
    color: COLORS.lightGray,
    fontWeight: '400',
    fontSize: 10
  },

  // BANNER PROMOCIONAL
  promoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    borderRadius: 16,
    marginHorizontal: 16,
    padding: 14,
    marginVertical: 20
  },
  promoIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  promoTextContainer: {
    flex: 1,
    marginRight: 8
  },
  promoTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.secondary,
    marginBottom: 2
  },
  promoDesc: {
    fontSize: 11,
    color: COLORS.gray,
    lineHeight: 14
  },
  saibaMaisBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center'
  },
  saibaMaisText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '800',
    marginRight: 2
  },

  // CATEGORIAS SECUNDÁRIAS ("TUDO O QUE VOCÊ PRECISA")
  secondaryCategoriesContainer: {
    paddingHorizontal: 16,
    marginBottom: 20
  },
  secondaryCategoryCard: {
    width: 72,
    height: 72,
    backgroundColor: COLORS.lightGray,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    padding: 4
  },
  secondaryCategoryText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.black,
    marginTop: 4
  },

  // BOTÃO PRINCIPAL EXPLORAR
  explorarAgoraBtn: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 30,
    marginBottom: 10
  },
  explorarAgoraText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '900',
    marginRight: 4
  },

  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 30
  },

  // --- NOVOS ESTILOS PARA O MODAL ---
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)'
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    minHeight: '50%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.secondary
  },

  // --- ESTILOS DO MENU INFERIOR (BOTTOM NAV) ---
  bottomNavContainer: {
    position: 'absolute',
    // <-- AJUSTADO PARA SUBIR O MENU (de 24/16 para 40/32)
    bottom: Platform.OS === 'ios' ? 40 : 32,
    left: 16,
    right: 16,
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  navText: {
    fontSize: 10,
    color: COLORS.black,
    fontWeight: '600',
    marginTop: 2,
  }
});