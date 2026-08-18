import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
  Dimensions,
  SafeAreaView
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

const COLORS = {
  primary: '#FF5A00',      // Laranja Principal
  primaryLight: '#FFF0E6', 
  secondary: '#111827',
  gray: '#6B7280',
  lightGray: '#F8F9FA',
  cardBg: '#FFFFFF',
  border: '#E5E7EB',
  star: '#FF5A00',         // Estrela laranja
  green: '#10B981',        // Verde para tags "Grátis" e descontos
  white: '#FFFFFF',
};

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?q=80&w=1000&auto=format&fit=crop';
const DEFAULT_PROFILE = 'https://via.placeholder.com/150';
const BASE_API = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api';

// TIPAGENS RÍGIDAS (SEM USO DE ANY) PARA EVITAR CRASHES
interface Estabelecimento {
  id: number;
  nome: string;
  foto_perfil?: string;
  foto_capa?: string;
  ramo_atuacao?: string;
  categoria?: string;
  telefone?: string;
  cidade?: string;
}

interface ResumoAvaliacoes {
  media_geral: string | number;
  total: number;
}

interface ItemRaw {
  id: number;
  nome: string;
  categoria?: string;
  valor?: number | string;
  valor_diaria?: number | string;
  foto_principal?: string;
  foto?: string;
  fotos?: string | string[];
  tem_promocao?: boolean | number | string;
  tipo_desconto?: string;
  valor_desconto?: number | string;
  capacidade_pessoas?: number;
  lugares?: number;
  cambio?: string;
  combustivel?: string;
}

interface ItemCatalogo extends ItemRaw {
  tipoItem: 'servico' | 'aluguel';
}

export default function ServicoDetalhes() {
  const router = useRouter();
  const searchParams = useLocalSearchParams();
  
  const rawId = searchParams.id || searchParams.estabelecimentoId;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const [estabelecimento, setEstabelecimento] = useState<Estabelecimento | null>(null);
  const [avaliacoes, setAvaliacoes] = useState<ResumoAvaliacoes | null>(null);
  
  const [catalogo, setCatalogo] = useState<ItemCatalogo[]>([]);
  const [categorias, setCategorias] = useState<string[]>(['Destaques']);
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>('Destaques');
  
  const [saldoPontos, setSaldoPontos] = useState<number>(0);

  useEffect(() => {
    if (id) {
      carregarPerfilDaLoja();
    } else {
      setLoading(false);
      setError(true);
    }
  }, [id]);

  const carregarPerfilDaLoja = async () => {
    try {
      setLoading(true);
      setError(false);
      const token = await AsyncStorage.getItem('@waitless_token');
      const cleanBaseUrl = BASE_API.replace(/\/mobile\/?$/, '').replace(/\/+$/, '');

      const res = await fetch(`${cleanBaseUrl}/mobile/estabelecimentos/${id}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
      });

      if (!res.ok) throw new Error('Falha na API');
      const data = await res.json();

      setEstabelecimento(data.estabelecimento);
      
      const avaliacoesFormatadas: ResumoAvaliacoes = {
        media_geral: data.avaliacoes_resumo?.media_geral ? Number(data.avaliacoes_resumo.media_geral).toFixed(1) : '4.8',
        total: data.avaliacoes_resumo?.total || 829
      };
      setAvaliacoes(avaliacoesFormatadas);

      const locacoesFormatadas: ItemCatalogo[] = (data.locacoes || []).map((loc: ItemRaw) => ({ ...loc, tipoItem: 'aluguel' }));
      const servicosFormatados: ItemCatalogo[] = (data.servicos || []).map((ser: ItemRaw) => ({ ...ser, tipoItem: 'servico' }));
      const todosOsItens = [...locacoesFormatadas, ...servicosFormatados];
      
      setCatalogo(todosOsItens);

      const catsUnicas = Array.from(new Set(todosOsItens.map(i => i.categoria || 'Econômicos')));
      setCategorias(['Destaques', ...catsUnicas as string[]]);

      buscarSaldoPontos(cleanBaseUrl, token, String(id));

    } catch (e) {
      console.log('Erro ao carregar vitrine:', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const buscarSaldoPontos = async (baseUrl: string, token: string | null, estId: string) => {
    try {
      const res = await fetch(`${baseUrl}/mobile/pontos/saldo?estabelecimento_id=${estId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
      });
      if(res.ok) {
          const data = await res.json();
          setSaldoPontos(data.saldo || 1000); 
      }
    } catch (e) {
      console.log('Erro ao buscar saldo', e);
    }
  };

  const getImagemUrl = (item: ItemCatalogo): string => {
    let img = item.foto_principal || item.foto;
    if (!img && item.fotos) {
        let arr: string[] = [];
        if (typeof item.fotos === 'string') {
          try { arr = JSON.parse(item.fotos); } catch (e) { arr = []; }
        } else if (Array.isArray(item.fotos)) {
          arr = item.fotos as string[];
        }
        if(arr && arr.length > 0) img = arr[0];
    }
    return img || DEFAULT_COVER;
  };

  // CÁLCULO SEGURO EVITANDO ERRO TOFIXED
  const calcularPreco = (item: ItemCatalogo) => {
    const precoBase = Number(item.valor || item.valor_diaria || 0);
    let precoComDesconto = precoBase;

    const temPromocao = item.tem_promocao === true || item.tem_promocao === 1 || item.tem_promocao === '1';

    if (temPromocao && item.valor_desconto) {
        const valorDesc = Number(item.valor_desconto);
        if (item.tipo_desconto === 'percentual') {
            precoComDesconto = precoBase - (precoBase * (valorDesc / 100));
        } else {
            precoComDesconto = precoBase - valorDesc;
        }
    }
    
    precoComDesconto = Math.max(0, precoComDesconto);
    return { precoBase, precoComDesconto, temPromocao };
  };

  // 👉 REDIRECIONAMENTO PARA A TELA "CriarReserva" (CARRINHO)
  const handleNavegarParaReserva = (item: ItemCatalogo) => {
    router.push({
      pathname: '/src/screens/CriarReserva' as any,
      params: {
        estabelecimentoId: estabelecimento?.id,
        servicoId: item.id,
        tipo: item.tipoItem
      }
    });
  };

  const renderItemCard = (item: ItemCatalogo) => {
    const imgUrl = getImagemUrl(item);
    const { precoBase, precoComDesconto, temPromocao } = calcularPreco(item);
    
    const isDestaque = item.tipoItem === 'aluguel' || temPromocao;
    const labelCategoria = item.categoria ? item.categoria.charAt(0).toUpperCase() + item.categoria.slice(1) : 'Econômico';
    const labelCambio = item.cambio ? ` • ${item.cambio}` : ' • Manual';

    return (
      <TouchableOpacity 
        key={`${item.tipoItem}-${item.id}`} 
        style={styles.cardItem} 
        activeOpacity={0.9}
        onPress={() => handleNavegarParaReserva(item)}
      >
        <View style={styles.cardImageContainer}>
          <Image source={{ uri: imgUrl }} style={styles.cardImage} />
          {isDestaque && (
             <View style={styles.badgeDestaque}>
               <Text style={styles.badgeDestaqueText}>Mais reservado</Text>
             </View>
          )}
          <View style={styles.addBtnContainer}>
            <View style={styles.addBtn}>
              <Feather name="plus" size={16} color={COLORS.primary} />
            </View>
          </View>
        </View>

        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.nome}</Text>
          
          <View style={styles.priceRow}>
            <Text style={styles.priceBold}>R$ {precoComDesconto.toFixed(2).replace('.', ',')}</Text>
            <Text style={styles.priceSuffix}> {item.tipoItem === 'aluguel' ? '/dia' : ''}</Text>
          </View>
          
          {temPromocao && item.valor_desconto ? (
            <View style={styles.oldPriceRow}>
              <Text style={styles.oldPriceText}>R$ {precoBase.toFixed(2).replace('.', ',')}</Text>
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>
                  -{item.tipo_desconto === 'percentual' ? `${item.valor_desconto}%` : `R$ ${item.valor_desconto}`}
                </Text>
              </View>
            </View>
          ) : <View style={{height: 18}} />} 

          <Text style={styles.cardSpecs} numberOfLines={1}>
            {labelCategoria}{labelCambio}
          </Text>
          
          {(item.lugares || item.capacidade_pessoas || 5) && (
            <View style={styles.cardFooterInfo}>
              <Ionicons name="person-outline" size={12} color={COLORS.gray} />
              <Text style={styles.cardFooterText}>{item.lugares || item.capacidade_pessoas || 5} lugares</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (error || !estabelecimento) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={COLORS.gray} />
        <Text style={{color: COLORS.gray, marginTop: 10}}>Não foi possível carregar a vitrine.</Text>
      </View>
    );
  }

  const itensExibidos = categoriaAtiva === 'Destaques' 
      ? catalogo.slice(0, 10) 
      : catalogo.filter(i => i.categoria === categoriaAtiva || i.categoria?.toLowerCase() === categoriaAtiva.toLowerCase());

  // Pegando o menor valor do catálogo para exibir na vitrine
  const valoresCatalogo = catalogo.map(i => Number(i.valor || i.valor_diaria || 80));
  const minValor = valoresCatalogo.length > 0 ? Math.min(...valoresCatalogo) : 80;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        
        {/* ==================================================== */}
        {/* HEADER COVER E BOTÕES NAVEGAÇÃO */}
        {/* ==================================================== */}
        <View style={styles.coverContainer}>
          <Image source={{ uri: estabelecimento.foto_capa || DEFAULT_COVER }} style={styles.coverImage} />
          <View style={styles.coverOverlay} />
          
          <SafeAreaView style={styles.headerButtons}>
            <TouchableOpacity style={styles.circleBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={20} color={COLORS.secondary} />
            </TouchableOpacity>
            <View style={styles.headerRightBtns}>
              <TouchableOpacity style={styles.circleBtn}>
                <Ionicons name="heart-outline" size={20} color={COLORS.secondary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.circleBtn}>
                <Ionicons name="search" size={20} color={COLORS.secondary} />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>

        {/* ==================================================== */}
        {/* CARD DO ESTABELECIMENTO */}
        {/* ==================================================== */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrapper}>
            <Image source={{ uri: estabelecimento.foto_perfil || DEFAULT_PROFILE }} style={styles.avatarImage} />
          </View>

          <Text style={styles.estName}>{estabelecimento.nome}</Text>
          <Text style={styles.estSub}>
            {estabelecimento.ramo_atuacao || 'Locadora'} • 2.9 km • Min. R$ {minValor.toFixed(2).replace('.',',')}
          </Text>

          <View style={styles.infoRowContainer}>
            <View style={styles.infoRow}>
              <Ionicons name="star" size={14} color={COLORS.star} />
              <Text style={styles.infoTextBold}>{avaliacoes?.media_geral}</Text>
              <Text style={styles.infoTextGray}>({avaliacoes?.total} avaliações)</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.gray} />
          </View>
          
          <View style={[styles.infoRowContainer, { borderBottomWidth: 0, paddingBottom: 0 }]}>
            <View style={styles.infoRow}>
              <Text style={styles.infoTextBold}>Retirada • 80-90 min • </Text>
              <Text style={styles.infoTextGreen}>Grátis</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.gray} />
          </View>
          <Text style={styles.infoDescBottom}>Mais opções disponíveis no local</Text>
        </View>

        {/* ==================================================== */}
        {/* TABS DE CATEGORIAS */}
        {/* ==================================================== */}
        <View style={styles.tabsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
            {categorias.map(cat => (
              <TouchableOpacity 
                key={cat} 
                style={[styles.tabBtn, categoriaAtiva === cat && styles.tabBtnActive]}
                onPress={() => setCategoriaAtiva(cat)}
              >
                <Text style={[styles.tabText, categoriaAtiva === cat && styles.tabTextActive]}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1).replace(/_/g, ' ')}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ==================================================== */}
        {/* LISTA DE PRODUTOS / SERVIÇOS (GRID 2 COLUNAS) */}
        {/* ==================================================== */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{categoriaAtiva}</Text>
          <TouchableOpacity onPress={() => setCategoriaAtiva('Destaques')}>
            <Text style={styles.verTodosText}>Ver todos</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.gridContainer}>
          {itensExibidos.length > 0 ? (
            itensExibidos.map(renderItemCard)
          ) : (
            <Text style={{color: COLORS.gray, padding: 20}}>Nenhum item encontrado nesta categoria.</Text>
          )}
        </View>
        
      </ScrollView>

      {/* ==================================================== */}
      {/* BANNER FLUTUANTE DE PONTOS */}
      {/* ==================================================== */}
      {saldoPontos > 0 && (
        <View style={styles.pointsBannerContainer}>
          <TouchableOpacity style={styles.pointsBanner} activeOpacity={0.9}>
            <View style={styles.pointsIconBox}>
              <MaterialCommunityIcons name="tag-outline" size={20} color={COLORS.white} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.pointsTitle}>Você tem {saldoPontos} pontos</Text>
              <Text style={styles.pointsSub}>Use seus pontos e ganhe descontos!</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.lightGray },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.lightGray },
  
  coverContainer: { height: 220, width: '100%', position: 'relative' },
  coverImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  coverOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
  headerButtons: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 20, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  headerRightBtns: { flexDirection: 'row', gap: 10 },
  circleBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, elevation: 3 },

  profileCard: { 
    backgroundColor: COLORS.white, 
    marginTop: -40, 
    marginHorizontal: 16, 
    borderRadius: 24, 
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 50,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 5,
    position: 'relative'
  },
  avatarWrapper: {
    position: 'absolute',
    top: -45,
    width: 90, height: 90,
    borderRadius: 45,
    backgroundColor: COLORS.white,
    padding: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 4
  },
  avatarImage: { width: '100%', height: '100%', borderRadius: 40 },
  
  estName: { fontSize: 20, fontWeight: '800', color: COLORS.secondary },
  estSub: { fontSize: 12, color: COLORS.gray, marginTop: 4, marginBottom: 16 },
  
  infoRowContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingVertical: 14, borderTopWidth: 1, borderTopColor: COLORS.border },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoTextBold: { fontSize: 13, fontWeight: '700', color: COLORS.secondary },
  infoTextGray: { fontSize: 13, color: COLORS.gray },
  infoTextGreen: { fontSize: 13, fontWeight: '800', color: COLORS.green },
  infoDescBottom: { fontSize: 11, color: COLORS.gray, width: '100%', textAlign: 'left', marginTop: 4 },

  tabsContainer: { marginTop: 24, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tabBtn: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: COLORS.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: COLORS.gray },
  tabTextActive: { color: COLORS.primary, fontWeight: '800' },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 24, paddingBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: COLORS.secondary },
  verTodosText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },

  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10, justifyContent: 'space-between' },

  cardItem: { 
    width: (width / 2) - 18, 
    backgroundColor: COLORS.white, 
    borderRadius: 16, 
    marginBottom: 16, 
    marginHorizontal: 4,
    borderWidth: 1, 
    borderColor: '#F3F4F6',
    overflow: 'hidden',
    padding: 8
  },
  cardImageContainer: { width: '100%', height: 110, position: 'relative', backgroundColor: COLORS.lightGray, borderRadius: 12 },
  cardImage: { width: '100%', height: '100%', resizeMode: 'cover', borderRadius: 12 },
  badgeDestaque: { position: 'absolute', top: 6, left: 6, backgroundColor: '#B94426', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  badgeDestaqueText: { color: COLORS.white, fontSize: 8, fontWeight: '800', textTransform: 'uppercase' },
  
  addBtnContainer: { position: 'absolute', bottom: -12, right: 8, zIndex: 10 },
  addBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, elevation: 4 },

  cardContent: { paddingHorizontal: 4, paddingTop: 16, paddingBottom: 4 },
  cardTitle: { fontSize: 13, fontWeight: '800', color: COLORS.secondary, marginBottom: 6 },
  
  priceRow: { flexDirection: 'row', alignItems: 'baseline' },
  priceBold: { fontSize: 16, fontWeight: '900', color: COLORS.secondary },
  priceSuffix: { fontSize: 10, color: COLORS.gray, fontWeight: '600' },
  
  oldPriceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 6 },
  oldPriceText: { fontSize: 10, color: COLORS.gray, textDecorationLine: 'line-through' },
  discountBadge: { backgroundColor: COLORS.green, paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 },
  discountText: { fontSize: 9, fontWeight: '800', color: COLORS.white },

  cardSpecs: { fontSize: 10, color: COLORS.gray, marginTop: 8, fontWeight: '500' },
  cardFooterInfo: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 },
  cardFooterText: { fontSize: 10, color: COLORS.gray, fontWeight: '500' },

  pointsBannerContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 30, 
    left: 16, right: 16,
    zIndex: 50
  },
  pointsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFDAC1', 
    borderWidth: 1,
    borderColor: '#FFC8A2',
    borderRadius: 12,
    padding: 14,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4
  },
  pointsIconBox: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#B94426', alignItems: 'center', justifyContent: 'center' },
  pointsTitle: { fontSize: 13, fontWeight: '800', color: COLORS.secondary },
  pointsSub: { fontSize: 11, color: COLORS.secondary, marginTop: 2 }
});