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
  Platform,
  ScrollView,
  Dimensions
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

const COLORS = {
  primary: '#FF8C00', 
  primaryLight: '#FFF0E6', 
  secondary: '#111827',
  textDark: '#374151',
  gray: '#6B7280',
  lightGray: '#F9FAFB',
  white: '#FFFFFF',
  border: '#E5E7EB',
  success: '#10B981', 
};

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';

const CATEGORIAS = [
  { id: '1', name: 'Tudo', slug: 'tudo', icon: 'all-inclusive' },
  { id: '2', name: 'Locais', slug: 'estabelecimentos', icon: 'storefront-outline' },
  { id: '3', name: 'Serviços', slug: 'servicos', icon: 'briefcase-outline' },
  { id: '4', name: 'Passeios', slug: 'passeios', icon: 'compass-outline' },
  { id: '5', name: 'Veículos', slug: 'veiculos', icon: 'car-outline' },
  { id: '6', name: 'Casas', slug: 'casas', icon: 'home-city-outline' },
  { id: '7', name: 'Pets', slug: 'pets', icon: 'paw-outline' },
  { id: '8', name: 'Objetos', slug: 'objetos', icon: 'cube-outline' },
  { id: '9', name: 'Abertos', slug: 'abertos', icon: 'clock-outline' },
];

// Componente isolado para não reiniciar o TextInput a cada letra digitada
function HeaderSection({
  inputText,
  setInputText,
  handleSearchSubmit,
  clearSearch,
  categoriaAtiva,
  setCategoriaAtiva,
  carrinhoItens,
  favoritosCount,
  userFoto,
  router
}) {
  return (
    <View style={styles.headerComponentContainer}>
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.mainTitle}>Explorar</Text>
          <Text style={styles.mainSubtitle}>Encontre viagens, serviços e experiências</Text>
        </View>
        
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/src/screens/TelaCarrinho')}>
            <Feather name="shopping-cart" size={24} color={COLORS.secondary} />
            {carrinhoItens > 0 && (
              <View style={styles.badge}><Text style={styles.badgeText}>{carrinhoItens}</Text></View>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.iconBtnCircleHeart} onPress={() => router.push('/src/screens/FavoritosDashboard')}>
            <Ionicons name="heart-outline" size={20} color={COLORS.secondary} />
            {favoritosCount > 0 && (
              <View style={styles.badge}><Text style={styles.badgeText}>{favoritosCount}</Text></View>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.avatarContainer}
            onPress={() => router.push('/src/screens/TelaPerfil')}
          >
            {userFoto ? (
              <Image source={{ uri: userFoto }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={18} color={COLORS.gray} />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchContainer}>
          <Feather name="search" size={20} color={COLORS.gray} />
          <TextInput 
            style={styles.searchInput} 
            placeholder="Buscar destinos, voos, serviços, passeios..." 
            placeholderTextColor={COLORS.gray}
            value={inputText} 
            onChangeText={setInputText} 
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
            autoCapitalize="none"
          />
          {inputText.length > 0 ? (
            <TouchableOpacity onPress={clearSearch} style={{ padding: 4, justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="close-circle" size={20} color={COLORS.gray} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={{ justifyContent: 'center', alignItems: 'center' }}>
              <MaterialCommunityIcons name="tune" size={20} color={COLORS.secondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryGridContainer}>
        {CATEGORIAS.map((item) => {
          const isActive = categoriaAtiva === item.slug;
          return (
            <TouchableOpacity 
              key={item.id} 
              style={styles.categoryGridItem} 
              onPress={() => setCategoriaAtiva(item.slug)}
            >
              <View style={[styles.categoryGridIconCircle, isActive && styles.categoryGridIconCircleActive]}>
                <MaterialCommunityIcons name={item.icon} size={26} color={isActive ? COLORS.primary : COLORS.gray} />
              </View>
              <Text style={[styles.categoryGridText, isActive && styles.categoryGridTextActive]}>{item.name}</Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      <View style={styles.bannerContainer}>
        <Image 
          source={{ uri: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=800&auto=format&fit=crop' }} 
          style={styles.bannerImage} 
          resizeMode="cover" 
        />
        <View style={styles.bannerOverlay} />
        <View style={styles.bannerContent}>
          <View style={styles.bannerBadge}><Text style={styles.bannerBadgeText}>LOKYVA VIAGENS</Text></View>
          <Text style={styles.bannerTitle}>Explore novos destinos e viva experiências incríveis</Text>
          <Text style={styles.bannerSubtitle}>Rápido, prático e inesquecível!</Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {categoriaAtiva === 'servicos' ? 'Serviços encontrados' : 
           categoriaAtiva === 'estabelecimentos' ? 'Locais e Destinos em destaque' : 
           categoriaAtiva === 'passeios' ? 'Passeios e Experiências' :
           categoriaAtiva === 'veiculos' ? 'Veículos e Transportes' :
           categoriaAtiva === 'casas' ? 'Imóveis e Acomodações' :
           categoriaAtiva === 'pets' ? 'Serviços e Produtos para Pets' :
           categoriaAtiva === 'objetos' ? 'Objetos e Equipamentos' :
           'Recomendados para você'}
        </Text>
      </View>
    </View>
  );
}

export default function TelaExplorar() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const [inputText, setInputText] = useState(params.query?.toString() || '');
  const [buscaAtiva, setBuscaAtiva] = useState(params.query?.toString() || '');
  
  const [categoriaAtiva, setCategoriaAtiva] = useState('tudo');
  const [lojas, setLojas] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  const [userFoto, setUserFoto] = useState(null);
  const [favoritos, setFavoritos] = useState([]);
  const [carrinhoItens, setCarrinhoItens] = useState(0); 

  useEffect(() => {
    carregarUsuario();
  }, []);

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    fetchExplorar(1, true);
  }, [buscaAtiva, categoriaAtiva]);

  const carregarUsuario = async () => {
    try {
      const userStr = await AsyncStorage.getItem('@waitless_user');
      if (userStr) {
        const user = JSON.parse(userStr);
        setUserFoto(user.foto || user.avatar || null);
      }
    } catch (e) {
      console.log('Erro ao carregar usuário:', e);
    }
  };

  const fetchExplorar = async (pageNumber, isRefresh = false) => {
    if (isRefresh) setLoading(true);
    else setLoadingMore(true);

    try {
      const token = await AsyncStorage.getItem('@waitless_token');
      let queryUrl = `${API_URL}/explorar?page=${pageNumber}&`;
      
      if (categoriaAtiva === 'estabelecimentos') queryUrl += `tipo_busca=estabelecimentos&`;
      else if (categoriaAtiva === 'servicos') queryUrl += `tipo_busca=servicos&`;
      else if (categoriaAtiva === 'tudo') queryUrl += `tipo_busca=tudo&`;
      else if (categoriaAtiva !== 'abertos') queryUrl += `categoria=${categoriaAtiva}&`;

      if (buscaAtiva.trim() !== '') queryUrl += `busca=${encodeURIComponent(buscaAtiva)}&`;
      
      if (categoriaAtiva === 'abertos') {
        queryUrl += `tipo_busca=estabelecimentos&apenas_abertos=1&`;
      }

      const res = await fetch(queryUrl, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      
      const json = await res.json();
      let novosDados = [];
      let ultimaPagina = 1;

      if (json.data && Array.isArray(json.data)) {
        novosDados = json.data;
        ultimaPagina = json.last_page || 1;
      } else if (Array.isArray(json)) {
        novosDados = json;
        ultimaPagina = 1;
      }

      if (isRefresh) {
        setLojas(novosDados);
      } else {
        setLojas(prev => [...prev, ...novosDados]);
      }

      setHasMore(pageNumber < ultimaPagina);
      
    } catch (e) {
      console.log('Erro ao buscar dados:', e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (!loading && !loadingMore && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchExplorar(nextPage);
    }
  };

  const handleSearchSubmit = () => {
    setBuscaAtiva(inputText);
  };

  const clearSearch = () => {
    setInputText('');
    setBuscaAtiva('');
  };

  const toggleFavorito = async (item) => {
    const idItem = item.id;
    setFavoritos(prev => 
      prev.includes(idItem) ? prev.filter(favId => favId !== idItem) : [...prev, idItem]
    );

    try {
      const token = await AsyncStorage.getItem('@waitless_token');
      const isServico = item.tipo === 'servico' || item.tipo === 'aluguel' || item.estabelecimento_id != null;
      const bodyParams = isServico ? { servico_id: idItem } : { estabelecimento_id: idItem };

      await fetch(`${API_URL}/favoritos/toggle`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyParams)
      });
    } catch (error) {
      console.log('Erro ao favoritar', error);
    }
  };

  const navegarParaDetalhes = (item) => {
    if (item.tipo === 'servico' || item.tipo === 'aluguel') {
      router.push({ 
        pathname: '/src/screens/ServicoDetalhes', 
        params: { id: item.id, tipo: item.tipo } 
      });
    } else {
      const estId = item.estabelecimento_id ? item.estabelecimento_id : item.id;
      router.push({ 
        pathname: '/src/screens/EstabelecimentoDetalhes', 
        params: { id: estId } 
      });
    }
  };

  const renderItem = ({ item }) => {
    const isFavorito = favoritos.includes(item.id);
    const isServico = item.tipo === 'servico' || item.tipo === 'aluguel' || item.estabelecimento_id != null;
    const nomeExibicao = item.nome || item.titulo || 'Sem título';
    
    let imageUrl = item.foto_capa || item.foto_perfil || item.foto;
    if (!imageUrl && item.fotos) {
      const fotosArray = typeof item.fotos === 'string' ? JSON.parse(item.fotos) : item.fotos;
      if (Array.isArray(fotosArray) && fotosArray.length > 0) {
        imageUrl = fotosArray[0];
      }
    }

    const valor = item.valor || item.valor_diaria;

    return (
      <TouchableOpacity 
        style={styles.card}
        activeOpacity={0.95}
        onPress={() => navegarParaDetalhes(item)}
      >
        <View style={styles.imageContainer}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="image-outline" size={40} color={COLORS.gray} />
              <Text style={styles.placeholderText}>Sem imagem</Text>
            </View>
          )}
          
          {categoriaAtiva === 'abertos' && !isServico && (
            <View style={styles.badgeAberto}>
              <Text style={styles.badgeAbertoText}>+ Aberto</Text>
            </View>
          )}

          {isServico && (
            <View style={styles.badgeServico}>
              <Text style={styles.badgeServicoText}>{item.tipo === 'aluguel' ? 'Locação' : 'Serviço'}</Text>
            </View>
          )}
          
          <TouchableOpacity style={styles.favoriteBtn} onPress={() => toggleFavorito(item)}>
            <Ionicons name={isFavorito ? "heart" : "heart-outline"} size={20} color={isFavorito ? COLORS.primary : COLORS.white} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.info}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.title} numberOfLines={1}>{nomeExibicao}</Text>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={14} color="#FFD700" />
              <Text style={styles.ratingTextPrincipal}>
                {item.avaliacao_media ? Number(item.avaliacao_media).toFixed(1) : 'Novo'}
              </Text>
              {item.total_avaliacoes ? (
                 <Text style={styles.ratingTextSecundario}>({item.total_avaliacoes})</Text>
              ) : null}
            </View>
          </View>
          
          <View style={styles.distanceRow}>
            <Feather name="map-pin" size={12} color={COLORS.gray} />
            <Text style={styles.distanceText}>{item.distancia || 'Calculando...'}</Text>
          </View>
          
          <View style={styles.bottomCardRow}>
            <View style={styles.branchContainer}>
              <Text style={styles.subtitle} numberOfLines={1}>
                {item.ramo_atuacao || 'Estabelecimento Parceiro'}
              </Text>
              {isServico ? (
                 <View style={styles.priceContainer}>
                   <Text style={styles.priceLabel}>A PARTIR DE</Text>
                   <Text style={styles.priceValue}>
                     R$ {valor ? Number(valor).toFixed(2).replace('.', ',') : '0,00'}
                   </Text>
                 </View>
              ) : (
                <View style={styles.agendamentoRow}>
                  <Feather name="check" size={14} color={COLORS.success} />
                  <Text style={styles.agendamentoText}>Agendamento online</Text>
                </View>
              )}
            </View>
            
            <TouchableOpacity 
              style={styles.agendarBtn}
              onPress={() => navegarParaDetalhes(item)}
            >
              <Text style={styles.agendarBtnText}>Detalhes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {loading && page === 1 ? (
        <View style={{ flex: 1, backgroundColor: COLORS.white }}>
          <HeaderSection 
            inputText={inputText}
            setInputText={setInputText}
            handleSearchSubmit={handleSearchSubmit}
            clearSearch={clearSearch}
            categoriaAtiva={categoriaAtiva}
            setCategoriaAtiva={setCategoriaAtiva}
            carrinhoItens={carrinhoItens}
            favoritosCount={favoritos.length}
            userFoto={userFoto}
            router={router}
          />
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        </View>
      ) : (
        <FlatList
          data={lojas}
          keyExtractor={(i, index) => i.id.toString() + (i.tipo || '') + index}
          ListHeaderComponent={
            <HeaderSection 
              inputText={inputText}
              setInputText={setInputText}
              handleSearchSubmit={handleSearchSubmit}
              clearSearch={clearSearch}
              categoriaAtiva={categoriaAtiva}
              setCategoriaAtiva={setCategoriaAtiva}
              carrinhoItens={carrinhoItens}
              favoritosCount={favoritos.length}
              userFoto={userFoto}
              router={router}
            />
          }
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            ) : <View style={{ height: 20 }} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={60} color={COLORS.border} />
              <Text style={styles.emptyTitle}>Nenhum resultado encontrado</Text>
              <Text style={styles.emptySubtitle}>Tente mudar os filtros de busca ou termo</Text>
            </View>
          }
        />
      )}

      {/* Menu Inferior com alinhamento centralizado perfeito */}
      <View style={styles.bottomNavContainer}>
        <TouchableOpacity style={styles.bottomNavItem} onPress={() => router.push('/src/screens/Home')}>
          <Feather name="home" size={22} color={COLORS.gray} />
          <Text style={styles.bottomNavText}>Início</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bottomNavItem}>
          <Ionicons name="compass" size={24} color={COLORS.primary} />
          <Text style={[styles.bottomNavText, styles.bottomNavTextActive]}>Explorar</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bottomNavItem} onPress={() => router.push('/src/screens/MeusAgendamentos')}>
          <Ionicons name="calendar-outline" size={22} color={COLORS.gray} />
          <Text style={styles.bottomNavText} numberOfLines={1}>Agendamentos</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bottomNavItem} onPress={() => router.push('/src/screens/TelaSuporte')}>
          <Ionicons name="help-circle-outline" size={22} color={COLORS.gray} />
          <Text style={styles.bottomNavText}>Suporte</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bottomNavItem} onPress={() => router.push('/src/screens/TelaPerfil')}>
          <Feather name="user" size={22} color={COLORS.gray} />
          <Text style={styles.bottomNavText}>Perfil</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: '#FFFFFF', 
    paddingTop: Platform.OS === 'android' ? 40 : 0 
  },
  headerComponentContainer: {
    backgroundColor: '#FFFFFF',
    paddingBottom: 10,
  },
  topHeader: { 
    flexDirection: 'row', 
    justify: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingTop: 10,
    paddingBottom: 16
  },
  mainTitle: { 
    fontSize: 24, 
    fontWeight: '900', 
    color: COLORS.secondary, 
    letterSpacing: -0.5
  },
  mainSubtitle: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
  },
  headerIcons: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12
  },
  iconBtn: { 
    position: 'relative', 
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnCircleHeart: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: { 
    position: 'absolute', 
    top: -6, 
    right: -8, 
    backgroundColor: COLORS.primary, 
    width: 18, 
    height: 18, 
    borderRadius: 9, 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderWidth: 2, 
    borderColor: '#FFFFFF' 
  },
  badgeText: { 
    color: COLORS.white, 
    fontSize: 9, 
    fontWeight: 'bold' 
  },
  avatarContainer: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    overflow: 'hidden', 
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: { 
    width: '100%', 
    height: '100%' 
  },
  avatarPlaceholder: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
  },

  searchRow: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  searchContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FFFFFF',
    borderRadius: 100, 
    paddingHorizontal: 20, 
    height: 52,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  searchInput: { 
    flex: 1, 
    marginLeft: 12, 
    fontSize: 14, 
    color: COLORS.textDark, 
    fontWeight: '500' 
  },
  
  categoryGridContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  categoryGridItem: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 18,
    width: 68,
  },
  categoryGridIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    backgroundColor: COLORS.white,
  },
  categoryGridIconCircleActive: {
    borderColor: COLORS.primary, 
    backgroundColor: COLORS.primaryLight,
  },
  categoryGridText: {
    fontSize: 11,
    color: COLORS.gray,
    fontWeight: '600',
    textAlign: 'center',
  },
  categoryGridTextActive: {
    color: COLORS.primary, 
    fontWeight: '700',
  },

  bannerContainer: {
    width: width - 32,
    height: 180,
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: 24,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  bannerContent: {
    position: 'absolute',
    top: 24,
    left: 20,
    right: 20,
  },
  bannerBadge: {
    backgroundColor: COLORS.primary, 
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  bannerBadgeText: {
    color: COLORS.white, 
    fontSize: 10,
    fontWeight: '800',
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.white,
    lineHeight: 24,
  },
  bannerSubtitle: {
    fontSize: 12,
    color: '#E5E7EB',
    marginTop: 6,
    fontWeight: '500',
  },
  
  sectionHeader: { 
    flexDirection: 'row',
    justify: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16, 
    marginBottom: 16 
  },
  sectionTitle: { 
    fontSize: 16, 
    fontWeight: '800', 
    color: COLORS.secondary 
  },
  
  list: { 
    paddingBottom: 20 
  }, 
  
  card: { 
    backgroundColor: COLORS.white, 
    borderRadius: 16, 
    marginHorizontal: 16,
    marginBottom: 20,
    overflow: 'hidden', 
    borderWidth: 1, 
    borderColor: '#F0F0F0',
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 8, 
    elevation: 2 
  },
  imageContainer: { 
    width: '100%', 
    height: 180, 
    position: 'relative' 
  },
  image: { 
    width: '100%', 
    height: '100%' 
  },
  imagePlaceholder: {
    width: '100%', 
    height: '100%',
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justify: 'center'
  },
  placeholderText: {
    color: COLORS.gray,
    fontSize: 12,
    marginTop: 6,
    fontWeight: '600'
  },
  badgeAberto: { 
    position: 'absolute', 
    top: 16, 
    left: 16, 
    backgroundColor: 'rgba(16, 185, 129, 0.9)', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 8,
    alignItems: 'center',
    justify: 'center'
  },
  badgeAbertoText: { 
    fontSize: 10, 
    fontWeight: '800', 
    color: COLORS.white,
    textTransform: 'uppercase',
  },
  badgeServico: { 
    position: 'absolute', 
    top: 16, 
    left: 16, 
    backgroundColor: COLORS.primary, 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 8,
    alignItems: 'center',
    justify: 'center'
  },
  badgeServicoText: { 
    fontSize: 10, 
    fontWeight: '800', 
    color: COLORS.white,
    textTransform: 'uppercase'
  },
  favoriteBtn: { 
    position: 'absolute', 
    top: 16, 
    right: 16, 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    backgroundColor: 'rgba(0,0,0,0.3)', 
    alignItems: 'center', 
    justify: 'center', 
  },
  
  info: { 
    padding: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justify: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: { 
    flex: 1,
    fontSize: 16, 
    fontWeight: '800', 
    color: COLORS.secondary, 
    marginRight: 10
  },
  ratingRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4
  },
  ratingTextPrincipal: { 
    fontSize: 13, 
    color: COLORS.textDark, 
    fontWeight: '800' 
  },
  ratingTextSecundario: {
    fontSize: 12,
    color: COLORS.gray,
    fontWeight: '500',
  },
  
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  distanceText: {
    fontSize: 12,
    color: COLORS.gray,
    fontWeight: '500'
  },
  
  subtitle: { 
    fontSize: 12, 
    color: COLORS.gray, 
    marginBottom: 10, 
    fontWeight: '500',
    flex: 1,
  },
  
  bottomCardRow: { 
    flexDirection: 'row', 
    justify: 'space-between', 
    alignItems: 'flex-end',
    gap: 16,
  },
  branchContainer: {
    flex: 1,
  },
  priceContainer: { 
    alignItems: 'flex-start',
  },
  priceLabel: { 
    fontSize: 10, 
    color: COLORS.gray, 
    marginBottom: 4,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  priceValue: { 
    fontSize: 17, 
    fontWeight: '900', 
    color: COLORS.primary, 
  },
  agendamentoRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4 
  },
  agendamentoText: { 
    color: COLORS.success, 
    fontSize: 12, 
    fontWeight: '700' 
  },
  agendarBtn: {
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primary, 
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  agendarBtnText: {
    color: COLORS.primary, 
    fontSize: 13,
    fontWeight: '800',
  },

  emptyContainer: { 
    alignItems: 'center', 
    marginTop: 60, 
    paddingHorizontal: 20 
  },
  emptyTitle: { 
    fontSize: 16, 
    fontWeight: '800', 
    color: COLORS.secondary, 
    marginTop: 12 
  },
  emptySubtitle: { 
    fontSize: 13, 
    color: COLORS.gray, 
    marginTop: 6, 
    textAlign: 'center', 
    fontWeight: '500' 
  },

  bottomNavContainer: {
    flexDirection: 'row',
    justify: 'space-around',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'android' ? 24 : 34,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  bottomNavItem: {
    flex: 1,
    alignItems: 'center',
    justify: 'center',
  },
  bottomNavText: {
    fontSize: 10,
    color: COLORS.gray,
    marginTop: 4,
    fontWeight: '500',
    textAlign: 'center',
  },
  bottomNavTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  }
});