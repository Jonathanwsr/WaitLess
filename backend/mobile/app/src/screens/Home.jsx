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
  Dimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

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

// Textos dinâmicos para a barra de pesquisa
const PLACEHOLDERS = [
  'Procure por serviços...',
  'Reservas em restaurantes...',
  'Aluguel de carros...',
  'Viagens, hotéis e pousadas...',
  'Casas de temporada...'
];

// Categorias Principais
const MAIN_CATEGORIES = [
  { id: '1', name: 'Hospedagens', slug: 'hospedagem', icone: 'bed-outline' },
  { id: '2', name: 'Restaurantes', slug: 'restaurante', icone: 'restaurant-outline' },
  { id: '3', name: 'Serviços', slug: 'servico', icone: 'briefcase-outline' },
  { id: '4', name: 'Experiências', slug: 'experiencia', icone: 'camera-outline' },
  { id: '5', name: 'Aluguel de Carros', slug: 'aluguel', icone: 'car-sport-outline' },
];

// Categorias Secundárias
const SECONDARY_CATEGORIES = [
  { id: 'sec1', name: 'Eventos', icone: 'ticket-outline' },
  { id: 'sec2', name: 'Passeios', icone: 'compass-outline' },
  { id: 'sec3', name: 'Cupons', icone: 'pricetag-outline' },
  { id: 'sec4', name: 'Pontos', icone: 'star-outline' },
  { id: 'sec5', name: 'Favoritos', icone: 'heart-outline' },
];

// Destinos Estáticos de Fallback
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

  // Estados sem anotações de tipo TypeScript
  const [stores, setStores] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Buscando localização...');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoriaAtiva, setCategoriaAtiva] = useState(null);

  // Animação/Alternância de Placeholder da Pesquisa
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  // Estados de Localização
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const [addressData, setAddressData] = useState({ logradouro: '', numero: '', cidadeUf: '' });

  const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';

  // Efeito para trocar o placeholder a cada 2.5 segundos
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
      const response = await fetch(`${API_BASE_URL}/estabelecimentos/proximos?${queryParams}&radius=15`, {
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

  // Lista de destinos a ser exibida (da API ou o fallback estático)
  const destinosExibicao = stores.length > 0 ? stores : DESTINOS_PADRAO;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.mainContainer}>
        
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          {/* HERO SECTION COM IMAGEM DE FUNDO */}
          <ImageBackground
            source={{ uri: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?q=80&w=1000' }}
            style={styles.heroBackground}
            imageStyle={{ borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}
          >
            <View style={styles.heroOverlay}>
              
              {/* TOP HEADER */}
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

              {/* TÍTULO HERO */}
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

              {/* BARRA DE PESQUISA COM PLACEHOLDER ROTATIVO */}
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
                <TouchableOpacity style={styles.filterBtn} onPress={() => router.push('/modal')}>
                  <Ionicons name="options-outline" size={20} color={COLORS.black} />
                </TouchableOpacity>
              </View>

            </View>
          </ImageBackground>

          {/* PAINEL DE LOCALIZAÇÃO */}
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

          {/* CATEGORIAS PRINCIPAIS */}
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

          {/* SEÇÃO: DESTINOS EM ALTA (ROLÁVEL PARA OS DOIS LADOS) */}
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
                  
                  {/* Tag Superior & Coração */}
                  <View style={styles.cardHeaderOverlay}>
                    <View style={styles.tagPill}>
                      <Text style={styles.tagText}>{item.ramo_atuacao || 'Destino'}</Text>
                    </View>
                    <TouchableOpacity style={styles.heartBtn}>
                      <Ionicons name="heart-outline" size={18} color={COLORS.white} />
                    </TouchableOpacity>
                  </View>

                  {/* Informações Inferiores */}
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

          {/* BANNER PROMOCIONAL: GANHE MAIS COM LOKYVA */}
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

          {/* SEÇÃO: TUDO O QUE VOCÊ PRECISA */}
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

          {/* BOTÃO PRINCIPAL EXPLORAR */}
          <TouchableOpacity 
            style={styles.explorarAgoraBtn}
            onPress={() => router.push('/src/screens/TelaExplorar')}
          >
            <Text style={styles.explorarAgoraText}>Explorar agora</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.white} />
          </TouchableOpacity>

        </ScrollView>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white,
    paddingTop: Platform.OS === 'android' ? 25 : 0
  },
  mainContainer: {
    flex: 1,
    position: 'relative'
  },
  scrollContent: {
    paddingBottom: 30
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
  }
});