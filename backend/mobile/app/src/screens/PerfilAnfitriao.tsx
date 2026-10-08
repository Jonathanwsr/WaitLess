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

        // O backend (AnfitriaoMobileController::getPerfil) manda a lista de
        // itens/serviços dentro de "destaques", não "servicos" — ler a chave
        // errada fazia essa lista ficar sempre vazia, mesmo com itens cadastrados.
        const itens = Array.isArray(payload.destaques) ? payload.destaques : [];

        setDados({
          anfitriao: {
            id: user.id || payload.id || id,
            nome: user.name || payload.nome || 'Anfitrião',
            subtitulo: user.papel ? `Papel: ${user.papel}` : (payload.subtitulo || 'Prestador de Serviços'),
            foto_perfil: user.foto_perfil || user.avatar || payload.foto_perfil || null,
            capa: payload.foto_banner || payload.capa || user.capa || null,
            total_avaliacoes: user.numero_reservas || payload.total_avaliacoes || 0,
            avaliacao_media: payload.avaliacao_media && Number(payload.avaliacao_media) > 0 ? Number(payload.avaliacao_media).toFixed(1).replace('.', ',') : null,
            status: user.plano_assinatura ? `Plano ${user.plano_assinatura}` : (payload.status || 'Verificado'),
            cidade: user.city || payload.cidade || '',
            estado: user.state || payload.estado || '',

            // CAMPOS DA TABELA USERS
            onde_estudou: user.onde_estudou || user.escolaridade || user.estudo || null,
            idiomas: user.idiomas || user.languages || null,
            cpf_cnpj: user.cpf_cnpj || null,
            telefone: user.mobile_phone || user.phone || user.telefone || null
          },
          itens: itens.map((s: any) => ({
            id: s.id,
            tipo: s.tipo === 'item' ? 'item' : 'servico',
            categoria: s.categoria || null,
            nome: s.nome,
            preco: s.preco ?? Number(s.valor || 0).toFixed(2).replace('.', ','),
            precoAntigo: s.precoAntigo || null,
            desconto: s.desconto || null,
            img: s.img || null,
            badge: s.badge || null,
            desc: s.desc || ''
          }))
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

  const CATEGORIA_LABEL: Record<string, string> = {
    casa: 'Casas', apartamento: 'Apartamentos', carro: 'Carros', moto: 'Motos',
    bicicleta: 'Bicicletas', patinete: 'Patinetes', quadra: 'Quadras', sala: 'Salas',
    equipamento: 'Equipamentos', ferramenta: 'Ferramentas', outro: 'Outros',
  };

  const irParaItem = (item: { id: string | number; tipo: string }) => {
    // Um item de locação (tipo === 'item') abre na aba de "reservas" da
    // ExplorarDetalhes; um serviço de agendamento abre como 'servico'.
    router.push({
      pathname: '/src/screens/ExplorarDetalhes' as never,
      params: { id: String(item.id).replace(/^s/, ''), tipo: item.tipo === 'item' ? 'reservas' : 'servico' }
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

  const { anfitriao, itens } = dados;

  // Os filtros se adaptam ao que esse anfitrião realmente oferece: uma aba por
  // categoria de locação presente (ex.: só "Carros" se só tiver carros, "Carros"
  // + "Motos" se tiver os dois) e "Serviços" só se houver agendamento. Nada de
  // categorias fixas (tipo "SUVs"/"Premium") que não existem no cadastro.
  const categoriasPresentes: string[] = Array.from(new Set(itens.filter((i: any) => i.tipo === 'item' && i.categoria).map((i: any) => String(i.categoria))));
  const temServicos = itens.some((i: any) => i.tipo === 'servico');
  const abas: string[] = ['Destaques', ...categoriasPresentes.map((c) => CATEGORIA_LABEL[c] || c), ...(temServicos ? ['Serviços'] : []), 'Sobre'];

  const itensFiltrados = abaAtiva === 'Destaques' || abaAtiva === 'Sobre'
    ? itens
    : abaAtiva === 'Serviços'
      ? itens.filter((i: any) => i.tipo === 'servico')
      : itens.filter((i: any) => CATEGORIA_LABEL[i.categoria] === abaAtiva || i.categoria === abaAtiva);

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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContainer}>
            {abas.map((tab) => (
              <TouchableOpacity
                key={tab}
                onPress={() => setAbaAtiva(tab)}
                style={[styles.tabItem, abaAtiva === tab && styles.tabItemActive]}
              >
                <Text style={[styles.tabText, abaAtiva === tab && styles.tabTextActive]}>{tab}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* --- GRADE DE ITENS/SERVIÇOS --- */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{abaAtiva}</Text>
          </View>

          {itensFiltrados.length === 0 && <Text style={{ color: COLORS.gray, textAlign: 'center', paddingVertical: 24 }}>Nada disponível aqui no momento.</Text>}

          <View style={styles.grid}>
            {itensFiltrados.map((item: any) => (
              <TouchableOpacity
                key={item.id}
                style={styles.card}
                onPress={() => irParaItem(item)}
                activeOpacity={0.85}
              >
                {item.badge && (
                  <View style={styles.badgeTop}>
                    <Text style={styles.badgeText}>{item.badge}</Text>
                  </View>
                )}

                {item.img ? <Image source={{ uri: item.img }} style={styles.cardImage} resizeMode="cover" /> : <View style={[styles.cardImage, { alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.lightGray }]}><Ionicons name="image-outline" size={26} color={COLORS.gray} /></View>}

                <View style={styles.cardInfo}>
                  <Text style={styles.cardName} numberOfLines={1}>{item.nome}</Text>
                  <Text style={styles.cardDesc} numberOfLines={1}>{item.desc}</Text>

                  <View style={styles.priceRow}>
                    {item.precoAntigo ? (
                      <View style={{ flex: 1 }}>
                        <Text style={styles.oldPrice}>R$ {item.precoAntigo}</Text>
                        <Text style={styles.cardPrice}>R$ {item.preco}</Text>
                      </View>
                    ) : (
                      <Text style={styles.cardPrice}>R$ {item.preco}</Text>
                    )}
                    {item.desconto && (
                      <View style={styles.discountBadge}>
                        <Text style={styles.discountText}>{item.desconto}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>

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

  tabsContainer: { flexDirection: 'row', gap: 8, paddingBottom: 4, marginBottom: 18 },
  tabItem: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 11, backgroundColor: '#E9E9EC' },
  tabItemActive: { backgroundColor: COLORS.secondary },
  tabText: { fontSize: 14, color: COLORS.gray, fontWeight: '600' },
  tabTextActive: { color: COLORS.white, fontWeight: '800' },

  sectionHeader: { marginBottom: 14 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: COLORS.secondary, letterSpacing: -0.4 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: {
    width: '48%', backgroundColor: COLORS.white, borderRadius: 18, overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3
  },
  badgeTop: {
    position: 'absolute', top: 10, left: 10, backgroundColor: '#DC2626',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, zIndex: 1
  },
  badgeText: { color: COLORS.white, fontSize: 10, fontWeight: '800' },
  cardImage: { width: '100%', height: 110 },
  cardInfo: { padding: 12, gap: 2 },
  cardName: { fontSize: 14, color: COLORS.secondary, fontWeight: '700' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 6 },
  cardPrice: { fontSize: 16, fontWeight: '800', color: COLORS.secondary, letterSpacing: -0.3 },
  oldPrice: { fontSize: 11, color: COLORS.gray, textDecorationLine: 'line-through' },
  discountBadge: { backgroundColor: COLORS.green, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  discountText: { color: COLORS.white, fontSize: 10, fontWeight: 'bold' },
  cardDesc: { fontSize: 12, color: COLORS.gray, marginTop: 1 }
});
