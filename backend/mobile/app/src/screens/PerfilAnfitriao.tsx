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

const COLORS = { 
  primary: '#E11D48',
  secondary: '#111827', 
  gray: '#6B7280', 
  lightGray: '#F3F4F6',
  white: '#FFFFFF', 
  border: '#E5E7EB',
  green: '#10B981',
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

  // MOCK DE TESTE (caso a API falhe ou ID esteja nulo)
  const mockData = {
    anfitriao: {
      id: id || '1',
      nome: 'Carlos Silva',
      subtitulo: 'Anfitrião • Profissional Verificado',
      foto_perfil: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=256&auto=format&fit=crop',
      capa: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=1000&auto=format&fit=crop',
      total_avaliacoes: 48,
      avaliacao_media: '4.9',
      status: 'Superhost',
      cidade: 'São Paulo',
      estado: 'SP',
      onde_estudou: 'USP - Universidade de São Paulo',
      idiomas: 'Português, Inglês',
      cpf_cnpj: '***.***.***-**'
    },
    servicos: [
      { id: 1, nome: 'Serviço Exemplo 1', preco: '89,90', precoAntigo: '110,00', desconto: '-18%', img: 'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?q=80&w=600', badge: 'Mais pedido', desc: 'Descrição detalhada do serviço prestado pelo anfitrião.' },
      { id: 2, nome: 'Serviço Exemplo 2', preco: '150,00', precoAntigo: null, desconto: null, img: 'https://images.unsplash.com/photo-1607860108855-64acf2078ed9?q=80&w=600', badge: null, desc: 'Atendimento personalizado com garantia de qualidade.' }
    ]
  };

  useEffect(() => {
    carregarPerfil();
  }, [id]);

  const carregarPerfil = async () => {
    try {
      setLoading(true);

      if (!id || id === 'undefined' || id === 'null') {
        setDados(mockData);
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
        const payload = json.estabelecimento || json.data || json;
        const user = payload.usuario || payload.owner || payload;

        setDados({
          anfitriao: {
            id: user.id || payload.id || id,
            nome: user.name || payload.nome || 'Anfitrião',
            subtitulo: user.papel ? `Papel: ${user.papel}` : (payload.categoria || 'Prestador de Serviços'),
            foto_perfil: user.foto_perfil || user.avatar || payload.foto_perfil || mockData.anfitriao.foto_perfil,
            capa: payload.foto_capa || user.capa || mockData.anfitriao.capa,
            total_avaliacoes: user.numero_reservas || payload.total_avaliacoes || 0,
            avaliacao_media: payload.avaliacao_media || '5.0',
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
                img: s.foto || s.imagem || mockData.servicos[0].img,
                badge: s.destaque ? 'Destaque' : null,
                desc: s.descricao || `${s.duracao_minutos || 30} min`
              }))
            : mockData.servicos
        });
      } else {
        setDados(mockData);
      }

    } catch (error) {
      console.log('Erro ao carregar dados do usuário:', error);
      setDados(mockData);
    } finally {
      setLoading(false);
    }
  };

  const irParaServico = (servicoId: string | number) => {
    router.push({
      pathname: '/src/screens/ServicoDetalhes',
      params: { id: String(servicoId), servicoId: String(servicoId) }
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary}/>
      </View>
    );
  }

  const { anfitriao, servicos } = dados || mockData;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        
        {/* --- CAPA E BOTÕES DE NAVEGAÇÃO --- */}
        <View style={styles.coverContainer}>
          <Image source={{ uri: anfitriao.capa }} style={styles.coverImage} />
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.circleBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={20} color={COLORS.secondary} />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.circleBtn} onPress={() => setFavorito(!favorito)}>
              <Ionicons 
                name={favorito ? "heart" : "heart-outline"} 
                size={20} 
                color={favorito ? COLORS.primary : COLORS.secondary} 
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* --- CONTEÚDO PRINCIPAL --- */}
        <View style={styles.mainContent}>
          <Image source={{ uri: anfitriao.foto_perfil }} style={styles.avatar} />
          
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
                {anfitriao.avaliacao_media} <Ionicons name="star" size={13} color={COLORS.secondary}/>
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
              
              <Image source={{ uri: item.img }} style={styles.cardImage} resizeMode="cover" />
              
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
  container: { flex: 1, backgroundColor: COLORS.white },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.white },
  
  coverContainer: { position: 'relative', width: '100%', height: 220 },
  coverImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  headerIcons: { 
    position: 'absolute', top: Platform.OS === 'ios' ? 50 : 40, left: 16, right: 16, 
    flexDirection: 'row', justifyContent: 'space-between' 
  },
  circleBtn: { 
    width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.white, 
    justifyContent: 'center', alignItems: 'center', elevation: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 3
  },
  
  mainContent: { 
    backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, 
    marginTop: -24, paddingHorizontal: 20 
  },
  avatar: { 
    width: 84, height: 84, borderRadius: 42, borderWidth: 4, borderColor: COLORS.white, 
    alignSelf: 'center', marginTop: -42, backgroundColor: COLORS.lightGray 
  },
  hostName: { fontSize: 22, fontWeight: '900', color: COLORS.secondary, textAlign: 'center', marginTop: 8 },
  hostSubtitle: { fontSize: 13, color: COLORS.gray, textAlign: 'center', marginTop: 2, marginBottom: 16 },

  infoSection: { gap: 10, marginBottom: 20, backgroundColor: '#F9FAFB', padding: 14, borderRadius: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoText: { fontSize: 13, color: COLORS.gray },
  infoValue: { color: COLORS.secondary, fontWeight: '600' },

  statsBox: { 
    flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: 16, 
    padding: 14, justifyContent: 'space-evenly', alignItems: 'center', marginBottom: 16,
    borderWidth: 1, borderColor: COLORS.border
  },
  statItem: { alignItems: 'center', flex: 1 },
  statNumber: { fontSize: 15, fontWeight: '800', color: COLORS.secondary },
  statLabel: { fontSize: 11, color: COLORS.gray, marginTop: 2 },
  statDivider: { width: 1, height: 24, backgroundColor: COLORS.border },

  tabsContainer: { flexDirection: 'row', borderBottomWidth: 1, borderColor: COLORS.lightGray, marginBottom: 16 },
  tabItem: { paddingVertical: 12, marginRight: 20 },
  tabItemActive: { borderBottomWidth: 2, borderColor: COLORS.primary },
  tabText: { fontSize: 14, color: COLORS.gray, fontWeight: '600' },
  tabTextActive: { color: COLORS.primary, fontWeight: '800' },

  sectionHeader: { marginBottom: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.secondary },

  card: { 
    backgroundColor: COLORS.white, borderRadius: 16, overflow: 'hidden', 
    marginBottom: 16, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2
  },
  badgeTop: { 
    position: 'absolute', top: 12, left: 12, backgroundColor: COLORS.primary, 
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, zIndex: 1 
  },
  badgeText: { color: COLORS.white, fontSize: 10, fontWeight: 'bold' },
  cardImage: { width: '100%', height: 140 },
  cardInfo: { padding: 14, gap: 4 },
  cardName: { fontSize: 15, color: COLORS.secondary, fontWeight: '700' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  cardPrice: { fontSize: 17, fontWeight: '900', color: COLORS.secondary },
  addBtn: { 
    width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.lightGray, 
    justifyContent: 'center', alignItems: 'center' 
  },
  oldPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  oldPrice: { fontSize: 12, color: COLORS.gray, textDecorationLine: 'line-through' },
  discountBadge: { backgroundColor: COLORS.green, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  discountText: { color: COLORS.white, fontSize: 10, fontWeight: 'bold' },
  cardDesc: { fontSize: 12, color: COLORS.gray, marginTop: 4, lineHeight: 18 }
});