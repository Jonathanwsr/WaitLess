import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  FlatList,
  Alert,
  SafeAreaView,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

// --- CORES PADRÃO (Inspirado na imagem) ---
const COLORS = {
  primary: '#FF5A00', // Laranja
  primaryLight: '#FFF4ED',
  secondary: '#111827', // Quase preto para textos principais
  gray: '#6B7280',
  lightGray: '#F3F4F6',
  white: '#FFFFFF',
  border: '#E5E7EB',
  warning: '#FBBF24' // Amarelo para estrelas e pontos
};

const STORAGE_KEYS = {
  ADDRESS: '@waitless_address',
  COORDS: '@waitless_coords',
  FORMATTED: '@waitless_formatted'
};

// Ícones reais do Ionicons para garantir que vão aparecer
const SERVICE_CATEGORIES = [
  { id: '1', name: 'Hospedagens', slug: 'hospedagem', icone: 'bed-outline' },
  { id: '2', name: 'Restaurantes', slug: 'restaurante', icone: 'restaurant-outline' },
  { id: '3', name: 'Serviços', slug: 'servico', icone: 'construct-outline' },
  { id: '4', name: 'Experiências', slug: 'experiencia', icone: 'camera-outline' },
  { id: '5', name: 'Aluguel', slug: 'aluguel', icone: 'car-sport-outline' },
];

export default function Home() {
  const router = useRouter();

  const [stores, setStores] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Buscando localização...');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoriaAtiva, setCategoriaAtiva] = useState(null);

  // Estados de Localização
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const [addressData, setAddressData] = useState({ logradouro: '', numero: '', cidadeUf: '' });

  const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';

  useEffect(() => {
    loadSavedLocationOrFetchGPS();
  }, []);

  const loadSavedLocationOrFetchGPS = async () => {
    try {
      const storedCoords = await AsyncStorage.getItem(STORAGE_KEYS.COORDS);
      const storedAddress = await AsyncStorage.getItem(STORAGE_KEYS.ADDRESS);
      const storedFormatted = await AsyncStorage.getItem(STORAGE_KEYS.FORMATTED);

      if (storedCoords) {
        setStatusMessage(storedFormatted || 'Usando GPS salvo');
        fetchNearbyStores(JSON.parse(storedCoords));
      } else if (storedAddress) {
        setStatusMessage(storedFormatted || 'Usando endereço salvo');
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
      const token = await AsyncStorage.getItem('@waitless_token');
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
      setCategoriaAtiva(null); // Desmarca se clicar de novo
      loadSavedLocationOrFetchGPS();
    } else {
      setCategoriaAtiva(categorySlug);
      fetchNearbyStores({ categoria: categorySlug });
    }
  };

  const handleMainSearch = () => {
    if (!searchQuery.trim()) return;
    // Redireciona para a Tela Explorar passando a busca
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

  // Divide os dados para criar as duas seções da imagem ("Destinos em alta" e "Serviços recomendados")
  const destaques = stores.slice(0, 3);
  const recomendados = stores.slice(3, 8);

  return (
    <SafeAreaView style={styles.safeArea}>
      
      {/* HEADER SUPERIOR FIXO */}
      <View style={styles.header}>
        <Text style={styles.logoText}>waitless</Text>
        <View style={styles.headerIcons}>
          <TouchableOpacity onPress={() => router.push('/src/screens/FavoritosDashboard')}>
            <Ionicons name="heart-outline" size={26} color={COLORS.secondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/src/screens/PagamentoScreen')} style={styles.iconMargin}>
            <Ionicons name="bag-handle-outline" size={26} color={COLORS.secondary} />
            <View style={styles.badge} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/src/screens/TelaPerfil')} style={styles.iconMargin}>
            <View style={styles.profilePicPlaceholder}>
              <Ionicons name="person" size={16} color={COLORS.white} />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* BARRA DE PESQUISA */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={COLORS.gray} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Para onde você vai ou busca?"
            placeholderTextColor={COLORS.gray}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleMainSearch}
            returnKeyType="search"
          />
          <TouchableOpacity style={styles.filterBtn} onPress={() => router.push('/modal')}>
            <Ionicons name="options-outline" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* CONTROLE DE LOCALIZAÇÃO (Moderno e Integrado) */}
        <View style={styles.locationWrapper}>
          {!isEditingLocation ? (
            <TouchableOpacity style={styles.locationDisplay} onPress={() => setIsEditingLocation(true)}>
              <Ionicons name="location" size={16} color={COLORS.primary} />
              <Text style={styles.locationText} numberOfLines={1}>📍 {statusMessage}</Text>
              <Text style={styles.locationChangeBtn}>Alterar</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.locationForm}>
              <View style={styles.locationFormHeader}>
                <Text style={styles.locationFormTitle}>Definir localização</Text>
                <TouchableOpacity onPress={getLocationViaGPS} style={styles.gpsBtn}>
                  <Ionicons name="locate" size={16} color={COLORS.primary} />
                  <Text style={styles.gpsBtnText}>Usar GPS</Text>
                </TouchableOpacity>
              </View>
              <TextInput style={styles.input} placeholder="Rua / Avenida" value={addressData.logradouro} onChangeText={t => setAddressData({...addressData, logradouro: t})} />
              <View style={styles.row}>
                <TextInput style={[styles.input, { flex: 1, marginRight: 8 }]} placeholder="Número" value={addressData.numero} onChangeText={t => setAddressData({...addressData, numero: t})} />
                <TextInput style={[styles.input, { flex: 2 }]} placeholder="Cidade / UF" value={addressData.cidadeUf} onChangeText={t => setAddressData({...addressData, cidadeUf: t})} />
              </View>
              <View style={styles.formActions}>
                <TouchableOpacity onPress={() => setIsEditingLocation(false)} style={styles.btnCancel}><Text style={styles.btnCancelText}>Cancelar</Text></TouchableOpacity>
                <TouchableOpacity onPress={handleSaveLocation} style={styles.btnSave}>
                  {isSavingLocation ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.btnSaveText}>Confirmar</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* CARD DE PONTOS (Estilo Imagem) */}
        <View style={styles.pointsCard}>
          <View style={styles.pointsIconBg}>
            <Ionicons name="star" size={24} color={COLORS.white} />
          </View>
          <View style={styles.pointsInfo}>
            <Text style={styles.pointsLabel}>Seus pontos</Text>
            <Text style={styles.pointsValue}>4.250 <Text style={styles.pointsSuffix}>pts</Text></Text>
          </View>
          <TouchableOpacity style={styles.pointsBtn}>
            <Text style={styles.pointsBtnText}>Ver meus pontos</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* CATEGORIAS: "O que você deseja fazer?" */}
        <Text style={styles.sectionTitle}>O que você deseja fazer?</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll} contentContainerStyle={{ paddingHorizontal: 16 }}>
          {SERVICE_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoriaCard, categoriaAtiva === cat.slug && styles.categoriaCardAtivo]}
              onPress={() => handleCategorySearch(cat.slug)}
            >
              <Ionicons name={cat.icone} size={28} color={categoriaAtiva === cat.slug ? COLORS.white : COLORS.primary} />
              <Text style={[styles.categoriaTexto, categoriaAtiva === cat.slug && styles.categoriaTextoAtivo]}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* BANNER PROMOCIONAL (Ganhe mais com Waitless) */}
        <View style={styles.promoBanner}>
          <View style={styles.promoIconBg}>
            <Ionicons name="gift-outline" size={24} color={COLORS.primary} />
          </View>
          <View style={styles.promoTextContainer}>
            <Text style={styles.promoTitle}>Ganhe mais com Waitless</Text>
            <Text style={styles.promoDesc}>Acumule pontos em suas reservas e troque por descontos.</Text>
          </View>
        </View>

        {/* CONTEÚDO DINÂMICO DO BANCO DE DADOS */}
        {isLoading ? (
          <View style={styles.loadingContainer}><ActivityIndicator size="large" color={COLORS.primary} /></View>
        ) : stores.length > 0 ? (
          <>
            {/* DESTINOS/ESTABELECIMENTOS EM ALTA */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Locais em alta</Text>
              <TouchableOpacity onPress={() => router.push('/src/screens/TelaExplorar')}>
                <Text style={styles.verTodos}>Ver todos</Text>
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}>
              {destaques.map((store) => (
                <TouchableOpacity 
                  key={store.id} 
                  style={styles.cardDestaque} 
                  activeOpacity={0.9}
                  onPress={() => router.push({ pathname: '/src/screens/EstabelecimentoDetalhes', params: { id: store.id } })}
                >
                  <Image source={{ uri: store.foto_perfil || 'https://via.placeholder.com/300x400' }} style={styles.imageDestaque} />
                  <View style={styles.cardOverlay}>
                    <View style={styles.cardTag}><Text style={styles.cardTagText}>{store.ramo_atuacao || 'Local'}</Text></View>
                    <TouchableOpacity style={styles.cardHeart}><Ionicons name="heart-outline" size={20} color={COLORS.white} /></TouchableOpacity>
                  </View>
                  <View style={styles.cardDestaqueInfo}>
                    <Text style={styles.cardDestaqueTitle} numberOfLines={1}>{store.nome}</Text>
                    <Text style={styles.cardDestaqueSub} numberOfLines={2}>{store.cidade} - {store.estado}</Text>
                    <View style={styles.ratingContainer}>
                      <Ionicons name="star" size={14} color={COLORS.warning} />
                      <Text style={styles.ratingText}> {store.avaliacao_media || 'Novo'} </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* SERVIÇOS RECOMENDADOS */}
            {recomendados.length > 0 && (
              <>
                <View style={[styles.sectionHeader, { marginTop: 10 }]}>
                  <Text style={styles.sectionTitle}>Recomendados para você</Text>
                  <TouchableOpacity onPress={() => router.push('/src/screens/TelaExplorar')}>
                    <Text style={styles.verTodos}>Ver todos</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}>
                  {recomendados.map((store) => (
                    <TouchableOpacity 
                      key={store.id} 
                      style={styles.cardRecomendado}
                      onPress={() => router.push({ pathname: '/src/screens/EstabelecimentoDetalhes', params: { id: store.id } })}
                    >
                      <Image source={{ uri: store.foto_perfil || 'https://via.placeholder.com/300x200' }} style={styles.imageRecomendado} />
                      <View style={styles.infoRecomendado}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                          <Ionicons name="storefront-outline" size={14} color={COLORS.primary} />
                          <Text style={styles.recomendadoTag}> {store.ramo_atuacao || 'Serviço'}</Text>
                        </View>
                        <Text style={styles.recomendadoTitle} numberOfLines={1}>{store.nome}</Text>
                        <Text style={styles.recomendadoSub} numberOfLines={1}>{store.distance ? `${store.distance} km daqui` : 'Próximo a você'}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}
          </>
        ) : (
          /* ESTADO VAZIO SE NÃO ENCONTRAR NADA */
          <View style={styles.emptyState}>
            <Ionicons name="sad-outline" size={60} color={COLORS.gray} style={{ opacity: 0.5, marginBottom: 16 }} />
            <Text style={styles.emptyTitle}>Poxa, nada por aqui.</Text>
            <Text style={styles.emptyDesc}>Nenhum serviço ou reserva está disponível para esta localização ou categoria no momento.</Text>
            <TouchableOpacity style={styles.btnExploreTodos} onPress={() => { setCategoriaAtiva(null); loadSavedLocationOrFetchGPS(); }}>
              <Text style={styles.btnExploreTodosText}>Limpar Filtros</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white, paddingTop: Platform.OS === 'android' ? 25 : 0 },
  
  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  logoText: { fontSize: 24, fontWeight: '900', color: COLORS.primary, letterSpacing: -1 },
  headerIcons: { flexDirection: 'row', alignItems: 'center' },
  iconMargin: { marginLeft: 16, position: 'relative' },
  badge: { position: 'absolute', top: 0, right: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary, borderWidth: 1, borderColor: COLORS.white },
  profilePicPlaceholder: { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.secondary, alignItems: 'center', justifyContent: 'center' },

  scrollContent: { paddingBottom: 100 },

  // Search
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, marginHorizontal: 16, paddingHorizontal: 12, height: 50, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, marginBottom: 16 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.secondary },
  filterBtn: { padding: 6, backgroundColor: COLORS.primaryLight, borderRadius: 8 },

  // Location
  locationWrapper: { paddingHorizontal: 16, marginBottom: 20 },
  locationDisplay: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.lightGray, padding: 12, borderRadius: 12 },
  locationText: { flex: 1, fontSize: 13, color: COLORS.secondary, fontWeight: '600', marginLeft: 8 },
  locationChangeBtn: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  
  locationForm: { backgroundColor: COLORS.white, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border },
  locationFormHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  locationFormTitle: { fontSize: 14, fontWeight: '900', color: COLORS.secondary },
  gpsBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primaryLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  gpsBtnText: { color: COLORS.primary, fontSize: 11, fontWeight: '800', marginLeft: 4 },
  input: { backgroundColor: COLORS.lightGray, borderRadius: 8, padding: 12, marginBottom: 10, fontSize: 14 },
  row: { flexDirection: 'row' },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  btnCancel: { padding: 10, marginRight: 8 },
  btnCancelText: { color: COLORS.gray, fontWeight: '700' },
  btnSave: { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  btnSaveText: { color: COLORS.white, fontWeight: '800' },

  // Points Card
  pointsCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, marginHorizontal: 16, padding: 16, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  pointsIconBg: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.warning, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  pointsInfo: { flex: 1 },
  pointsLabel: { fontSize: 12, color: COLORS.gray, fontWeight: '600' },
  pointsValue: { fontSize: 20, fontWeight: '900', color: COLORS.secondary },
  pointsSuffix: { fontSize: 14, fontWeight: '600', color: COLORS.gray },
  pointsBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100 },
  pointsBtnText: { color: COLORS.primary, fontSize: 12, fontWeight: '800', marginRight: 4 },

  // Categories
  sectionTitle: { fontSize: 18, fontWeight: '900', color: COLORS.secondary, marginLeft: 16, marginBottom: 16 },
  categoriesScroll: { marginBottom: 24 },
  categoriaCard: { width: 100, height: 100, backgroundColor: COLORS.primaryLight, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  categoriaCardAtivo: { backgroundColor: COLORS.primary },
  categoriaTexto: { fontSize: 12, fontWeight: '800', color: COLORS.primary, marginTop: 8 },
  categoriaTextoAtivo: { color: COLORS.white },

  // Promo Banner
  promoBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, marginHorizontal: 16, padding: 16, marginBottom: 32 },
  promoIconBg: { width: 48, height: 48, borderRadius: 12, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  promoTextContainer: { flex: 1 },
  promoTitle: { fontSize: 15, fontWeight: '900', color: COLORS.secondary, marginBottom: 4 },
  promoDesc: { fontSize: 12, color: COLORS.gray, lineHeight: 16 },

  // Headers das Seções
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginHorizontal: 16, marginBottom: 16 },
  verTodos: { fontSize: 14, color: COLORS.primary, fontWeight: '800' },

  // Destaques (Cards Verticais)
  cardDestaque: { width: 220, backgroundColor: COLORS.secondary, borderRadius: 20, marginRight: 16, overflow: 'hidden' },
  imageDestaque: { width: '100%', height: 260, opacity: 0.8 },
  cardOverlay: { position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between' },
  cardTag: { backgroundColor: COLORS.white, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  cardTagText: { fontSize: 10, fontWeight: '900', color: COLORS.primary },
  cardHeart: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  cardDestaqueInfo: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: 'rgba(0,0,0,0.4)' },
  cardDestaqueTitle: { fontSize: 18, fontWeight: '900', color: COLORS.white, marginBottom: 4 },
  cardDestaqueSub: { fontSize: 12, color: COLORS.lightGray, marginBottom: 8 },
  ratingContainer: { flexDirection: 'row', alignItems: 'center' },
  ratingText: { fontSize: 13, fontWeight: '900', color: COLORS.white },

  // Recomendados (Cards Horizontais)
  cardRecomendado: { width: 180, marginRight: 16, backgroundColor: COLORS.white, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  imageRecomendado: { width: '100%', height: 110 },
  infoRecomendado: { padding: 12 },
  recomendadoTag: { fontSize: 10, fontWeight: '900', color: COLORS.primary, textTransform: 'uppercase' },
  recomendadoTitle: { fontSize: 14, fontWeight: '900', color: COLORS.secondary, marginBottom: 4 },
  recomendadoSub: { fontSize: 12, color: COLORS.gray },

  // Loading & Empty
  loadingContainer: { alignItems: 'center', paddingVertical: 40 },
  emptyState: { alignItems: 'center', padding: 30, backgroundColor: COLORS.lightGray, marginHorizontal: 16, borderRadius: 20, marginTop: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '900', color: COLORS.secondary, textAlign: 'center', marginBottom: 8 },
  emptyDesc: { color: COLORS.gray, textAlign: 'center', fontSize: 14, lineHeight: 22, marginBottom: 20 },
  btnExploreTodos: { backgroundColor: COLORS.secondary, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 100 },
  btnExploreTodosText: { color: COLORS.white, fontWeight: '900', fontSize: 14 }
});