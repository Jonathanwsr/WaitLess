import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Image, 
  TextInput, 
  ActivityIndicator, 
  SafeAreaView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

// --- CORES ATUALIZADAS CONFORME O SEU PADRÃO ---
const COLORS = {
  primary: '#b24b2b',
  primaryLight: '#fdeee9',
  secondary: '#111827',
  accent: '#FBBF24',
  gray: '#6B7280',
  lightGray: '#F9FAFB',
  white: '#FFFFFF',
  border: '#F3F4F6',
  error: '#DC2626',
};

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api';

// Categorias para o Filtro Superior
const CATEGORIAS = [
  { id: '1', name: 'Tudo', slug: 'tudo', icon: 'grid-outline' },
  { id: '2', name: 'Beleza', slug: 'beleza', icon: 'color-palette-outline' },
  { id: '3', name: 'Barbearia', slug: 'barbearia', icon: 'cut-outline' },
  { id: '4', name: 'Saúde', slug: 'saude', icon: 'medkit-outline' },
  { id: '5', name: 'Veículos', slug: 'veiculos', icon: 'car-sport-outline' },
  { id: '6', name: 'Pets', slug: 'pets', icon: 'paw-outline' },
  { id: '7', name: 'Eventos', slug: 'eventos', icon: 'calendar-outline' },
];

export default function TelaExplorar() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  // Estados de Filtro e Busca
  const [busca, setBusca] = useState(params.query?.toString() || '');
  const [categoriaAtiva, setCategoriaAtiva] = useState('tudo');
  
  // Estados de Dados
  const [lojas, setLojas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExplorar();
  }, []);

  const fetchExplorar = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('@waitless_token');
      // Bate na rota que você configurou no seu api.php
      const res = await fetch(`${API_URL}/explorar`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      const data = await res.json();
      setLojas(Array.isArray(data) ? data : (data.data || [])); // Garante que é um array
    } catch (e) {
      console.log('Erro ao buscar estabelecimentos:', e);
    } finally {
      setLoading(false);
    }
  };

  // --- LÓGICA DE FILTRAGEM DUPLA (Busca + Categoria) ---
  const lojasFiltradas = lojas.filter(loja => {
    const termoBusca = busca.toLowerCase();
    const matchBusca = 
      loja.nome?.toLowerCase().includes(termoBusca) || 
      loja.ramo_atuacao?.toLowerCase().includes(termoBusca) ||
      loja.cidade?.toLowerCase().includes(termoBusca);
      
    const matchCategoria = 
      categoriaAtiva === 'tudo' || 
      loja.ramo_atuacao?.toLowerCase() === categoriaAtiva ||
      loja.categoria?.toLowerCase() === categoriaAtiva; // Depende de como está no seu BD

    return matchBusca && matchCategoria;
  });

  // --- RENDERIZAÇÃO DO CARD ---
  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.card}
      activeOpacity={0.9}
      onPress={() => router.push({ pathname: '/src/screens/EstabelecimentoDetalhes', params: { id: item.id } })}
    >
      <View style={styles.imageContainer}>
        <Image source={{ uri: item.foto_perfil || 'https://via.placeholder.com/400x200' }} style={styles.image} />
        <TouchableOpacity style={styles.favoriteBtn}>
          <Ionicons name="heart-outline" size={20} color={COLORS.white} />
        </TouchableOpacity>
      </View>
      
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>{item.nome}</Text>
          <View style={styles.ratingBox}>
            <Ionicons name="star" size={12} color={COLORS.accent} />
            <Text style={styles.ratingText}>{item.avaliacao_media || 'Novo'}</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>{item.ramo_atuacao || 'Serviços'} • {item.cidade}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      
      {/* HEADER E BARRA DE PESQUISA */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.secondary} />
        </TouchableOpacity>
        
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={COLORS.gray} />
          <TextInput 
            style={styles.searchInput} 
            placeholder="Buscar serviços, locais..." 
            placeholderTextColor={COLORS.gray}
            value={busca} 
            onChangeText={setBusca} 
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* FILTRO DE CATEGORIAS HORIZONTAL */}
      <View style={styles.categoriesContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CATEGORIAS}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[styles.categoryChip, categoriaAtiva === item.slug && styles.categoryChipAtivo]}
              onPress={() => setCategoriaAtiva(item.slug)}
            >
              <Ionicons 
                name={item.icon} 
                size={16} 
                color={categoriaAtiva === item.slug ? COLORS.primary : COLORS.gray} 
                style={{ marginRight: 6 }} 
              />
              <Text style={[styles.categoryText, categoriaAtiva === item.slug && styles.categoryTextAtivo]}>
                {item.name}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* LISTAGEM DE RESULTADOS */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary}/>
          <Text style={styles.loadingText}>Buscando...</Text>
        </View>
      ) : (
        <FlatList
          data={lojasFiltradas}
          keyExtractor={i => i.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={60} color={COLORS.border} style={{ marginBottom: 16 }} />
              <Text style={styles.emptyTitle}>Nenhum resultado</Text>
              <Text style={styles.emptyDesc}>Não encontramos nada para "{busca}" nesta categoria.</Text>
              <TouchableOpacity style={styles.clearBtn} onPress={() => { setBusca(''); setCategoriaAtiva('tudo'); }}>
                <Text style={styles.clearBtnText}>Limpar filtros</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white, paddingTop: Platform.OS === 'android' ? 25 : 0 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  // Header
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.white },
  backBtn: { paddingRight: 12 },
  searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.lightGray, borderRadius: 100, paddingHorizontal: 16, height: 46, borderWidth: 1, borderColor: COLORS.border },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: COLORS.secondary },
  
  // Categorias
  categoriesContainer: { paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  categoryChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100 },
  categoryChipAtivo: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  categoryText: { fontSize: 13, fontWeight: '600', color: COLORS.gray },
  categoryTextAtivo: { color: COLORS.primary, fontWeight: '800' },

  // Listagem
  list: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: COLORS.white, borderRadius: 20, marginBottom: 24, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  imageContainer: { position: 'relative', width: '100%', height: 180 },
  image: { width: '100%', height: '100%', backgroundColor: COLORS.lightGray },
  favoriteBtn: { position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  
  info: { padding: 16 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title: { fontSize: 18, fontWeight: '900', color: COLORS.secondary, flex: 1, marginRight: 10 },
  subtitle: { fontSize: 14, color: COLORS.gray, fontWeight: '500' },
  ratingBox: { flexDirection: 'row', alignItems: 'center' },
  ratingText: { fontSize: 14, fontWeight: '800', color: COLORS.secondary, marginLeft: 4 },

  // Empty State & Loading
  loadingText: { marginTop: 12, color: COLORS.gray, fontWeight: '600' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: COLORS.secondary, marginBottom: 8 },
  emptyDesc: { textAlign: 'center', color: COLORS.gray, fontSize: 14, lineHeight: 20, marginBottom: 20 },
  clearBtn: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 100 },
  clearBtnText: { color: COLORS.primary, fontWeight: '800', fontSize: 14 }
});