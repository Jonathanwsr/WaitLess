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
  StatusBar
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FavoriteButton } from '../../../components/client/ui';

const COLORS = {
  primary: '#FF7A00',
  primarySoft: '#FFF1E4',
  secondary: '#282828',
  gray: '#6A6C72',
  lightGray: '#F0F0F2',
  white: '#FFFFFF',
  border: '#E6E7E9',
  green: '#00A868',
  promoBg: '#FEE2E2',
  promoText: '#B91C1C'
};

const BASE_API = process.env.EXPO_PUBLIC_API_URL || 'https://waitless-g1yc.onrender.com/api';

export default function PerfilAnfitriao() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  // Captura o ID vindo da navegação
  const rawId = params.id || params.estabelecimentoId;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const [dados, setDados] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState('Destaques');
  const [favorito, setFavorito] = useState(false);

  useEffect(() => {
    carregarPerfil();
  }, [id]);

  const carregarPerfil = async () => {
    try {
      setLoading(true);

      if (!id || id === 'undefined' || id === 'null') {
        setDados(null);
        return;
      }

      const token = await AsyncStorage.getItem('@waitless_token');
      const cleanBaseUrl = BASE_API.replace(/\/mobile\/?$/, '').replace(/\/+$/, '');
      const url = `${cleanBaseUrl}/mobile/catalogo/estabelecimentos/${id}`;

      const res = await fetch(url, { 
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (res.ok) {
        const json = await res.json();
        
        // Pega os dados do estabelecimento ou do usuário associado
        // A rota real (AnfitriaoMobileController::getPerfil) devolve os dados
        // dentro de "anfitriao", não em "estabelecimento"/"data" — sem isso,
        // TODOS os campos abaixo (nome, foto, avaliação...) caíam pro mock.
        const payload = json.anfitriao || json.estabelecimento || json.data || json;
        const user = payload.usuario || payload.owner || payload;

        setDados({
          anfitriao: {
            id: user.id || payload.id || id,
            nome: user.name || payload.nome || 'Anfitrião',
            subtitulo: user.papel ? `Papel: ${user.papel}` : (payload.categoria || 'Prestador de Serviços'),
            foto_perfil: user.foto_perfil || user.avatar || payload.foto_perfil || null,
            capa: payload.foto_banner || payload.capa || user.capa || null,
            total_avaliacoes: user.numero_reservas || payload.total_avaliacoes || 0,
            avaliacao_media: payload.avaliacao_media && Number(payload.avaliacao_media) > 0 ? Number(payload.avaliacao_media).toFixed(1).replace('.', ',') : null,
            status: user.plano_assinatura ? `Plano ${user.plano_assinatura}` : 'Verificado',
            cidade: user.city || payload.cidade || '',
            estado: user.state || payload.estado || '',
            
            // CAMPOS DA TABELA USERS
            onde_estudou: user.onde_estudou || user.escolaridade || user.estudo || null,
            idiomas: user.idiomas || user.languages || null,
            cpf_cnpj: user.cpf_cnpj || null,
            telefone: user.mobile_phone || user.phone || user.telefone || null
          },
          servicos: Array.isArray(payload.servicos) && payload.servicos.length > 0 
            ? payload.servicos.map((s: any) => ({
                id: s.id,
                nome: s.nome,
                preco: Number(s.valor || s.preco || 0).toFixed(2).replace('.', ','),
                precoAntigo: s.preco_antigo ? Number(s.preco_antigo).toFixed(2).replace('.', ',') : null,
                desconto: s.desconto || null,
                img: s.foto || s.imagem || null,
                badge: s.destaque ? 'Destaque' : null,
                desc: s.descricao || `${s.duracao_minutos || 30} min`
              }))
            : []
        });
      } else {
        setDados(null);
      }

    } catch (error) {
      console.log('Erro ao carregar dados do usuário:', error);
      setDados(null);
    } finally {
      setLoading(false);
    }
  };

  const irParaServico = (servicoId: string | number) => {
    // ServicoDetalhes espera o id de um ESTABELECIMENTO, não de um serviço —
    // o detalhe de um serviço específico é a ExplorarDetalhes.
    router.push({
      pathname: '/src/screens/ExplorarDetalhes' as never,
      params: { id: String(servicoId), tipo: 'servico' }
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary}/>
      </View>
    );
  }

  if (!dados) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle-outline" size={44} color={COLORS.gray} />
        <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.secondary, marginTop: 12 }}>Perfil indisponível</Text>
        <Text style={{ fontSize: 13, color: COLORS.gray, marginTop: 4, textAlign: 'center', paddingHorizontal: 32 }}>Não foi possível carregar este perfil agora.</Text>
        <TouchableOpacity style={styles.tentar} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/home' as never))}>
          <Text style={styles.tentarTxt}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { anfitriao, servicos } = dados;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        
        {/* --- CAPA E BOTÕES DE NAVEGAÇÃO --- */}
        <View style={styles.coverContainer}>
          {anfitriao.capa ? <Image source={{ uri: anfitriao.capa }} style={styles.coverImage} /> : <View style={[styles.coverImage, { backgroundColor: COLORS.primary }]} />}
          <View style={styles.coverShade} />
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.circleBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={20} color={COLORS.secondary} />
            </TouchableOpacity>
            
            <FavoriteButton ativo={favorito} onPress={() => setFavorito(!favorito)} tamanho={38} />
          </View>
        </View>

        {/* --- CONTEÚDO PRINCIPAL --- */}
        <View style={styles.mainContent}>
          {anfitriao.foto_perfil ? (
            <Image source={{ uri: anfitriao.foto_perfil }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary }]}>
              <Text style={{ color: '#fff', fontSize: 30, fontWeight: '900' }}>{String(anfitriao.nome || 'A').charAt(0).toUpperCase()}</Text>
            </View>
          )}
          
          <Text style={styles.hostName}>{anfitriao.nome}</Text>
          <Text style={styles.hostSubtitle}>{anfitriao.subtitulo}</Text>

          {/* BOX DE ESTATÍSTICAS */}
          <View style={styles.statsBox}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{anfitriao.total_avaliacoes}</Text>
              <Text style={styles.statLabel}>reservas</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {anfitriao.avaliacao_media || 'Novo'} {!!anfitriao.avaliacao_media && <Ionicons name="star" size={13} color="#F59E0B"/>}
              </Text>
              <Text style={styles.statLabel}>estrelas</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{anfitriao.status}</Text>
              <Text style={styles.statLabel}>status</Text>
            </View>
          </View>

          {/* INFORMAÇÕES VINDAS DA TABELA USERS */}
          <View style={styles.infoSection}>
            
            {/* Onde Estudou (Se existir no Model) */}
            {anfitriao.onde_estudou && (
              <View style={styles.infoRow}>
                <Ionicons name="school-outline" size={18} color={COLORS.gray} />
                <Text style={styles.infoText}>Estudou em: <Text style={styles.infoValue}>{anfitriao.onde_estudou}</Text></Text>
              </View>
            )}

            {/* Onde Moro (city + state do Model) */}
            {(anfitriao.cidade || anfitriao.estado) && (
              <View style={styles.infoRow}>
                <Ionicons name="home-outline" size={18} color={COLORS.gray} />
                <Text style={styles.infoText}>
                  Mora em: <Text style={styles.infoValue}>{`${anfitriao.cidade}${anfitriao.estado ? `, ${anfitriao.estado}` : ''}`}</Text>
                </Text>
              </View>
            )}

            {/* Idiomas (Se existir no Model) */}
            {anfitriao.idiomas && (
              <View style={styles.infoRow}>
                <Ionicons name="globe-outline" size={18} color={COLORS.gray} />
                <Text style={styles.infoText}>Idiomas: <Text style={styles.infoValue}>{anfitriao.idiomas}</Text></Text>
              </View>
            )}

            {/* Verificação de Identidade (Com base no CPF/CNPJ) */}
            <View style={styles.infoRow}>
              <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.primary} />
              <Text style={[styles.infoText, { color: COLORS.secondary, fontWeight: '600' }]}>
                {anfitriao.cpf_cnpj ? 'Identidade Verificada' : 'Conta Cadastrada'}
              </Text>
            </View>

          </View>

          {/* --- ABAS ( TABS ) --- */}
          <View style={styles.tabsContainer}>
            {['Destaques', 'Serviços', 'Sobre'].map((tab) => (
              <TouchableOpacity 
                key={tab} 
                onPress={() => setAbaAtiva(tab)} 
                style={[styles.tabItem, abaAtiva === tab && styles.tabItemActive]}
              >
                <Text style={[styles.tabText, abaAtiva === tab && styles.tabTextActive]}>{tab}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* --- LISTA DE SERVIÇOS --- */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{abaAtiva}</Text>
          </View>

          {servicos.length === 0 && <Text style={{ color: COLORS.gray, textAlign: 'center', paddingVertical: 24 }}>Nenhum serviço disponível no momento.</Text>}

          {servicos.map((item: any) => (
            <TouchableOpacity 
              key={item.id} 
              style={styles.card}
              onPress={() => irParaServico(item.id)}
              activeOpacity={0.85}
            >
              {item.badge && (
                <View style={styles.badgeTop}>
                  <Text style={styles.badgeText}>{item.badge}</Text>
                </View>
              )}
              
              {item.img ? <Image source={{ uri: item.img }} style={styles.cardImage} resizeMode="cover" /> : <View style={[styles.cardImage, { alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.lightGray }]}><Ionicons name="image-outline" size={30} color={COLORS.gray} /></View>}
              
              <View style={styles.cardInfo}>
                <Text style={styles.cardName}>{item.nome}</Text>
                
                <View style={styles.priceRow}>
                  <Text style={styles.cardPrice}>R$ {item.preco}</Text>
                  <View style={styles.addBtn}>
                    <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
                  </View>
                </View>

                {item.precoAntigo && (
                  <View style={styles.oldPriceRow}>
                    <Text style={styles.oldPrice}>R$ {item.precoAntigo}</Text>
                    {item.desconto && (
                      <View style={styles.discountBadge}>
                        <Text style={styles.discountText}>{item.desconto}</Text>
                      </View>
                    )}
                  </View>
                )}

                <Text style={styles.cardDesc} numberOfLines={2}>{item.desc}</Text>
              </View>
            </TouchableOpacity>
          ))}

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' },
  tentar: { marginTop: 18, backgroundColor: COLORS.primary, paddingHorizontal: 28, paddingVertical: 13, borderRadius: 14 },
  tentarTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },

  coverContainer: { position: 'relative', width: '100%', height: 230 },
  coverImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  coverShade: { ...StyleSheet.absoluteFill as object, backgroundColor: 'rgba(0,0,0,0.12)' },
  headerIcons: {
    position: 'absolute', top: Platform.OS === 'ios' ? 50 : 40, left: 16, right: 16,
    flexDirection: 'row', justifyContent: 'space-between'
  },
  circleBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.white,
    justifyContent: 'center', alignItems: 'center', elevation: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.16, shadowRadius: 8
  },

  mainContent: {
    backgroundColor: '#F5F5F5', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    marginTop: -28, paddingHorizontal: 20, paddingBottom: 8
  },
  avatar: {
    width: 92, height: 92, borderRadius: 46, borderWidth: 4, borderColor: '#F5F5F5',
    alignSelf: 'center', marginTop: -46, backgroundColor: COLORS.lightGray,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4
  },
  hostName: { fontSize: 24, fontWeight: '800', color: COLORS.secondary, textAlign: 'center', marginTop: 12, letterSpacing: -0.5 },
  hostSubtitle: { fontSize: 13, color: COLORS.gray, textAlign: 'center', marginTop: 3, marginBottom: 18 },

  infoSection: { gap: 12, marginBottom: 18, backgroundColor: COLORS.white, padding: 16, borderRadius: 20 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoText: { fontSize: 14, color: COLORS.gray, flex: 1 },
  infoValue: { color: COLORS.secondary, fontWeight: '700' },

  statsBox: {
    flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: 20,
    paddingVertical: 16, paddingHorizontal: 8, justifyContent: 'space-evenly', alignItems: 'center', marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2
  },
  statItem: { alignItems: 'center', flex: 1 },
  statNumber: { fontSize: 17, fontWeight: '800', color: COLORS.secondary },
  statLabel: { fontSize: 12, color: COLORS.gray, marginTop: 3 },
  statDivider: { width: 1, height: 28, backgroundColor: COLORS.border },

  tabsContainer: { flexDirection: 'row', backgroundColor: '#E9E9EC', borderRadius: 14, padding: 4, marginBottom: 18 },
  tabItem: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 11 },
  tabItemActive: { backgroundColor: COLORS.white, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  tabText: { fontSize: 14, color: COLORS.gray, fontWeight: '600' },
  tabTextActive: { color: COLORS.primary, fontWeight: '800' },

  sectionHeader: { marginBottom: 14 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: COLORS.secondary, letterSpacing: -0.4 },

  card: {
    backgroundColor: COLORS.white, borderRadius: 22, overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3
  },
  badgeTop: {
    position: 'absolute', top: 12, left: 12, backgroundColor: COLORS.primary,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, zIndex: 1
  },
  badgeText: { color: COLORS.white, fontSize: 11, fontWeight: '800' },
  cardImage: { width: '100%', height: 150 },
  cardInfo: { padding: 16, gap: 4 },
  cardName: { fontSize: 16, color: COLORS.secondary, fontWeight: '700' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  cardPrice: { fontSize: 20, fontWeight: '800', color: COLORS.secondary, letterSpacing: -0.3 },
  addBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primarySoft,
    justifyContent: 'center', alignItems: 'center'
  },
  oldPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  oldPrice: { fontSize: 13, color: COLORS.gray, textDecorationLine: 'line-through' },
  discountBadge: { backgroundColor: COLORS.green, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  discountText: { color: COLORS.white, fontSize: 11, fontWeight: 'bold' },
  cardDesc: { fontSize: 13, color: COLORS.gray, marginTop: 4, lineHeight: 19 }
});
