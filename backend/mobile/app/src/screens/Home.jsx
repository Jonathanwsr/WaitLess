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
  SafeAreaView
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';

// --- CONFIGURAÇÕES DE CORES ---
// Atualizado para o tom de laranja vibrante da imagem
const COLORS = {
  primary: '#FF5A00',
  primaryLight: '#FFF4ED',
  secondary: '#111827',
  accent: '#FBBF24',
  gray: '#6B7280',
  lightGray: '#F9FAFB',
  white: '#FFFFFF',
  border: '#F3F4F6',
  error: '#DC2626',
};

const STORAGE_KEYS = {
  ADDRESS: '@waitless_address',
  COORDS: '@waitless_coords',
  FORMATTED: '@waitless_formatted'
};

const SERVICE_CATEGORIES = [
  { id: '1', name: 'Tudo', slug: 'tudo', icone: 'apps', image: null },
  { id: '2', name: 'Beleza', slug: 'beleza', icone: 'content-cut', image: null },
  { id: '3', name: 'Barbearia', slug: 'barbearia', icone: 'storefront', image: null },
  { id: '4', name: 'Saúde', slug: 'saude', icone: 'favorite-border', image: null },
  { id: '5', name: 'Estética', slug: 'face', icone: 'face', image: null },
  { id: '6', name: 'Unhas', slug: 'unhas', icone: 'pan-tool', image: null },
  { id: '7', name: 'Veículos', slug: 'veiculos', icone: 'directions-car', image: null },
  { id: '8', name: 'Pets', slug: 'pets', icone: 'pets', image: null },
];

export default function Home() {
  const router = useRouter();

  const [stores, setStores] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Buscando localização...');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoriaAtiva, setCategoriaAtiva] = useState('tudo');

  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const [addressData, setAddressData] = useState({
    logradouro: '', numero: '', bairro: '', cidadeUf: ''
  });

  const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.11:8000/api';

  useEffect(() => {
    loadSavedLocationOrFetchGPS();
  }, []);

  const handleCategorySearch = (categorySlug) => {
    setCategoriaAtiva(categorySlug);
    if (categorySlug === 'tudo') {
      loadSavedLocationOrFetchGPS();
    } else {
      fetchNearbyStores({ categoria: categorySlug });
    }
  };

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
      setStatusMessage('Permissão negada. Toque para digitar.');
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
      const queryParams = new URLSearchParams(params).toString();
      const response = await fetch(`${API_BASE_URL}/estabelecimentos/proximos?${queryParams}&radius=15`, {
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) throw new Error('Erro na rede');

      const data = await response.json();
      setStores(data);
    } catch (error) {
      console.error(error);
      // Fallback/Mock para ver o layout funcionando caso a API falhe
      setStores([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMainSearch = () => {
    if (!searchQuery.trim()) return;
    router.push({
      pathname: '/explorar',
      params: { query: searchQuery }
    });
  };

  const handleSaveLocation = async () => {
    if (!addressData.logradouro || !addressData.numero || !addressData.cidadeUf) {
      Alert.alert('Ops', 'Preencha Rua, Número e Cidade.');
      return;
    }

    setIsSavingLocation(true);
    try {
      const formatted = `${addressData.logradouro}, ${addressData.numero}`;
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

  // Divide os dados da API para preencher os dois layouts da imagem
  const destaques = stores.slice(0, 3);
  const recomendados = stores.slice(3);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* HEADER: Busca na Esquerda, Notificação e Perfil na Direita */}
        <View style={styles.header}>
          <View style={styles.searchContainer}>
            <TouchableOpacity onPress={handleMainSearch}>
              <Ionicons name="search" size={20} color="#777" />
            </TouchableOpacity>
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar serviços..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleMainSearch}
              returnKeyType="search"
            />
          </View>

          <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/agendamentos')}>
            <Ionicons name="notifications-outline" size={24} color="#333" />
            <View style={styles.badge} />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/perfil')} style={styles.profileButton}>
            <Text style={styles.profileText}>JR</Text>
          </TouchableOpacity>
        </View>

        {/* LOCALIZAÇÃO */}
        <View style={styles.locationWrapper}>
          {!isEditingLocation ? (
            <TouchableOpacity style={styles.locationContainer} onPress={() => setIsEditingLocation(true)}>
              <Ionicons name="location-outline" size={18} color={COLORS.primary} />
              <Text style={styles.locationText} numberOfLines={1}>{statusMessage}</Text>
              <Ionicons name="chevron-down" size={16} color="#777" />
            </TouchableOpacity>
          ) : (
            <View style={styles.locationForm}>
              <Text style={styles.locationFormTitle}>Onde você está?</Text>
              <TextInput style={styles.input} placeholder="Rua / Avenida *" value={addressData.logradouro} onChangeText={t => setAddressData({...addressData, logradouro: t})} />
              <TextInput style={styles.input} placeholder="Número *" value={addressData.numero} onChangeText={t => setAddressData({...addressData, numero: t})} />
              <TextInput style={styles.input} placeholder="Bairro" value={addressData.bairro} onChangeText={t => setAddressData({...addressData, bairro: t})} />
              <TextInput style={styles.input} placeholder="Cidade / UF *" value={addressData.cidadeUf} onChangeText={t => setAddressData({...addressData, cidadeUf: t})} />
              <View style={styles.formActions}>
                <TouchableOpacity style={styles.btnCancel} onPress={() => setIsEditingLocation(false)}>
                  <Text style={styles.btnCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnSave} onPress={handleSaveLocation} disabled={isSavingLocation}>
                  {isSavingLocation ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnSaveText}>Confirmar</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* CATEGORIAS (Estilo Aplicativo) */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
          {SERVICE_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoriaCard, categoriaAtiva === cat.slug && styles.categoriaAtiva]}
              onPress={() => handleCategorySearch(cat.slug)}
            >
              <View style={[styles.iconContainer, categoriaAtiva === cat.slug && styles.iconContainerAtivo]}>
                <MaterialIcons

                  size={26}
                  color={categoriaAtiva === cat.slug ? COLORS.primary : '#555'}
                />
              </View>
              <Text style={[styles.categoriaTexto, categoriaAtiva === cat.slug && styles.categoriaTextoAtivo]}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* BANNER PROMOCIONAL */}
        <View style={styles.bannerContainer}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=80&w=800' }}
            style={styles.bannerImage}
          />
          <View style={styles.bannerOverlay}>
            <Text style={styles.bannerTitle}>Cuide de você{'\n'}com os melhores{'\n'}profissionais.</Text>
            <Text style={styles.bannerSub}>Agende online de forma{'\n'}rápida e prática.</Text>
            <TouchableOpacity style={styles.bannerButton}>
              <Text style={styles.bannerButtonText}>Explorar agora  →</Text>
            </TouchableOpacity>
          </View>
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : stores.length > 0 ? (
          <>
            {/* DESTAQUES PARA VOCÊ (Rolagem Horizontal) */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Destaques para você</Text>
              <TouchableOpacity><Text style={styles.verTodos}>Ver todos</Text></TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
              {destaques.map((store, index) => (
                <TouchableOpacity key={store.id} style={styles.cardDestaque} activeOpacity={0.9}>
                  <View>
                    <Image source={{ uri: store.foto_perfil || 'https://via.placeholder.com/300' }} style={styles.imageDestaque} />
                    {index === 0 && (
                      <View style={styles.badgeAlta}>
                        <Text style={styles.badgeTextAlta}>Em alta 🔥</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.cardDestaqueInfo}>
                    <Text style={styles.cardDestaqueTitle} numberOfLines={1}>{store.nome}</Text>
                    <View style={styles.ratingContainer}>
                      <Ionicons name="star" size={12} color="#FFB800" />
                      <Text style={styles.ratingText}> {store.avaliacao_media || 'Novo'} </Text>
                    </View>
                    <Text style={styles.priceLabel}>A partir de</Text>
                    <Text style={styles.priceValue}>R$ {store.preco_minimo || '25,00'}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* RECOMENDADOS (Lista Vertical) */}
            {recomendados.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginBottom: 15 }]}>Recomendados</Text>
                {recomendados.map((store) => (
                  <TouchableOpacity key={store.id} style={styles.cardRecomendado} activeOpacity={0.9}>
                    <Image source={{ uri: store.foto_perfil || 'https://via.placeholder.com/150' }} style={styles.imageRecomendado} />

                    <View style={styles.infoRecomendado}>
                      <View style={styles.headerRecomendado}>
                        <Text style={styles.cardTitle}>{store.nome}</Text>
                        <Ionicons name="heart-outline" size={20} color="#999" />
                      </View>

                      <View style={styles.ratingContainer}>
                        <Ionicons name="star" size={12} color="#FFB800" />
                        <Text style={styles.ratingText}> {store.avaliacao_media || 'Novo'} </Text>
                      </View>

                      <View style={styles.tagsContainer}>
                        <View style={styles.tag}><Text style={styles.tagText}>{store.categoria || 'Serviço'}</Text></View>
                        {store.fila_atual !== undefined && (
                          <View style={styles.tagQueue}><Text style={styles.tagQueueText}>Fila: {store.fila_atual}</Text></View>
                        )}
                      </View>

                      <View style={styles.footerRecomendado}>
                        <Text style={styles.priceLabel}>A partir de <Text style={styles.priceValueRec}>R$ {store.preco_minimo || '45,00'}</Text></Text>
                        <View style={styles.timeContainer}>
                          <Ionicons name="time-outline" size={12} color="#999" />
                          <Text style={styles.timeText}> {store.distance ? `${store.distance} km` : 'Perto'}</Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </>
        ) : (
          /* EMPTY STATE */
          <View style={styles.emptyState}>
            <Image
              source={{ uri: 'https://cdn-icons-png.flaticon.com/512/7486/7486747.png' }}
              style={{ width: 80, height: 80, opacity: 0.5, marginBottom: 16 }}
            />
            <Text style={styles.emptyTitle}>Nenhum serviço encontrado aqui.</Text>
            <Text style={styles.emptyDesc}>
              Não encontramos resultados para esta localização ou categoria.
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => loadSavedLocationOrFetchGPS()}>
              <Text style={styles.retryButtonText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white },
  container: { flex: 1, paddingHorizontal: 16 },


  // --- HEADER ---
  header: { flexDirection: 'row', alignItems: 'center', marginTop: 50, marginBottom: 15 },
  searchContainer: {

    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F5F5F5', borderRadius: 25,
    paddingHorizontal: 15, height: 45, marginRight: 10,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: '#333' },
  iconButton: { padding: 8, position: 'relative', marginRight: 5 },
  badge: { position: 'absolute', top: 8, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  profileButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
  },
  profileText: { color: COLORS.white, fontWeight: 'bold', fontSize: 14 },

  // --- LOCALIZAÇÃO ---
  locationWrapper: { marginBottom: 20 },
  locationContainer: { flexDirection: 'row', alignItems: 'center' },
  locationText: { fontSize: 13, color: '#555', marginLeft: 5, marginRight: 5, maxWidth: '85%' },

  // FORMULÁRIO DE LOCALIZAÇÃO (Mantido do seu original)
  locationForm: { backgroundColor: COLORS.white, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, shadowColor: '#000', shadowOpacity: 0.05, elevation: 2 },
  locationFormTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 16, color: COLORS.secondary },
  input: { backgroundColor: COLORS.lightGray, borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 15 },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  btnCancel: { padding: 12 },
  btnCancelText: { color: COLORS.gray, fontWeight: '600' },
  btnSave: { backgroundColor: COLORS.primary, padding: 12, borderRadius: 8, paddingHorizontal: 20 },
  btnSaveText: { color: COLORS.white, fontWeight: 'bold' },

  // --- CATEGORIAS ---
  categoriesScroll: { marginBottom: 20 },
  categoriaCard: { alignItems: 'center', marginRight: 15 },
  iconContainer: {
    width: 65, height: 65, borderRadius: 18,
    backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center',
    marginBottom: 8, borderWidth: 1, borderColor: 'transparent',
  },
  iconContainerAtivo: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  categoriaTexto: { fontSize: 12, color: '#555', fontWeight: '500' },
  categoriaTextoAtivo: { color: COLORS.primary, fontWeight: 'bold' },

  // --- BANNER ---
  bannerContainer: { width: '100%', height: 180, borderRadius: 16, overflow: 'hidden', marginBottom: 25, position: 'relative' },
  bannerImage: { width: '100%', height: '100%' },
  bannerOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    padding: 20, justifyContent: 'center', backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  bannerTitle: { fontSize: 20, fontWeight: '900', color: '#000', marginBottom: 5 },
  bannerSub: { fontSize: 13, color: '#222', marginBottom: 15, fontWeight: '500' },
  bannerButton: { backgroundColor: COLORS.primary, paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, alignSelf: 'flex-start' },
  bannerButtonText: { color: COLORS.white, fontWeight: 'bold', fontSize: 12 },

  // --- SEÇÕES ---
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.secondary },
  verTodos: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },

  // --- DESTAQUES (HORIZONTAL) ---
  horizontalScroll: { marginBottom: 25 },
  cardDestaque: {
    width: 140, marginRight: 15, backgroundColor: COLORS.white,
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden',
  },
  imageDestaque: { width: '100%', height: 120 },
  badgeAlta: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  badgeTextAlta: { color: COLORS.white, fontSize: 10, fontWeight: 'bold' },
  cardDestaqueInfo: { padding: 10 },
  cardDestaqueTitle: { fontWeight: 'bold', fontSize: 14, marginBottom: 2, color: COLORS.secondary },
  ratingContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  ratingText: { fontSize: 12, fontWeight: 'bold', color: '#555' },
  priceLabel: { fontSize: 11, color: '#777' },
  priceValue: { fontSize: 14, color: COLORS.primary, fontWeight: 'bold', marginTop: 2 },

  // --- RECOMENDADOS (VERTICAL) ---
  cardRecomendado: {
    flexDirection: 'row', backgroundColor: COLORS.white, marginBottom: 15,
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: 8,
  },
  imageRecomendado: { width: 90, height: 90, borderRadius: 10 },
  infoRecomendado: { flex: 1, marginLeft: 12, justifyContent: 'space-between' },
  headerRecomendado: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { fontWeight: 'bold', fontSize: 15, color: COLORS.secondary, flex: 1 },
  tagsContainer: { flexDirection: 'row', marginTop: 4, marginBottom: 4 },
  tag: { backgroundColor: '#F5F5F5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginRight: 6 },
  tagText: { fontSize: 10, color: '#555' },
  tagQueue: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  tagQueueText: { fontSize: 10, color: COLORS.primary, fontWeight: 'bold' },
  footerRecomendado: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceValueRec: { fontSize: 14, color: COLORS.primary, fontWeight: 'bold' },
  timeContainer: { flexDirection: 'row', alignItems: 'center' },
  timeText: { fontSize: 11, color: '#999' },

  // --- EMPTY STATE ---
  emptyState: { alignItems: 'center', padding: 30, backgroundColor: COLORS.white, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, borderStyle: 'dashed', marginTop: 20 },
  emptyTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.secondary, textAlign: 'center' },
  emptyDesc: { color: COLORS.gray, textAlign: 'center', marginTop: 8, fontSize: 14, lineHeight: 20 },
  retryButton: { marginTop: 20, backgroundColor: COLORS.primaryLight, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  retryButtonText: { color: COLORS.primary, fontWeight: 'bold' },
});
