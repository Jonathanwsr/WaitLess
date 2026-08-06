import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  SafeAreaView, 
  ActivityIndicator,
  Platform,
  useWindowDimensions
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// --- CORES PADRÃO ---
const COLORS = {
  primary: '#FF5A00', // Laranja Principal
  primaryLight: '#FFF4ED',
  secondary: '#222222', // Cinza quase escuro (Estilo Airbnb)
  gray: '#717171', // Cinza texto (Estilo Airbnb)
  lightGray: '#F7F7F9',
  white: '#FFFFFF',
  border: '#EBEBEB',
  warning: '#FF385C', 
  star: '#FFB800',
  success: '#10B981',
};

// Tratamento seguro da URL para evitar barras duplicadas e erros de rota
const ENV_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api';
const cleanBaseUrl = ENV_URL.endsWith('/') ? ENV_URL.slice(0, -1) : ENV_URL;
const API_URL = `${cleanBaseUrl}/mobile`;

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

const CATEGORIAS: { nome: string; icone: MaterialIconName; slug: string }[] = [
  { nome: 'Tudo', icone: 'apps', slug: 'tudo' },
  { nome: 'Beleza', icone: 'content-cut', slug: 'beleza' },
  { nome: 'Barbearia', icone: 'storefront', slug: 'barbearia' },
  { nome: 'Estética', icone: 'face', slug: 'estetica' },
  { nome: 'Automotivo', icone: 'directions-car', slug: 'automotivo' },
  { nome: 'Carros/Motos', icone: 'two-wheeler', slug: 'veiculos' },
  { nome: 'Flats/Estadias', icone: 'hotel', slug: 'flats' },
  { nome: 'Pets', icone: 'pets', slug: 'pets' },
  { nome: 'Casa/Faxina', icone: 'cleaning-services', slug: 'casa' },
  { nome: 'Eventos', icone: 'event', slug: 'eventos' },
  { nome: 'Saúde', icone: 'local-hospital', slug: 'saude' },
  { nome: 'Equipamentos', icone: 'build', slug: 'equipamentos' },
];

interface ItemExplorar {
  id: string | number;
  nome?: string;
  name?: string;
  foto_perfil?: string;
  fotos?: string[];
  tem_promocao?: boolean;
  avaliacao_media?: string | number;
  ramo_atuacao?: string;
  categoria?: string;
  cidade?: string;
  estado?: string;
  valor?: string | number;
  valor_diaria?: string | number;
  modelo?: string;
  distancia?: string | number;
  duracao_minutos?: string | number;
}

export default function TelaExplorar() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { width } = useWindowDimensions(); // Usado para garantir a responsividade

  const [itens, setItens] = useState<ItemExplorar[]>([]);
  const [destaques, setDestaques] = useState<ItemExplorar[]>([]);
  
  const [carregando, setCarregando] = useState<boolean>(true);
  const [busca, setBusca] = useState<string>(params.query ? params.query.toString() : '');
  const [tipoAtivo, setTipoAtivo] = useState<string>('estabelecimentos'); 
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>('tudo');

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      carregarDados();
    }, 400); 
    return () => clearTimeout(delayDebounceFn);
  }, [busca, tipoAtivo, categoriaAtiva]);

  const carregarDados = async () => {
    setCarregando(true);
    try {
      const token = await AsyncStorage.getItem('@waitless_token');
      
      if (!token) {
        router.replace('/autenticacao/login' as never);
        return;
      }

      const userDataString = await SecureStore.getItemAsync('userData');
      let userId = '';
      if (userDataString) {
        const usuario = JSON.parse(userDataString);
        userId = usuario.id || usuario.user_id || ''; 
      }
      
      const paramsObj: Record<string, string> = {
        tipo_busca: tipoAtivo,
      };

      if (busca.trim() !== '') {
        paramsObj.busca = busca.trim();
      }
      if (categoriaAtiva !== 'tudo') {
        paramsObj.categoria = categoriaAtiva;
      }
      if (userId) {
        paramsObj.user_id = userId;
      }

      const queryParams = new URLSearchParams(paramsObj).toString();
      const endpoint = `${API_URL}/explorar?${queryParams}`;

      const res = await fetch(endpoint, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${token}`, 
          'Accept': 'application/json' 
        }
      });
      
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Erro no servidor: ${res.status}`);
      }

      const data = await res.json();
      const resultados = Array.isArray(data) ? data : (data.data || []);
      
      setDestaques(resultados.slice(0, 4)); 
      setItens(resultados.slice(4)); 
      
    } catch (e) {
      setDestaques([]);
      setItens([]);
    } finally {
      setCarregando(false);
    }
  };

  const irParaDetalhes = (id: string | number) => {
    router.push({ 
      pathname: '/src/screens/ExplorarDetalhes' as never, 
      params: { 
        id: id.toString(), 
        tipo: tipoAtivo 
      } 
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      
      {/* HEADER FIXO */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.logoText}>Explorar</Text>
          <View style={styles.locationContainer}>
            <Ionicons name="location-sharp" size={14} color={COLORS.primary} />
            <Text style={styles.locationText} numberOfLines={1}>Sua Localização</Text>
            <Ionicons name="chevron-down" size={14} color={COLORS.gray} />
          </View>
        </View>

        <View style={styles.headerIcons}>
          <TouchableOpacity 
            style={styles.iconBtn} 
            onPress={() => router.push('/modal' as never)}
          >
            <Ionicons name="grid-outline" size={24} color={COLORS.secondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/src/screens/FavoritosDashboard' as never)}>
            <Ionicons name="heart-outline" size={24} color={COLORS.secondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/src/screens/TelaCarrinho' as never)}>
            <Ionicons name="cart-outline" size={24} color={COLORS.secondary} />
            <View style={styles.badge} />
          </TouchableOpacity>

          {/* Rota ajustada e correta para TelaPerfil */}
          <TouchableOpacity style={styles.profileBtn} onPress={() => router.push('/src/screens/TelaPerfil' as never)}>
            <Ionicons name="person" size={16} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* BARRA DE PESQUISA */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={COLORS.secondary} style={{ marginRight: 10 }} />
          <TextInput
            placeholder="Busque por nome, marca, modelo, flat, pet..."
            placeholderTextColor={COLORS.gray}
            style={styles.searchInput}
            value={busca}
            onChangeText={setBusca}
            clearButtonMode="while-editing"
          />
        </View>

        {/* FILTRO PRINCIPAL */}
        <View style={styles.typeFilterContainer}>
          {[
            { label: 'Locais', value: 'estabelecimentos' },
            { label: 'Serviços', value: 'servicos' },
            { label: 'Aluguéis', value: 'reservas' }
          ].map((tipo) => (
            <TouchableOpacity 
              key={tipo.value} 
              style={[styles.typeBtn, tipoAtivo === tipo.value && styles.typeBtnAtivo]}
              onPress={() => setTipoAtivo(tipo.value)}
              activeOpacity={0.8}
            >
              <Text style={[styles.typeBtnText, tipoAtivo === tipo.value && styles.typeBtnTextAtivo]}>
                {tipo.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* CARROSSEL DE CATEGORIAS */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll} contentContainerStyle={{ paddingHorizontal: 16 }}>
          {CATEGORIAS.map((cat, i) => (
            <TouchableOpacity
              key={i}
              style={styles.categoriaCard}
              onPress={() => setCategoriaAtiva(cat.slug)}
            >
              <View style={[styles.iconContainer, categoriaAtiva === cat.slug && styles.iconContainerAtivo]}>
                <MaterialIcons 
                  name={cat.icone} 
                  size={26} 
                  color={categoriaAtiva === cat.slug ? COLORS.white : COLORS.secondary} 
                />
              </View>
              <Text style={[styles.categoriaTexto, categoriaAtiva === cat.slug && styles.categoriaTextoAtivo]}>
                {cat.nome}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* CONTEÚDO PRINCIPAL */}
        {carregando ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Buscando o melhor para você...</Text>
          </View>
        ) : destaques.length === 0 && itens.length === 0 ? (
          
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={60} color={COLORS.border} style={{ marginBottom: 16 }} />
            <Text style={styles.emptyTitle}>Poxa, não encontramos nada.</Text>
            <Text style={styles.emptyDesc}>Nenhum(a) {tipoAtivo} está disponível para esta busca na sua região no momento.</Text>
            <TouchableOpacity style={styles.clearBtn} onPress={() => { setBusca(''); setCategoriaAtiva('tudo'); }}>
              <Text style={styles.clearBtnText}>Limpar Filtros</Text>
            </TouchableOpacity>
          </View>

        ) : (
          <>
            {/* CARROSSEL DE DESTAQUES */}
            {destaques.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Em Destaque</Text>
                </View>
                
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
                  {destaques.map((item, index) => (
                    <TouchableOpacity 
                      key={index} 
                      style={[styles.cardDestaque, { width: width * 0.75 }]} // Largura baseada no tamanho da tela
                      onPress={() => irParaDetalhes(item.id)}
                      activeOpacity={0.9}
                    >
                      <View style={styles.imageDestaqueContainer}>
                        <Image 
                          source={{ uri: item.foto_perfil || item.fotos?.[0] || 'https://via.placeholder.com/300x200' }} 
                          style={styles.imageDestaque} 
                          contentFit="cover" 
                        />
                        <TouchableOpacity style={styles.heartBtnAbs}>
                          <Ionicons name="heart-outline" size={20} color={COLORS.white} />
                        </TouchableOpacity>
                        {item.tem_promocao && (
                          <View style={styles.promoBadge}><Text style={styles.promoText}>Promoção</Text></View>
                        )}
                      </View>
                      
                      <View style={styles.infoDestaque}>
                        <View style={styles.rowBetween}>
                          <Text style={styles.titleDestaque} numberOfLines={1}>{item.nome || item.name}</Text>
                          <View style={styles.ratingRow}>
                            <Ionicons name="star" size={12} color={COLORS.star} />
                            <Text style={styles.ratingText}> {item.avaliacao_media || '5.0'}</Text>
                          </View>
                        </View>
                        <Text style={styles.subTitleDestaque} numberOfLines={1}>
                          {item.ramo_atuacao || item.categoria} • {item.cidade || 'Local'}
                        </Text>
                        
                        <View style={styles.priceRow}>
                          <Text style={styles.priceValue}>
                            R$ {parseFloat((item.valor || item.valor_diaria || '0').toString()).toFixed(2).replace('.', ',')}
                          </Text>
                          <Text style={styles.priceLabel}> / diária ou serviço</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* LISTA VERTICAL DE RESULTADOS */}
            {itens.length > 0 && (
              <View style={[styles.section, { paddingHorizontal: 16 }]}>
                <Text style={styles.sectionTitle}>Recomendados para você</Text>
                
                {itens.map((item, index) => (
                  <TouchableOpacity 
                    key={index} 
                    style={styles.cardAirbnb}
                    onPress={() => irParaDetalhes(item.id)}
                    activeOpacity={0.9}
                  >
                    <View style={styles.imageAirbnbContainer}>
                      <Image 
                        source={{ uri: item.foto_perfil || item.fotos?.[0] || 'https://via.placeholder.com/400x300' }} 
                        style={styles.imageAirbnb} 
                        contentFit="cover" 
                      />
                      <TouchableOpacity style={styles.heartBtnAbs}>
                        <Ionicons name="heart-outline" size={24} color={COLORS.white} />
                      </TouchableOpacity>
                    </View>
                    
                    <View style={styles.infoAirbnb}>
                      <View style={styles.rowBetween}>
                        <Text style={styles.titleAirbnb} numberOfLines={1}>{item.nome || item.name}</Text>
                        <View style={styles.ratingRow}>
                          <Ionicons name="star" size={14} color={COLORS.star} />
                          <Text style={styles.ratingTextAirbnb}> {item.avaliacao_media || '5.0'}</Text>
                        </View>
                      </View>
                      
                      <Text style={styles.subTitleAirbnb} numberOfLines={1}>
                        {item.ramo_atuacao || item.categoria} {item.modelo ? `• ${item.modelo}` : ''}
                      </Text>
                      
                      <Text style={styles.distanceText}>
                        {item.distancia ? `${parseFloat(item.distancia.toString()).toFixed(1)} km de distância` : `${item.cidade || 'Local'} - ${item.estado || ''}`}
                      </Text>
                      
                      <View style={styles.priceRow}>
                        <Text style={styles.priceValueAirbnb}>
                          R$ {parseFloat((item.valor || item.valor_diaria || '0').toString()).toFixed(2).replace('.', ',')}
                        </Text>
                        {item.duracao_minutos && (
                          <Text style={styles.durationTextAirbnb}> a cada {item.duracao_minutos} min</Text>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white, paddingTop: Platform.OS === 'android' ? 30 : 0 },
  container: { flex: 1 },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.white },
  headerLeft: { flex: 1 },
  logoText: { fontSize: 24, fontWeight: '900', color: COLORS.primary, letterSpacing: -1 },
  locationContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  locationText: { fontSize: 13, fontWeight: '600', color: COLORS.gray, marginHorizontal: 4, maxWidth: '80%' },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconBtn: { position: 'relative' },
  badge: { position: 'absolute', top: -2, right: -4, width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary, borderWidth: 2, borderColor: COLORS.white },
  profileBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },

  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, marginHorizontal: 16, borderRadius: 30, paddingHorizontal: 16, height: 56, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5 },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.secondary, fontWeight: '500' },

  typeFilterContainer: { flexDirection: 'row', backgroundColor: COLORS.lightGray, marginHorizontal: 16, borderRadius: 100, padding: 4, marginBottom: 24 },
  typeBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 100 },
  typeBtnAtivo: { backgroundColor: COLORS.primary, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  typeBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.gray },
  typeBtnTextAtivo: { color: COLORS.white, fontWeight: '900' },

  categoriesScroll: { paddingBottom: 16, marginBottom: 10 },
  categoriaCard: { alignItems: 'center', marginRight: 24 },
  iconContainer: { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.lightGray, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  iconContainerAtivo: { backgroundColor: COLORS.primary, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
  categoriaTexto: { fontSize: 13, fontWeight: '600', color: COLORS.gray },
  categoriaTextoAtivo: { color: COLORS.primary, fontWeight: '900' },

  section: { marginBottom: 32 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 22, fontWeight: '800', color: COLORS.secondary, letterSpacing: -0.5 },

  cardDestaque: { marginRight: 16, overflow: 'hidden' },
  imageDestaqueContainer: { position: 'relative', width: '100%', height: 180, borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
  imageDestaque: { width: '100%', height: '100%', backgroundColor: COLORS.lightGray },
  promoBadge: { position: 'absolute', bottom: 12, left: 12, backgroundColor: COLORS.success, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  promoText: { color: COLORS.white, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  infoDestaque: { paddingHorizontal: 4 },
  titleDestaque: { fontSize: 16, fontWeight: '800', color: COLORS.secondary, flex: 1, marginRight: 8 },
  subTitleDestaque: { fontSize: 14, color: COLORS.gray, marginTop: 2, marginBottom: 4 },

  cardAirbnb: { width: '100%', marginBottom: 32 },
  imageAirbnbContainer: { width: '100%', height: 280, borderRadius: 16, overflow: 'hidden', marginBottom: 12, position: 'relative' },
  imageAirbnb: { width: '100%', height: '100%', backgroundColor: COLORS.lightGray },
  heartBtnAbs: { position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center' },
  
  infoAirbnb: { paddingHorizontal: 4 },
  titleAirbnb: { fontSize: 18, fontWeight: '700', color: COLORS.secondary, flex: 1, marginRight: 8 },
  subTitleAirbnb: { fontSize: 15, color: COLORS.gray, marginTop: 2 },
  distanceText: { fontSize: 15, color: COLORS.gray, marginTop: 2, marginBottom: 6 },
  
  ratingRow: { flexDirection: 'row', alignItems: 'center' },
  ratingText: { fontSize: 14, fontWeight: '700', color: COLORS.secondary },
  ratingTextAirbnb: { fontSize: 15, fontWeight: '600', color: COLORS.secondary },
  
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4 },
  priceValue: { fontSize: 16, fontWeight: '800', color: COLORS.secondary },
  priceValueAirbnb: { fontSize: 17, fontWeight: '800', color: COLORS.secondary },
  priceLabel: { fontSize: 14, color: COLORS.gray },
  durationTextAirbnb: { fontSize: 15, color: COLORS.gray },

  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  centerLoading: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  loadingText: { marginTop: 16, color: COLORS.gray, fontWeight: '600', fontSize: 16 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 30, backgroundColor: COLORS.lightGray, marginHorizontal: 16, borderRadius: 24, marginTop: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: COLORS.secondary, marginBottom: 8, textAlign: 'center' },
  emptyDesc: { fontSize: 15, color: COLORS.gray, textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  clearBtn: { backgroundColor: COLORS.secondary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 100 },
  clearBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 15 }
});