import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ImageBackground,
  SafeAreaView,
  Platform,
  Modal,
  StatusBar
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

// --- PALETA DE CORES ---
const COLORS = {
  primary: '#FF5A00',      // Laranja Lokyva
  secondary: '#111827',   // Texto escuro
  black: '#000000',       // Preto puro para ícones
  gray: '#6B7280',
  lightGray: '#F3F4F6',
  white: '#FFFFFF',
  border: '#E5E7EB',
  green: '#10B981',
  greenBg: '#E6F4EA',
  star: '#F59E0B',
};

const PLACEHOLDERS = [
  'Procure por serviços...',
  'Reservas em restaurantes...',
  'Aluguel de carros...',
  'Viagens, hotéis e pousadas...',
  'Casas de temporada...'
];

// --- DADOS MOCKADOS ---
const CATEGORIES = [
  { id: '1', name: 'Tudo', icon: 'grid-outline', active: true },
  { id: '2', name: 'Beleza', icon: 'sparkles-outline' },
  { id: '3', name: 'Barbearia', icon: 'cut-outline' },
  { id: '4', name: 'Saúde', icon: 'medkit-outline' },
  { id: '5', name: 'Veículos', icon: 'car-outline' },
  { id: '6', name: 'Pets', icon: 'paw-outline' },
];

const RECOMMENDED_SERVICES = [
  {
    id: '1',
    title: 'Studio Beleza & Estética',
    rating: '4.9',
    reviews: '128',
    distance: '1.2km',
    category: 'Beleza • Salão de Beleza',
    price: 'R$ 79,90',
    isOpen: true,
    isFavorite: true,
    image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=800',
  },
  {
    id: '2',
    title: 'Barbearia Class',
    rating: '4.8',
    reviews: '94',
    distance: '0.8km',
    category: 'Barbearia • Corte Masculino',
    price: 'R$ 49,90',
    isOpen: true,
    isFavorite: false,
    image: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=800',
  },
];

export default function Home() {
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [favorites, setFavorites] = useState(['1']);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prevIndex) => (prevIndex + 1) % PLACEHOLDERS.length);
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  const handleMainSearch = () => {
    if (!searchQuery.trim()) return;
    router.push({
      pathname: '/src/screens/TelaExplorar',
      params: { query: searchQuery }
    });
  };

  const toggleFavorite = (id) => {
    setFavorites(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleProfilePress = async () => {
    try {
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} translucent={false} />
      
      <View style={styles.mainContainer}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          {/* BANNER / HERO COM FRASES E BARRA DE PESQUISA */}
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

              {/* BARRA DE PESQUISA */}
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
                
                <TouchableOpacity style={styles.filterBtn} onPress={() => setIsFilterModalVisible(true)}>
                  <Ionicons name="options-outline" size={20} color={COLORS.black} />
                </TouchableOpacity>
              </View>
            </View>
          </ImageBackground>

          {/* --- CARROSSEL / SELEÇÃO DE CATEGORIAS --- */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.categoriesContent}
            style={styles.categoriesContainer}
          >
            {CATEGORIES.map((cat) => (
              <TouchableOpacity key={cat.id} style={styles.categoryItem}>
                <View style={[styles.categoryIconBg, cat.active && styles.categoryIconBgActive]}>
                  <Ionicons 
                    name={cat.icon} 
                    size={22} 
                    color={cat.active ? COLORS.white : COLORS.secondary} 
                  />
                </View>
                <Text style={[styles.categoryText, cat.active && styles.categoryTextActive]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* --- BANNER PROMOCIONAL (EM ALTA) --- */}
          <View style={styles.promoBannerContainer}>
            <ImageBackground
              source={{ uri: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=800' }}
              style={styles.promoBannerBg}
              imageStyle={{ borderRadius: 16 }}
            >
              <View style={styles.promoOverlay}>
                <View style={styles.emAltaBadge}>
                  <Text style={styles.emAltaBadgeText}>🔥 EM ALTA</Text>
                </View>

                <Text style={styles.promoTitle}>
                  Agende serviços com os melhores perto de você
                </Text>
                <Text style={styles.promoSubtitle}>
                  Prático, rápido e seguro!
                </Text>

                <View style={styles.paginationDots}>
                  <View style={[styles.dot, styles.dotActive]} />
                  <View style={styles.dot} />
                  <View style={styles.dot} />
                </View>
              </View>
            </ImageBackground>
          </View>

          {/* --- BARRA DE FILTROS RÁPIDOS (CHIPS) --- */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsContent}
            style={styles.chipsContainer}
          >
            <TouchableOpacity 
              style={styles.chipButton} 
              onPress={() => setIsFilterModalVisible(true)}
            >
              <Ionicons name="options-outline" size={14} color={COLORS.secondary} />
              <Text style={styles.chipText}>Filtros</Text>
              <View style={styles.chipDotBadge} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.chipButton}>
              <Text style={styles.chipText}>Ordenar</Text>
              <Ionicons name="chevron-down-outline" size={14} color={COLORS.gray} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.chipButton}>
              <Ionicons name="location-outline" size={14} color={COLORS.gray} />
              <Text style={styles.chipText}>Distância</Text>
              <Ionicons name="chevron-down-outline" size={14} color={COLORS.gray} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.chipButton}>
              <Ionicons name="star-outline" size={14} color={COLORS.gray} />
              <Text style={styles.chipText}>Avaliação</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* --- SEÇÃO: RECOMENDADOS PARA VOCÊ --- */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recomendados para você</Text>
              <TouchableOpacity onPress={() => router.push('/src/screens/TelaExplorar')}>
                <Text style={styles.seeAllText}>Ver todos</Text>
              </TouchableOpacity>
            </View>

            {/* LISTA DE CARDS */}
            {RECOMMENDED_SERVICES.map((item) => {
              const isFav = favorites.includes(item.id);
              return (
                <View key={item.id} style={styles.cardContainer}>
                  <ImageBackground
                    source={{ uri: item.image }}
                    style={styles.cardImage}
                    imageStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16 }}
                  >
                    {item.isOpen && (
                      <View style={styles.openBadge}>
                        <Text style={styles.openBadgeText}>ABERTO AGORA</Text>
                      </View>
                    )}

                    <TouchableOpacity 
                      style={styles.favoriteButton}
                      onPress={() => toggleFavorite(item.id)}
                    >
                      <Ionicons 
                        name={isFav ? "heart" : "heart-outline"} 
                        size={18} 
                        color={isFav ? COLORS.primary : COLORS.black} 
                      />
                    </TouchableOpacity>
                  </ImageBackground>

                  <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    
                    <View style={styles.ratingRow}>
                      <Ionicons name="star" size={13} color={COLORS.star} />
                      <Text style={styles.ratingText}>{item.rating}</Text>
                      <Text style={styles.reviewsText}>({item.reviews})</Text>
                      <Text style={styles.dotSeparator}>•</Text>
                      <Ionicons name="location-outline" size={13} color={COLORS.gray} />
                      <Text style={styles.distanceText}>{item.distance}</Text>
                    </View>

                    <Text style={styles.categorySubtext}>{item.category}</Text>

                    <View style={styles.cardFooter}>
                      <View>
                        <Text style={styles.priceLabel}>A partir de</Text>
                        <Text style={styles.priceValue}>{item.price}</Text>
                      </View>

                      <TouchableOpacity 
                        style={styles.agendarBtn}
                        onPress={() => router.push(`/src/screens/TelaDetalhes?id=${item.id}`)}
                      >
                        <Text style={styles.agendarBtnText}>Agendar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

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

          <TouchableOpacity style={styles.navItem} onPress={handleProfilePress}>
            <Ionicons name="person-outline" size={24} color={COLORS.black} />
            <Text style={styles.navText}>Perfil</Text>
          </TouchableOpacity>
        </View>

      </View>

      {/* --- MODAL DE FILTROS --- */}
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
              Conteúdo do modal de filtros
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
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0
  },
  mainContainer: {
    flex: 1,
    position: 'relative'
  },
  scrollContent: {
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

  // BARRA DE PESQUISA
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

  // CATEGORIAS
  categoriesContainer: {
    marginTop: 16
  },
  categoriesContent: {
    paddingHorizontal: 16,
    gap: 16
  },
  categoryItem: {
    alignItems: 'center',
    width: 62
  },
  categoryIconBg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.lightGray,
    justifyContent: 'center',
    alignItems: 'center'
  },
  categoryIconBgActive: {
    backgroundColor: COLORS.primary
  },
  categoryText: {
    fontSize: 11,
    color: COLORS.gray,
    marginTop: 6,
    fontWeight: '500',
    textAlign: 'center'
  },
  categoryTextActive: {
    color: COLORS.primary,
    fontWeight: '700'
  },

  // BANNER EM ALTA
  promoBannerContainer: {
    paddingHorizontal: 16,
    marginTop: 20
  },
  promoBannerBg: {
    width: '100%',
    height: 150,
    overflow: 'hidden'
  },
  promoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderRadius: 16,
    padding: 16,
    justifyContent: 'space-between'
  },
  emAltaBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12
  },
  emAltaBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primary
  },
  promoTitle: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '800',
    maxWidth: '80%',
    lineHeight: 22
  },
  promoSubtitle: {
    color: COLORS.white,
    fontSize: 12,
    opacity: 0.9,
    marginTop: -4
  },
  paginationDots: {
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 6
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.5)'
  },
  dotActive: {
    backgroundColor: COLORS.white,
    width: 14
  },

  // CHIPS DE FILTRO
  chipsContainer: {
    marginTop: 18
  },
  chipsContent: {
    paddingHorizontal: 16,
    gap: 10
  },
  chipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    position: 'relative'
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.secondary
  },
  chipDotBadge: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
    marginLeft: 2
  },

  // SEÇÃO RECOMENDADOS
  sectionContainer: {
    paddingHorizontal: 16,
    marginTop: 24
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.secondary
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary
  },

  // CARDS DE RECOMENDAÇÃO
  cardContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    overflow: 'hidden'
  },
  cardImage: {
    height: 140,
    width: '100%',
    justifyContent: 'space-between',
    padding: 10
  },
  openBadge: {
    backgroundColor: COLORS.greenBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start'
  },
  openBadgeText: {
    color: COLORS.green,
    fontSize: 9,
    fontWeight: '800'
  },
  favoriteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-end',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3
  },
  cardContent: {
    padding: 12
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.secondary
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.secondary
  },
  reviewsText: {
    fontSize: 11,
    color: COLORS.gray
  },
  dotSeparator: {
    fontSize: 10,
    color: COLORS.gray,
    marginHorizontal: 2
  },
  distanceText: {
    fontSize: 11,
    color: COLORS.gray
  },
  categorySubtext: {
    fontSize: 11,
    color: COLORS.gray,
    marginTop: 4
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border
  },
  priceLabel: {
    fontSize: 10,
    color: COLORS.gray
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary
  },
  agendarBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 12
  },
  agendarBtnText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700'
  },

  // MODAL DE FILTROS
  modalOverlay: {
    flex: 1,
    justify: 'flex-end',
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

  // MENU INFERIOR (BOTTOM NAV)
  bottomNavContainer: {
    position: 'absolute',
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