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
  Dimensions
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

// --- CORES PADRÃO ---
const COLORS = {
  primary: '#FF5A00', 
  primaryLight: '#FFF4ED',
  secondary: '#111827',
  gray: '#6B7280',
  lightGray: '#F3F4F6',
  white: '#FFFFFF',
  border: '#E5E7EB',
  warning: '#FBBF24', 
  success: '#10B981',
};

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api/mobile';

// Subcategorias de filtros
const CATEGORIAS = [
  { nome: 'Tudo', icone: 'apps', slug: 'tudo' },
  { nome: 'Beleza', icone: 'content-cut', slug: 'beleza' },
  { nome: 'Barbearia', icone: 'storefront', slug: 'barbearia' },
  { nome: 'Estética', icone: 'face', slug: 'estetica' },
  { nome: 'Automotivo', icone: 'directions-car', slug: 'automotivo' },
  { nome: 'Pets', icone: 'pets', slug: 'pets' },
  { nome: 'Casa/Faxina', icone: 'cleaning-services', slug: 'casa' },
  { nome: 'Eventos', icone: 'event', slug: 'eventos' },
  { nome: 'Saúde', icone: 'local-hospital', slug: 'saude' },
  { nome: 'Equipamentos', icone: 'build', slug: 'equipamentos' },
];

export default function TelaExplorar() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // CORREÇÃO AQUI: Adicionado <any[]> para evitar o erro "never"
  const [itens, setItens] = useState<any[]>([]);
  const [destaques, setDestaques] = useState<any[]>([]);
  
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
      
      const queryParams = new URLSearchParams({
        tipo_busca: tipoAtivo,
        categoria: categoriaAtiva === 'tudo' ? '' : categoriaAtiva,
        busca: busca
      }).toString();

      const res = await fetch(`${API_URL}/explorar?${queryParams}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json' 
        }
      });
      const data = await res.json();
      
      const resultados = Array.isArray(data) ? data : (data.data || []);
      
      setDestaques(resultados.slice(0, 4)); 
      setItens(resultados.slice(4)); 
      
    } catch (e) {
      console.log('Erro ao conectar com a API:', e);
    } finally {
      setCarregando(false);
    }
  };

  const irParaDetalhes = (id: any) => {
    router.push({ 
      pathname: '/src/screens/ExplorarDetalhes', 
      params: { 
        id: id, 
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
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/src/screens/FavoritosDashboard' as any)}>
            <Ionicons name="heart-outline" size={24} color={COLORS.secondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/src/screens/PagamentoScreen' as any)}>
            <Ionicons name="cart-outline" size={24} color={COLORS.secondary} />
            <View style={styles.badge} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.profileBtn} onPress={() => router.push('/src/screens/TelaPerfil' as any)}>
            <Ionicons name="person" size={16} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* BARRA DE PESQUISA */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={COLORS.gray} style={{ marginRight: 10 }} />
          <TextInput
            placeholder="O que você está buscando?"
            placeholderTextColor={COLORS.gray}
            style={styles.searchInput}
            value={busca}
            onChangeText={setBusca}
            clearButtonMode="while-editing"
          />
        </View>

        {/* FILTRO PRINCIPAL (TIPO DE BUSCA) */}
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
                <MaterialIcons name={cat.icone as any} size={26} color={categoriaAtiva === cat.slug ? COLORS.primary : COLORS.gray} />
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
                      style={styles.cardDestaque}
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
                            <Ionicons name="star" size={12} color={COLORS.warning} />
                            <Text style={styles.ratingText}> {item.avaliacao_media || '5.0'}</Text>
                          </View>
                        </View>
                        <Text style={styles.subTitleDestaque} numberOfLines={1}>
                          {item.ramo_atuacao || item.categoria} • {item.cidade || 'Local'}
                        </Text>
                        
                        <View style={styles.priceRowDestaque}>
                          <Text style={styles.priceLabel}>A partir de</Text>
                          <Text style={styles.priceValue}>
                            R$ {parseFloat(item.valor || item.valor_diaria || '0').toFixed(2).replace('.', ',')}
                          </Text>
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
                    style={styles.cardLista}
                    onPress={() => irParaDetalhes(item.id)}
                  >
                    <Image 
                      source={{ uri: item.foto_perfil || item.fotos?.[0] || 'https://via.placeholder.com/150' }} 
                      style={styles.imageLista} 
                      contentFit="cover" 
                    />
                    
                    <View style={styles.infoLista}>
                      <View style={styles.rowBetween}>
                        <Text style={styles.titleLista} numberOfLines={1}>{item.nome || item.name}</Text>
                        <Ionicons name="heart-outline" size={20} color={COLORS.gray} />
                      </View>
                      
                      <Text style={styles.subTitleLista} numberOfLines={1}>
                        {item.ramo_atuacao || item.categoria}
                      </Text>
                      
                      <View style={styles.tagsRow}>
                        <View style={styles.ratingTag}>
                          <Ionicons name="star" size={12} color={COLORS.warning} />
                          <Text style={styles.ratingTextTag}> {item.avaliacao_media || '5.0'}</Text>
                        </View>
                        <Text style={styles.dotSeparator}>•</Text>
                        <Text style={styles.distanceText}>{item.distancia ? `${parseFloat(item.distancia).toFixed(1)} km` : 'Próximo'}</Text>
                      </View>
                      
                      <View style={styles.priceRowLista}>
                        <Text style={styles.priceValueLista}>
                          R$ {parseFloat(item.valor || item.valor_diaria || '0').toFixed(2).replace('.', ',')}
                        </Text>
                        {item.duracao_minutos && (
                          <Text style={styles.durationText}>/ {item.duracao_minutos} min</Text>
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
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  iconBtn: { position: 'relative' },
  badge: { position: 'absolute', top: -2, right: -4, width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary, borderWidth: 2, borderColor: COLORS.white },
  profileBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },

  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.lightGray, marginHorizontal: 16, borderRadius: 12, paddingHorizontal: 16, height: 50, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  searchInput: { flex: 1, fontSize: 16, color: COLORS.secondary },

  typeFilterContainer: { flexDirection: 'row', backgroundColor: COLORS.lightGray, marginHorizontal: 16, borderRadius: 12, padding: 4, marginBottom: 20 },
  typeBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  typeBtnAtivo: { backgroundColor: COLORS.white, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  typeBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.gray },
  typeBtnTextAtivo: { color: COLORS.secondary, fontWeight: '900' },

  categoriesScroll: { paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border, marginBottom: 20 },
  categoriaCard: { alignItems: 'center', marginRight: 16 },
  iconContainer: { width: 64, height: 64, borderRadius: 20, backgroundColor: COLORS.lightGray, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  iconContainerAtivo: { backgroundColor: COLORS.primaryLight, borderWidth: 1, borderColor: COLORS.primary },
  categoriaTexto: { fontSize: 12, fontWeight: '600', color: COLORS.gray },
  categoriaTextoAtivo: { color: COLORS.secondary, fontWeight: '900' },

  section: { marginBottom: 30 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 20, fontWeight: '900', color: COLORS.secondary },
  verTodosText: { fontSize: 14, fontWeight: '800', color: COLORS.primary },

  cardDestaque: { width: width * 0.75, backgroundColor: COLORS.white, borderRadius: 20, marginRight: 16, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  imageDestaqueContainer: { position: 'relative', width: '100%', height: 160 },
  imageDestaque: { width: '100%', height: '100%', backgroundColor: COLORS.lightGray },
  heartBtnAbs: { position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  promoBadge: { position: 'absolute', bottom: 12, left: 12, backgroundColor: COLORS.success, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  promoText: { color: COLORS.white, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  infoDestaque: { padding: 16 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleDestaque: { fontSize: 16, fontWeight: '900', color: COLORS.secondary, flex: 1, marginRight: 8 },
  subTitleDestaque: { fontSize: 13, color: COLORS.gray, marginTop: 4, marginBottom: 12 },
  ratingRow: { flexDirection: 'row', alignItems: 'center' },
  ratingText: { fontSize: 13, fontWeight: '800', color: COLORS.secondary },
  priceRowDestaque: { flexDirection: 'row', alignItems: 'baseline' },
  priceLabel: { fontSize: 11, color: COLORS.gray, marginRight: 4 },
  priceValue: { fontSize: 16, fontWeight: '900', color: COLORS.primary },

  cardLista: { flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border, padding: 10 },
  imageLista: { width: 90, height: 90, borderRadius: 12, backgroundColor: COLORS.lightGray },
  infoLista: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  titleLista: { fontSize: 16, fontWeight: '900', color: COLORS.secondary, flex: 1, marginRight: 8 },
  subTitleLista: { fontSize: 13, color: COLORS.gray, marginTop: 2, marginBottom: 8 },
  tagsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  ratingTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  ratingTextTag: { fontSize: 12, fontWeight: '800', color: '#D97706' },
  dotSeparator: { fontSize: 12, color: COLORS.gray, marginHorizontal: 8 },
  distanceText: { fontSize: 12, fontWeight: '600', color: COLORS.gray },
  priceRowLista: { flexDirection: 'row', alignItems: 'baseline' },
  priceValueLista: { fontSize: 15, fontWeight: '900', color: COLORS.secondary },
  durationText: { fontSize: 12, color: COLORS.gray, marginLeft: 4 },

  centerLoading: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  loadingText: { marginTop: 12, color: COLORS.gray, fontWeight: '700' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 30, backgroundColor: COLORS.lightGray, marginHorizontal: 16, borderRadius: 24, marginTop: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: COLORS.secondary, marginBottom: 8, textAlign: 'center' },
  emptyDesc: { fontSize: 14, color: COLORS.gray, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  clearBtn: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 100 },
  clearBtnText: { color: COLORS.primary, fontWeight: '900', fontSize: 14 }
});