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
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather, MaterialIcons } from '@expo/vector-icons';

// --- CONFIGURAÇÕES DE CORES ---
const COLORS = {
  primary: '#b24b2b', // Cor do Waitless
  primaryLight: '#fdeee9',
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

// 11 CATEGORIAS COMPLETAS
const SERVICE_CATEGORIES = [
  { id: '1', name: 'Serviços', slug: 'servicos', image: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?q=80&w=200' },
  { id: '2', name: 'Reservas', slug: 'reservas', image: 'https://images.unsplash.com/photo-1517840901100-8179e982acb7?q=80&w=200' },
  { id: '3', name: 'Beleza', slug: 'beleza', image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=200' },
  { id: '4', name: 'Barbeiro', slug: 'barbearia', image: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=200' },
  { id: '5', name: 'Saúde', slug: 'saude', image: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?q=80&w=200' },
  { id: '6', name: 'Academia', slug: 'fitness', image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=200' },
  { id: '7', name: 'Veículos', slug: 'veiculos', image: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?q=80&w=200' },
  { id: '8', name: 'Mecânica', slug: 'mecanica', image: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?q=80&w=200' },
  { id: '9', name: 'Pets', slug: 'pets', image: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=200' },
  { id: '10', name: 'Faxina', slug: 'limpeza', image: 'https://images.unsplash.com/photo-1581578731548-c64695ce6958?q=80&w=200' },
  { id: '11', name: 'Eventos', slug: 'eventos', image: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=200' },
];

export default function Home() {
  const router = useRouter();

  const [stores, setStores] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Buscando localização...');
  const [searchQuery, setSearchQuery] = useState('');

  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const [addressData, setAddressData] = useState({
    logradouro: '', numero: '', bairro: '', cidadeUf: ''
  });

  const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.10:8000/api';

  useEffect(() => {
    loadSavedLocationOrFetchGPS();
  }, []);

  // CLIQUE DA CATEGORIA - BUSCA DIRETO NA API
  const handleCategorySearch = (categorySlug) => {
    fetchNearbyStores({ categoria: categorySlug });
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
      setStatusMessage('Permissão de GPS negada. Toque para digitar.');
      setIsLoading(false);
      return;
    }

    try {
      setStatusMessage('Calculando sua localização exata...');
      let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { lat: location.coords.latitude, lng: location.coords.longitude };

      setStatusMessage('Localização atualizada (GPS)');
      await AsyncStorage.setItem(STORAGE_KEYS.COORDS, JSON.stringify(coords));
      await AsyncStorage.setItem(STORAGE_KEYS.FORMATTED, 'Sua Localização Atual');
      await AsyncStorage.removeItem(STORAGE_KEYS.ADDRESS);

      fetchNearbyStores(coords);
    } catch (error) {
      setStatusMessage('Erro no GPS. Toque para digitar o endereço.');
      setIsLoading(false);
    }
  };

  const fetchNearbyStores = async (params) => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams(params).toString();
      const response = await fetch(`${API_BASE_URL}/estabelecimentos/proximos?${queryParams}&radius=15`, {
        headers: { 'Accept': 'application/json' } // Evita o redirecionamento HTML que quebra o app
      });

      if (!response.ok) throw new Error('Erro na rede');

      const data = await response.json();
      setStores(data);
    } catch (error) {
      console.error(error);
      setStores([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMainSearch = () => {
    if (!searchQuery.trim()) return;
    router.push({ pathname: '/explorar', params: { query: searchQuery } });
  };

  const handleSaveLocation = async () => {
    if (!addressData.logradouro || !addressData.numero || !addressData.cidadeUf) {
      Alert.alert('Ops', 'Por favor, preencha pelo menos a Rua, Número e Cidade.');
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

      {/* --- HEADER SUPERIOR --- */}
      <View style={styles.headerTop}>
        <View style={styles.locationWrapper}>
          {!isEditingLocation ? (
            <View style={styles.locationDisplayRow}>

              {/* BLOCO DA ESQUERDA: ENDEREÇO + BOTÕES AUXILIARES */}
              <View style={styles.headerLeftGroup}>
                <TouchableOpacity style={styles.locationTextContainer} onPress={() => setIsEditingLocation(true)}>
                  <Text style={styles.locationLabel}>Entregar em / Atender em</Text>
                  <View style={styles.locationInfoRow}>
                    <Text style={styles.locationText} numberOfLines={1}>{statusMessage}</Text>
                    <Feather name="chevron-down" size={16} color={COLORS.primary} style={{ marginLeft: 4 }} />
                  </View>
                </TouchableOpacity>

                <View style={styles.headerActions}>
                  <TouchableOpacity onPress={getLocationViaGPS} style={styles.iconButton}>
                    <MaterialIcons name="my-location" size={18} color={COLORS.primary} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => router.push('/src/screens/MeusAgendamentos')}
                    style={styles.iconButton}
                  >
                    <Feather name="calendar" size={18} color={COLORS.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* EXTREMA DIREITA: BOTÃO DE PERFIL EXCLUSIVO E DESTACADO */}
              <TouchableOpacity
                onPress={() => router.push('/src/screens/TelaPerfil')}
                style={styles.profileCircle}
              >
                <View style={styles.profileBorder}>
                  <Feather name="user" size={22} color={COLORS.white} />
                </View>
              </TouchableOpacity>

            </View>
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

        {/* --- BARRA DE BUSCA --- */}
        <View style={styles.searchForm}>
          <Feather name="search" size={20} color={COLORS.primary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Serviços, reservas, locais..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleMainSearch}
          />
        </View>
      </View>

      {/* --- CARROSSEL DE CATEGORIAS COMPLETAS E CLICÁVEIS --- */}
      <View style={styles.section}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={SERVICE_CATEGORIES}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.categoryCard}
              onPress={() => handleCategorySearch(item.slug)}
            >
              <Image source={{ uri: item.image }} style={styles.categoryImage} />
              <Text style={styles.categoryName}>{item.name}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* --- LISTAGEM DE ESTABELECIMENTOS --- */}
      <View style={[styles.section, { marginTop: 24 }]}>
        <Text style={[styles.sectionTitle, { marginLeft: 20, marginBottom: 16 }]}>Destaques perto de você</Text>

        {isLoading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : stores.length > 0 ? (
          stores.map((store) => (
            <TouchableOpacity key={store.id} style={styles.storeCard} activeOpacity={0.9}>
              <Image source={{ uri: store.foto_perfil }} style={styles.storeImage} />
              <View style={styles.storeInfo}>
                <Text style={styles.storeName}>{store.nome}</Text>

                <View style={styles.storeMeta}>
                  <Text style={styles.metaText}><Feather name="star" color={COLORS.accent} /> {store.avaliacao_media || 'Novo'}</Text>
                  <Text style={styles.metaDot}>•</Text>
                  <Text style={styles.metaText}>{store.categoria || 'Serviços'}</Text>
                  <Text style={styles.metaDot}>•</Text>
                  <Text style={styles.metaText}>{store.distance ? `${store.distance} km` : 'Perto'}</Text>
                </View>

                {store.fila_atual !== undefined && (
                  <View style={styles.queueBadge}>
                    <Text style={styles.queueText}>Fila atual: {store.fila_atual} pessoas</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Image
              source={{ uri: 'https://cdn-icons-png.flaticon.com/512/7486/7486747.png' }}
              style={{ width: 80, height: 80, opacity: 0.5, marginBottom: 16 }}
            />
            <Text style={styles.emptyTitle}>Ops, parece que não há nada aqui...</Text>
            <Text style={styles.emptyDesc}>
              Não encontramos serviços próximos ou você pode estar sem internet no momento.
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => loadSavedLocationOrFetchGPS()}>
              <Text style={styles.retryButtonText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.lightGray },
  headerTop: { backgroundColor: COLORS.white, paddingBottom: 20, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  locationWrapper: { paddingHorizontal: 20, marginBottom: 16 },

  // ESTRUTURAÇÃO DO TOPO EM GRID EM LINHA
  locationDisplayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeftGroup: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  locationTextContainer: { flex: 1, marginRight: 10 },
  locationLabel: { fontSize: 11, color: COLORS.gray, textTransform: 'uppercase', fontWeight: '700', marginBottom: 2 },
  locationInfoRow: { flexDirection: 'row', alignItems: 'center' },
  locationText: { fontSize: 14, fontWeight: 'bold', color: COLORS.secondary, maxWidth: '80%' },

  // BOTÕES AUXILIARES ESQUERDOS
  headerActions: { flexDirection: 'row', gap: 6, alignItems: 'center', marginRight: 10 },
  iconButton: { padding: 8, backgroundColor: COLORS.primaryLight, borderRadius: 50 },

  // DESIGN EXCLUSIVO DO BOTÃO DE PERFIL (DIREITA EXTREMA)
  profileCircle: { marginLeft: 5 },
  profileBorder: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 4
  },

  locationForm: { backgroundColor: COLORS.white, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, shadowColor: '#000', shadowOffset: {width:0, height:4}, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  locationFormTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 16, color: COLORS.secondary },
  input: { backgroundColor: COLORS.lightGray, borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 15, color: COLORS.secondary },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  btnCancel: { padding: 12 },
  btnCancelText: { color: COLORS.gray, fontWeight: '600' },
  btnSave: { backgroundColor: COLORS.primary, padding: 12, borderRadius: 8, paddingHorizontal: 20 },
  btnSaveText: { color: COLORS.white, fontWeight: 'bold' },

  searchForm: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.lightGray, borderRadius: 12, marginHorizontal: 20, paddingHorizontal: 16, height: 50 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 16, color: COLORS.secondary },
  section: { marginTop: 24 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.secondary },

  // CATEGORIAS GRANDES E ESTILIZADAS
  categoryCard: { alignItems: 'center', width: 95 },
  categoryImage: { width: 85, height: 85, borderRadius: 42.5, marginBottom: 8, backgroundColor: '#E5E7EB', borderWidth: 1, borderColor: COLORS.border },
  categoryName: { fontSize: 14, fontWeight: '600', color: COLORS.secondary, textAlign: 'center' },

  storeCard: { backgroundColor: COLORS.white, marginHorizontal: 20, marginBottom: 20, borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  storeImage: { width: '100%', height: 140, backgroundColor: '#E5E7EB' },
  storeInfo: { padding: 16 },
  storeName: { fontSize: 18, fontWeight: 'bold', color: COLORS.secondary, marginBottom: 6 },
  storeMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  metaText: { color: COLORS.gray, fontSize: 13, fontWeight: '500' },
  metaDot: { color: COLORS.gray, marginHorizontal: 6, fontSize: 10 },
  queueBadge: { backgroundColor: COLORS.primaryLight, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6, alignSelf: 'flex-start' },
  queueText: { color: COLORS.primary, fontWeight: '700', fontSize: 12 },
  emptyState: { alignItems: 'center', padding: 30, backgroundColor: COLORS.white, marginHorizontal: 20, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, borderStyle: 'dashed' },
  emptyTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.secondary, textAlign: 'center' },
  emptyDesc: { color: COLORS.gray, textAlign: 'center', marginTop: 8, fontSize: 14, lineHeight: 20 },
  retryButton: { marginTop: 20, backgroundColor: COLORS.primaryLight, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  retryButtonText: { color: COLORS.primary, fontWeight: 'bold' },
});
